// Endpoints de aprobaciones humanas del Agent Layer para la Oficina de Agentes.
// NO reimplementan nada: listan y deciden con la logica real de
// agent/src/lib/approvals.mjs (listRequests/decide), que firma la decision con
// la clave HMAC que vive fuera del repo (~/.fidelyfood-agent/approval.key).
//
// AUTORIZACION de las decisiones (approve/deny). Origin y x-jarvis-ui NO son
// autenticacion: cualquier cliente de loopback puede enviarlos (curl). Se exige:
//   1. Sesion: cookie HttpOnly+SameSite=Strict con un id aleatorio de 256 bits, que
//      solo se obtiene tecleando un codigo de un solo uso que un humano genera en
//      una terminal interactiva (`approve -- ui-code`, ver agent/src/lib/ui-unlock.mjs).
//      El codigo no esta en ningun archivo que sirva el servidor ni en la URL.
//   2. Token CSRF por sesion, que solo se entrega en el cuerpo de la respuesta
//      same-origin y viaja en la cabecera x-csrf-token (nunca en cookie ni URL).
//   3. Host y Origin exactos (http://localhost:PORT o http://127.0.0.1:PORT, y
//      coincidentes entre si), mas Sec-Fetch-Site=same-origin cuando el navegador
//      lo envia. Frena CSRF y DNS rebinding.
// Alcance: protege frente a paginas web, otros usuarios del Mac y procesos que no
// pueden leer ~/.fidelyfood-agent. NO frena a un proceso con tu mismo usuario que
// lea approval.key (puede firmar sin pasar por aqui): es el limite documentado en
// AGENT_LAYER.md.
import crypto from "node:crypto";
import express from "express";
import { listRequests, decide } from "../agent/src/lib/approvals.mjs";
import { consumeUnlockCode } from "../agent/src/lib/ui-unlock.mjs";

// Riesgo de cada herramienta segun su definicion en el Agent Layer
// (read < write < exec < approval). Las que no estan aqui se marcan "desconocido".
const TOOL_RISK = {
  execute_database_statement: "approval",
  github_create_pr: "approval",
  call_api: "exec",
  run_command: "exec",
  run_e2e_tests: "exec",
  run_integration_tests: "exec",
  run_maven: "exec",
  run_npm: "exec",
  run_playwright: "exec",
  run_unit_tests: "exec",
  service_start: "exec",
  service_stop: "exec",
  git_commit: "write",
  git_create_branch: "write",
  write_file: "write",
  memory_add: "write",
  task_create: "write",
  task_update: "write",
};

const normTool = (t) => String(t || "").replace(/^mcp__fidelyfood__/, "");
const ID_RE = /^apr_[0-9a-f]{10}$/;
const COOKIE = "jarvis_appr";
const COOKIE_PATH = "/api/jarvis/approvals";

const view = (r) => ({
  id: r.id,
  tool: normTool(r.tool),
  operation: r.summary,
  reason: r.reason,
  risk: TOOL_RISK[normTool(r.tool)] || "desconocido",
  requestedAt: r.requestedAt,
  status: r.status,
});

// Mensaje 409 segun el estado REAL (lifecycle), no el campo persistido `status`:
// una aprobacion caducada tiene status "approved" pero ya no vale.
function conflictBody(r) {
  const until = r.expiresAt ? ` hasta ${r.expiresAt}` : "";
  const text = {
    denied: `La solicitud ${r.id} fue denegada y no puede decidirse de nuevo.`,
    approved_unused: `La solicitud ${r.id} ya esta aprobada y vigente${until}. Pide al agente que repita la accion con su approval_id; no se puede decidir de nuevo.`,
    expired: `La solicitud ${r.id} fue aprobada pero caduco${r.expiresAt ? ` el ${r.expiresAt}` : ""} sin usarse. No puede aprobarse ni consumirse: el agente debe pedir una aprobacion nueva.`,
    consumed: `La solicitud ${r.id} ya fue aprobada y utilizada (las aprobaciones son de un solo uso).`,
  }[r.lifecycle] ?? `La solicitud ${r.id} no esta pendiente (estado: ${r.lifecycle}).`;
  return { error: text, status: r.status, lifecycle: r.lifecycle, ...(r.expiresAt ? { expiresAt: r.expiresAt } : {}) };
}

const sha = (v) => crypto.createHash("sha256").update(String(v ?? "")).digest();
const safeEqual = (a, b) => crypto.timingSafeEqual(sha(a), sha(b));

function readCookie(req, name) {
  for (const part of String(req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

export function registerApprovalRoutes(app, { port, clock = Date.now, sessionIdleMs = 15 * 60000, sessionMaxMs = 2 * 3600000, maxSessions = 5 }) {
  const hosts = [`localhost:${port}`, `127.0.0.1:${port}`];
  const sessions = new Map(); // sid -> { csrf, createdAt, lastSeen }

  const hostOk = (req) => hosts.includes(req.get("host"));
  // Origin estricto para peticiones que cambian estado: presente, de este mismo
  // servidor, coincidente con Host y, si el navegador lo informa, same-origin.
  const sameOrigin = (req) => {
    const origin = req.get("origin");
    if (!origin || !hostOk(req) || origin !== `http://${req.get("host")}`) return false;
    const site = req.get("sec-fetch-site");
    return !site || site === "same-origin";
  };
  const noStore = (res) => res.set("Cache-Control", "no-store");

  const sweep = () => {
    const now = clock();
    for (const [sid, s] of sessions) if (now - s.lastSeen > sessionIdleMs || now - s.createdAt > sessionMaxMs) sessions.delete(sid);
  };
  const currentSession = (req) => {
    sweep();
    const sid = readCookie(req, COOKIE);
    const s = sid && sessions.get(sid);
    if (!s) return null;
    s.lastSeen = clock();
    return { sid, ...s };
  };
  const expiresAtOf = (s) => new Date(Math.min(s.lastSeen + sessionIdleMs, s.createdAt + sessionMaxMs)).toISOString();
  const cookieHeader = (sid, maxAgeSec) => `${COOKIE}=${sid}; Path=${COOKIE_PATH}; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSec}`;

  const forbidden = (res) => res.status(403).json({ error: "Las aprobaciones solo se aceptan desde la interfaz de la Oficina (mismo origen)." });
  const locked = (res) => res.status(401).json({
    error: "Centro de Aprobaciones bloqueado. Genera un codigo en tu terminal con: npm --prefix agent run approve -- ui-code",
    code: "locked",
  });
  // Origen + cabecera de la UI + sesion + CSRF. Devuelve la sesion o responde y devuelve null.
  const authorize = (req, res) => {
    if (req.get("x-jarvis-ui") !== "approvals" || !sameOrigin(req)) return forbidden(res), null;
    const session = currentSession(req);
    if (!session) return locked(res), null;
    if (!safeEqual(req.get("x-csrf-token"), session.csrf)) {
      res.status(403).json({ error: "Token CSRF ausente o invalido. Recarga la Oficina.", code: "csrf" });
      return null;
    }
    return session;
  };

  const jsonBody = express.json({ limit: "1kb" });
  const parseJson = (req, res, next) => jsonBody(req, res, (err) => (err ? res.status(400).json({ error: "Cuerpo JSON invalido" }) : next()));

  app.get("/api/jarvis/approvals", (req, res) => {
    if (!hostOk(req)) return forbidden(res);
    try {
      const pending = listRequests()
        .filter((r) => r.status === "pending")
        .sort((a, b) => String(b.requestedAt).localeCompare(String(a.requestedAt)))
        .map(view);
      res.json({ pending, readAt: new Date().toISOString() });
    } catch (err) {
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  // Estado de la sesion. Solo entrega el token CSRF si la cookie es valida; una
  // pagina de otro origen no puede leer la respuesta (sin cabeceras CORS).
  app.get("/api/jarvis/approvals/session", (req, res) => {
    if (!hostOk(req)) return forbidden(res);
    noStore(res);
    const s = currentSession(req);
    res.json(s ? { unlocked: true, csrfToken: s.csrf, expiresAt: expiresAtOf(s) } : { unlocked: false });
  });

  app.post("/api/jarvis/approvals/session", parseJson, (req, res) => {
    if (req.get("x-jarvis-ui") !== "approvals" || !sameOrigin(req)) return forbidden(res);
    noStore(res);
    const code = req.body?.code;
    if (typeof code !== "string" || code.length === 0 || code.length > 64) {
      return res.status(400).json({ error: "Falta el codigo de desbloqueo." });
    }
    const check = consumeUnlockCode(code, clock());
    if (!check.ok) {
      const msg = check.reason === "locked_out"
        ? "Demasiados intentos: el codigo se ha invalidado. Genera uno nuevo con: npm --prefix agent run approve -- ui-code"
        : "Codigo invalido o caducado. Genera uno nuevo con: npm --prefix agent run approve -- ui-code";
      return res.status(check.reason === "locked_out" ? 429 : 401).json({ error: msg, code: check.reason === "locked_out" ? "locked_out" : "bad_code" });
    }
    sweep();
    while (sessions.size >= maxSessions) sessions.delete(sessions.keys().next().value); // la mas antigua
    const sid = crypto.randomBytes(32).toString("hex");
    const now = clock();
    const session = { csrf: crypto.randomBytes(32).toString("hex"), createdAt: now, lastSeen: now };
    sessions.set(sid, session);
    res.set("Set-Cookie", cookieHeader(sid, Math.floor(sessionMaxMs / 1000)));
    res.json({ unlocked: true, csrfToken: session.csrf, expiresAt: expiresAtOf(session) });
  });

  app.post("/api/jarvis/approvals/session/lock", (req, res) => {
    const session = authorize(req, res);
    if (!session) return;
    noStore(res);
    sessions.delete(session.sid);
    res.set("Set-Cookie", cookieHeader("", 0));
    res.json({ unlocked: false });
  });

  const handle = (decision) => (req, res) => {
    if (!authorize(req, res)) return;
    const { id } = req.params;
    if (!ID_RE.test(id)) return res.status(400).json({ error: "id de aprobacion invalido" });
    try {
      const current = listRequests().find((r) => r.id === id);
      if (!current) return res.status(404).json({ error: `No existe la solicitud ${id}` });
      if (current.lifecycle !== "pending") return res.status(409).json(conflictBody(current));
      const out = decide(id, decision);
      res.json({ ok: true, id: out.id, status: out.status, decidedAt: out.decidedAt });
    } catch (err) {
      if (err?.code === "NOT_PENDING") {
        // Otro proceso (p. ej. el CLI) la decidio entre la comprobacion y decide().
        const now = listRequests().find((r) => r.id === id);
        if (now) return res.status(409).json(conflictBody(now));
      }
      res.status(500).json({ error: String(err.message || err) });
    }
  };

  app.post("/api/jarvis/approvals/:id/approve", handle("approved"));
  app.post("/api/jarvis/approvals/:id/deny", handle("denied"));
}
