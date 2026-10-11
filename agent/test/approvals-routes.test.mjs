import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";
import { createRequire } from "node:module";

// Servidor Express AISLADO (puerto efimero en 127.0.0.1) con datos y clave temporales:
// nunca toca agent/data/approvals.jsonl, ~/.fidelyfood-agent ni el access-center real.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ff-appr-routes-"));
process.env.AGENT_DATA_DIR = path.join(tmp, "data");
process.env.AGENT_APPROVAL_KEY_FILE = path.join(tmp, "key", "approval.key");

const ACCESS_CENTER = path.resolve(import.meta.dirname, "..", "..", "access-center");
let express;
try {
  express = createRequire(path.join(ACCESS_CENTER, "package.json"))("express");
} catch {
  express = null;
}
const skip = express ? false : "access-center/node_modules no instalado (npm install en access-center)";

let A, U, server, port, origin, key;
const clock = { t: Date.parse("2026-10-09T10:00:00.000Z") };
const APPROVALS = () => path.join(process.env.AGENT_DATA_DIR, "approvals.jsonl");
const CONSUMED = () => path.join(process.env.AGENT_DATA_DIR, "approvals-consumed.jsonl");
const readApprovals = () => (fs.existsSync(APPROVALS()) ? fs.readFileSync(APPROVALS(), "utf8") : "");

before(async () => {
  if (skip) return;
  A = await import("../src/lib/approvals.mjs");
  U = await import("../src/lib/ui-unlock.mjs");
  const { registerApprovalRoutes } = await import("../../access-center/approvals-routes.mjs");
  key = A.loadKey({ create: true });
  const app = express();
  await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  port = server.address().port;
  origin = `http://127.0.0.1:${port}`;
  registerApprovalRoutes(app, { port, clock: () => clock.t });
});
after(() => server?.close());

function req(method, url, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body);
    const r = http.request({ host: "127.0.0.1", port, path: url, method, headers: { ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}), ...headers } }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        let json = null;
        try { json = JSON.parse(data); } catch { /* no JSON */ }
        resolve({ status: res.statusCode, headers: res.headers, json, text: data });
      });
    });
    r.on("error", reject);
    if (payload) r.write(payload);
    r.end();
  });
}

const UI = { "x-jarvis-ui": "approvals" };
const withOrigin = (extra = {}) => ({ ...UI, Origin: origin, ...extra });

// Desbloqueo como lo haria una persona: el CLI crea el codigo, la UI lo teclea.
async function unlock(extraHeaders = {}) {
  const { code } = U.createUnlockCode(clock.t);
  const r = await req("POST", "/api/jarvis/approvals/session", { headers: withOrigin({ "Content-Type": "application/json", ...extraHeaders }), body: { code } });
  assert.equal(r.status, 200, r.text);
  const cookie = r.headers["set-cookie"][0].split(";")[0];
  return { cookie, csrf: r.json.csrfToken, r };
}
const authed = (s, extra = {}) => withOrigin({ Cookie: s.cookie, "x-csrf-token": s.csrf, ...extra });
const decideUrl = (id, action) => `/api/jarvis/approvals/${id}/${action}`;

// Escribe solicitudes en el formato persistido REAL, firmadas con la clave temporal.
let seq = 0;
function seed({ decision = null, decidedAgoMs = 0, consumed = false, tool = "run_command" } = {}) {
  const args = { command: `ls /ruta-${++seq}`, cwd: "." };
  const id = `apr_${crypto.createHash("sha1").update(`seed${seq}${Math.random()}`).digest("hex").slice(0, 10)}`;
  const fingerprint = A.fingerprint(tool, args);
  const lines = [{ type: "request", id, fingerprint, tool, summary: JSON.stringify(args), reason: "prueba", runId: null, requestedAt: new Date(Date.now() - decidedAgoMs - 1000).toISOString() }];
  if (decision) {
    const decidedAt = new Date(Date.now() - decidedAgoMs).toISOString();
    const sig = crypto.createHmac("sha256", key).update(`${id}|${fingerprint}|${decision}|${decidedAt}`).digest("hex");
    lines.push({ type: "decision", id, fingerprint, decision, decidedAt, sig });
  }
  fs.mkdirSync(process.env.AGENT_DATA_DIR, { recursive: true });
  fs.appendFileSync(APPROVALS(), lines.map((l) => `${JSON.stringify(l)}\n`).join(""));
  if (consumed) fs.appendFileSync(CONSUMED(), `${JSON.stringify({ id, consumedAt: new Date().toISOString() })}\n`);
  return { id, tool, args };
}
const MIN = 60000;

test("GET /api/jarvis/approvals: formato {pending, readAt} y solo solicitudes pendientes", { skip }, async () => {
  const p = seed();
  seed({ decision: "approved" });
  seed({ decision: "approved", decidedAgoMs: 90 * MIN });
  seed({ decision: "denied" });
  const r = await req("GET", "/api/jarvis/approvals");
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(r.json).sort(), ["pending", "readAt"]);
  assert.ok(!Number.isNaN(Date.parse(r.json.readAt)));
  assert.ok(r.json.pending.every((x) => x.status === "pending"));
  const mine = r.json.pending.find((x) => x.id === p.id);
  assert.deepEqual(Object.keys(mine).sort(), ["id", "operation", "reason", "requestedAt", "risk", "status", "tool"]);
  assert.equal(mine.risk, "exec");
  assert.equal(mine.tool, "run_command");
});

test("Host ajeno (DNS rebinding) se rechaza tambien en las lecturas", { skip }, async () => {
  assert.equal((await req("GET", "/api/jarvis/approvals", { headers: { Host: "evil.example:5757" } })).status, 403);
  assert.equal((await req("GET", "/api/jarvis/approvals/session", { headers: { Host: "evil.example" } })).status, 403);
});

test("las respuestas no exponen CORS: otra web no puede leer la lista ni la sesion", { skip }, async () => {
  for (const url of ["/api/jarvis/approvals", "/api/jarvis/approvals/session"]) {
    const r = await req("GET", url, { headers: { Origin: "http://localhost:8100" } });
    assert.equal(r.headers["access-control-allow-origin"], undefined, url);
  }
});

test("sesion: sin cookie esta bloqueada y no entrega token CSRF", { skip }, async () => {
  const r = await req("GET", "/api/jarvis/approvals/session");
  assert.deepEqual(r.json, { unlocked: false });
  assert.equal(r.headers["cache-control"], "no-store");
});

test("VULNERABILIDAD ORIGINAL: Origin + x-jarvis-ui falsificados ya no bastan para decidir", { skip }, async () => {
  const p = seed();
  const before = readApprovals();
  for (const action of ["approve", "deny"]) {
    const r = await req("POST", decideUrl(p.id, action), { headers: withOrigin() }); // exactamente lo que hacia curl
    assert.equal(r.status, 401);
    assert.equal(r.json.code, "locked");
  }
  assert.equal(readApprovals(), before, "no se escribio ninguna decision");
  assert.equal(A.listRequests().find((x) => x.id === p.id).lifecycle, "pending");
});

test("desbloqueo: origen y cabecera de la UI son obligatorios", { skip }, async () => {
  const { code } = U.createUnlockCode(clock.t);
  const body = { code };
  const json = { "Content-Type": "application/json" };
  assert.equal((await req("POST", "/api/jarvis/approvals/session", { headers: { ...UI, ...json }, body })).status, 403, "sin Origin");
  assert.equal((await req("POST", "/api/jarvis/approvals/session", { headers: { ...UI, ...json, Origin: "http://evil.example" }, body })).status, 403, "Origin ajeno");
  assert.equal((await req("POST", "/api/jarvis/approvals/session", { headers: { ...UI, ...json, Origin: "http://localhost:8100" }, body })).status, 403, "Origin del frontend Ionic");
  assert.equal((await req("POST", "/api/jarvis/approvals/session", { headers: { Origin: origin, ...json }, body })).status, 403, "sin x-jarvis-ui");
  assert.equal((await req("POST", "/api/jarvis/approvals/session", { headers: withOrigin({ ...json, "Sec-Fetch-Site": "cross-site" }), body })).status, 403, "navegador dice cross-site");
  assert.equal((await req("POST", "/api/jarvis/approvals/session", { headers: withOrigin({ ...json, Host: `localhost:${port}` }), body })).status, 403, "Origin no coincide con Host");
  assert.equal((await req("POST", "/api/jarvis/approvals/session", { headers: withOrigin(json), body })).status, 200, "el intento legitimo sigue funcionando (el codigo no se gasto)");
});

test("desbloqueo: codigo ausente, invalido, caducado y reutilizado se rechazan", { skip }, async () => {
  const json = { "Content-Type": "application/json" };
  const post = (body) => req("POST", "/api/jarvis/approvals/session", { headers: withOrigin(json), body });
  burn();
  assert.equal((await post({ code: "AAAA-BBBB-CCCC-DDDD" })).status, 401, "sin codigo generado");
  assert.equal((await post({})).status, 400);
  assert.equal((await post({ code: 12345 })).status, 400);
  assert.equal((await req("POST", "/api/jarvis/approvals/session", { headers: withOrigin(json), body: "{no json" })).status, 400);

  const { code } = U.createUnlockCode(clock.t);
  assert.equal((await post({ code: "ZZZZ-ZZZZ-ZZZZ-ZZZZ" })).json.code, "bad_code");
  clock.t += U.UNLOCK_TTL_MS + 1;
  assert.equal((await post({ code })).status, 401, "caducado");
  clock.t -= U.UNLOCK_TTL_MS + 1;

  const fresh = U.createUnlockCode(clock.t).code;
  assert.equal((await post({ code: fresh })).status, 200);
  assert.equal((await post({ code: fresh })).status, 401, "un solo uso");
});

function burn() { U.burnUnlockCode(); }

test("desbloqueo: tras 5 fallos el codigo se invalida, tambien el correcto", { skip }, async () => {
  const json = { "Content-Type": "application/json" };
  const { code } = U.createUnlockCode(clock.t);
  let last;
  for (let i = 0; i < U.MAX_FAILED_ATTEMPTS; i++) last = await req("POST", "/api/jarvis/approvals/session", { headers: withOrigin(json), body: { code: `BAD${i}` } });
  assert.equal(last.status, 429);
  assert.equal(last.json.code, "locked_out");
  const right = await req("POST", "/api/jarvis/approvals/session", { headers: withOrigin(json), body: { code } });
  assert.equal(right.status, 401);
});

test("cookie de sesion: HttpOnly, SameSite=Strict, ruta acotada y sin token CSRF ni codigo", { skip }, async () => {
  const { code } = U.createUnlockCode(clock.t);
  const r = await req("POST", "/api/jarvis/approvals/session", { headers: withOrigin({ "Content-Type": "application/json" }), body: { code } });
  const cookie = r.headers["set-cookie"][0];
  assert.match(cookie, /^jarvis_appr=[0-9a-f]{64};/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Path=\/api\/jarvis\/approvals(;|$)/);
  assert.ok(!cookie.includes(r.json.csrfToken), "el token CSRF no va en la cookie");
  assert.ok(!r.text.includes(code.replaceAll("-", "")), "la respuesta no devuelve el codigo");
  assert.match(r.json.csrfToken, /^[0-9a-f]{64}$/);
  assert.equal(r.headers["cache-control"], "no-store");
});

test("el codigo en disco es solo un hash, con modo 600 fuera del repo", { skip }, () => {
  const { code } = U.createUnlockCode(clock.t);
  const file = U.unlockFile();
  const raw = fs.readFileSync(file, "utf8");
  assert.ok(!raw.includes(code) && !raw.includes(code.replaceAll("-", "")));
  assert.deepEqual(Object.keys(JSON.parse(raw)).sort(), ["createdAt", "expiresAt", "failed", "hash", "v"]);
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.ok(!file.startsWith(path.resolve(import.meta.dirname, "..", "..")), "no esta dentro del repo");
  U.burnUnlockCode();
});

test("decision: con cookie pero sin token CSRF, o con uno ajeno, se rechaza sin escribir", { skip }, async () => {
  const s = await unlock();
  const other = await unlock();
  const p = seed();
  const before = readApprovals();
  assert.equal((await req("POST", decideUrl(p.id, "approve"), { headers: withOrigin({ Cookie: s.cookie }) })).status, 403, "sin token");
  assert.equal((await req("POST", decideUrl(p.id, "approve"), { headers: withOrigin({ Cookie: s.cookie, "x-csrf-token": "x".repeat(64) }) })).status, 403, "token invalido");
  assert.equal((await req("POST", decideUrl(p.id, "approve"), { headers: withOrigin({ Cookie: s.cookie, "x-csrf-token": other.csrf }) })).status, 403, "token de otra sesion");
  assert.equal((await req("POST", decideUrl(p.id, "approve"), { headers: withOrigin({ "x-csrf-token": s.csrf }) })).status, 401, "token sin cookie");
  assert.equal((await req("POST", decideUrl(p.id, "approve"), { headers: withOrigin({ Cookie: `jarvis_appr=${"0".repeat(64)}`, "x-csrf-token": s.csrf }) })).status, 401, "cookie inventada");
  assert.equal(readApprovals(), before);
});

test("decision: con sesion valida, Origin ausente/ajeno o sin cabecera de la UI se rechaza", { skip }, async () => {
  const s = await unlock();
  const p = seed();
  const before = readApprovals();
  const base = { Cookie: s.cookie, "x-csrf-token": s.csrf };
  assert.equal((await req("POST", decideUrl(p.id, "approve"), { headers: { ...UI, ...base } })).status, 403, "sin Origin");
  assert.equal((await req("POST", decideUrl(p.id, "approve"), { headers: { ...UI, ...base, Origin: "http://localhost:8100" } })).status, 403, "Origin del frontend");
  assert.equal((await req("POST", decideUrl(p.id, "approve"), { headers: { ...UI, ...base, Origin: "null" } })).status, 403, "Origin null");
  assert.equal((await req("POST", decideUrl(p.id, "approve"), { headers: { Origin: origin, ...base } })).status, 403, "sin x-jarvis-ui");
  assert.equal((await req("POST", decideUrl(p.id, "approve"), { headers: { ...UI, ...base, Origin: origin, "Sec-Fetch-Site": "same-site" } })).status, 403, "same-site no es same-origin");
  assert.equal(readApprovals(), before);
});

test("decision: IDs invalidos (400) e inexistentes (404)", { skip }, async () => {
  const s = await unlock();
  for (const bad of ["xx", "apr_ZZZZZZZZZZ", "apr_12345", "apr_0123456789ab", "..%2f..%2fetc"]) {
    assert.equal((await req("POST", decideUrl(bad, "approve"), { headers: authed(s) })).status, 400, bad);
  }
  const r = await req("POST", decideUrl("apr_0000000000", "deny"), { headers: authed(s) });
  assert.equal(r.status, 404);
  assert.match(r.json.error, /No existe la solicitud apr_0000000000/);
});

test("aprobacion legitima: respuesta compatible, decision firmada y vigencia derivada", { skip }, async () => {
  const s = await unlock();
  const p = seed();
  const r = await req("POST", decideUrl(p.id, "approve"), { headers: authed(s), body: "{}" });
  assert.equal(r.status, 200, r.text);
  assert.deepEqual(Object.keys(r.json).sort(), ["decidedAt", "id", "ok", "status"]);
  assert.equal(r.json.ok, true);
  assert.equal(r.json.id, p.id);
  assert.equal(r.json.status, "approved");

  const dec = readApprovals().split("\n").filter(Boolean).map(JSON.parse).filter((l) => l.type === "decision" && l.id === p.id);
  assert.equal(dec.length, 1);
  assert.deepEqual(Object.keys(dec[0]).sort(), ["decidedAt", "decision", "fingerprint", "id", "sig", "type"], "formato persistido sin cambios");
  assert.equal(dec[0].decidedAt, r.json.decidedAt);
  const expected = crypto.createHmac("sha256", key).update(`${p.id}|${dec[0].fingerprint}|approved|${dec[0].decidedAt}`).digest("hex");
  assert.equal(dec[0].sig, expected, "firma HMAC verificable con la clave");
  assert.equal(A.listRequests().find((x) => x.id === p.id).lifecycle, "approved_unused");
  assert.equal(A.consumeApproval(p.id, p.tool, p.args).ok, true, "la aprobacion firmada por la API es consumible");
});

test("rechazo legitimo: queda denied y bloquea el consumo", { skip }, async () => {
  const s = await unlock();
  const p = seed();
  const r = await req("POST", decideUrl(p.id, "deny"), { headers: authed(s), body: "{}" });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.status, "denied");
  assert.equal(A.listRequests().find((x) => x.id === p.id).lifecycle, "denied");
  assert.equal(A.consumeApproval(p.id, p.tool, p.args).reason, "denegada por el humano");
});

test("409 coherentes por estado real; nada se escribe y ninguna se puede reactivar", { skip }, async () => {
  const s = await unlock();
  const casos = [
    { name: "approved vigente", opts: { decision: "approved", decidedAgoMs: 5 * MIN }, lifecycle: "approved_unused", re: /aprobada y vigente hasta \d{4}-\d{2}-\d{2}T/, no: /caduc/ },
    { name: "approved caducada", opts: { decision: "approved", decidedAgoMs: 31 * MIN }, lifecycle: "expired", re: /caduc[oó] el \d{4}-\d{2}-\d{2}T/, no: /ya esta approved|vigente/ },
    { name: "approved consumida", opts: { decision: "approved", decidedAgoMs: 5 * MIN, consumed: true }, lifecycle: "consumed", re: /utilizada/, no: /ya esta approved/ },
    { name: "denegada", opts: { decision: "denied" }, lifecycle: "denied", re: /denegada/, no: /approved/ },
  ];
  for (const c of casos) {
    const p = seed(c.opts);
    const before = readApprovals();
    for (const action of ["approve", "deny"]) {
      const r = await req("POST", decideUrl(p.id, action), { headers: authed(s), body: "{}" });
      assert.equal(r.status, 409, `${c.name} ${action}`);
      assert.match(r.json.error, c.re, `${c.name} ${action}`);
      assert.doesNotMatch(r.json.error, c.no, `${c.name} ${action}`);
      assert.equal(r.json.lifecycle, c.lifecycle);
      assert.equal(r.json.status, c.opts.decision);
      if (c.lifecycle !== "denied") assert.ok(r.json.expiresAt, "incluye expiresAt");
    }
    assert.equal(readApprovals(), before, `${c.name}: no se escribio nada`);
  }
});

test("una solicitud caducada ni se aprueba por la API ni se consume", { skip }, async () => {
  const s = await unlock();
  const p = seed({ decision: "approved", decidedAgoMs: 45 * MIN });
  const before = readApprovals();
  const consumedBefore = fs.existsSync(CONSUMED()) ? fs.readFileSync(CONSUMED(), "utf8") : "";
  assert.equal((await req("POST", decideUrl(p.id, "approve"), { headers: authed(s) })).status, 409);
  assert.equal((await req("POST", decideUrl(p.id, "deny"), { headers: authed(s) })).status, 409);
  assert.equal(A.consumeApproval(p.id, p.tool, p.args).reason, "aprobacion caducada");
  assert.throws(() => A.decide(p.id, "approved"), (e) => e.code === "NOT_PENDING" && e.lifecycle === "expired", "ni siquiera la libreria/CLI puede renovarla");
  assert.equal(readApprovals(), before);
  assert.equal(fs.existsSync(CONSUMED()) ? fs.readFileSync(CONSUMED(), "utf8") : "", consumedBefore, "no se marco como consumida");
  assert.equal(A.listRequests().find((x) => x.id === p.id).lifecycle, "expired");
});

test("la sesion caduca por inactividad y se puede bloquear explicitamente", { skip }, async () => {
  const s = await unlock();
  const p = seed();
  assert.equal((await req("GET", "/api/jarvis/approvals/session", { headers: { Cookie: s.cookie } })).json.csrfToken, s.csrf);

  clock.t += 14 * MIN; // dentro del limite: se renueva
  assert.equal((await req("GET", "/api/jarvis/approvals/session", { headers: { Cookie: s.cookie } })).json.unlocked, true);
  clock.t += 16 * MIN; // pasado el limite de inactividad
  assert.equal((await req("GET", "/api/jarvis/approvals/session", { headers: { Cookie: s.cookie } })).json.unlocked, false);
  assert.equal((await req("POST", decideUrl(p.id, "approve"), { headers: authed(s) })).status, 401);

  const s2 = await unlock();
  const lock = await req("POST", "/api/jarvis/approvals/session/lock", { headers: authed(s2) });
  assert.equal(lock.status, 200);
  assert.match(lock.headers["set-cookie"][0], /Max-Age=0/);
  assert.equal((await req("POST", decideUrl(p.id, "approve"), { headers: authed(s2) })).status, 401, "tras bloquear, la sesion ya no vale");
  assert.equal((await req("POST", "/api/jarvis/approvals/session/lock", { headers: withOrigin() })).status, 401, "bloquear tambien exige sesion");
});
