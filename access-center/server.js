import express from "express";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_PATH = path.join(__dirname, "..");

// Carga las mismas variables de entorno que usa el backend (fuente única).
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const PORT = process.env.ACCESS_CENTER_PORT || 5757;
const HOST = "127.0.0.1"; // nunca 0.0.0.0 — solo local

const DB_HOST = "localhost";
const DB_PORT = 3306;
const DB_NAME = "proyectoTFG";
const DB_USER = process.env.DB_USERNAME || "fidelyfood_app";
const DB_PASSWORD = process.env.DB_PASSWORD || "";

const BACKEND_URL = "http://localhost:8081";
const FRONTEND_URL = "http://localhost:8100";

// Contraseñas en texto plano SOLO cuando existen realmente (variable de
// entorno o valor por defecto ya presente en el código fuente del proyecto).
// Para cualquier otra cuenta, la contraseña real está hasheada con BCrypt en
// la base de datos y NO es recuperable — se marca explícitamente como tal.
const ADMIN_EMAIL = process.env.FIDELYFOOD_ADMIN_EMAIL || "admin@fidelyfood.local";
const ADMIN_PASSWORD = process.env.FIDELYFOOD_ADMIN_PASSWORD || "admin123"; // default real en AuthController.java
const SEED_RESTAURANT_PASSWORD = process.env.APP_SEED_RESTAURANT_PASSWORD || null;

const SEEDED_RESTAURANT_EMAILS = new Set([
  "alabroster@test.com",
  "venezuelafood@gmail.com",
  "mexicanfood@fidelyfood.local",
]);

function knownPasswordFor(email, role) {
  if (role === "ADMIN" && email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    return { password: ADMIN_PASSWORD, origen: "Valor por defecto en AuthController.java (fidelyfood.admin.password)" };
  }
  if (role === "RESTAURANTE" && SEEDED_RESTAURANT_EMAILS.has(email.toLowerCase()) && SEED_RESTAURANT_PASSWORD) {
    return { password: SEED_RESTAURANT_PASSWORD, origen: "Variable de entorno APP_SEED_RESTAURANT_PASSWORD (.env local)" };
  }
  return { password: null, origen: null };
}

// MySQL devuelve las columnas bit(1) como Buffer (ej. <Buffer 01>), no como
// número — hay que interpretarlas explícitamente.
function isActive(value) {
  if (value === null || value === undefined) return true; // sin dato = se asume activo
  if (Buffer.isBuffer(value)) return value[0] === 1;
  if (typeof value === "boolean") return value;
  return Number(value) === 1;
}

async function getConnection() {
  return mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD,
  });
}

async function fetchAccounts() {
  const conn = await getConnection();
  try {
    const [restaurantes] = await conn.query(
      "SELECT id, nombre, email, active, created_at, foto FROM restaurantes ORDER BY id"
    );
    const [usuarios] = await conn.query(
      "SELECT id, nombre, email, role, active, created_at FROM usuarios ORDER BY id"
    );

    const accounts = [];

    for (const r of restaurantes) {
      const isSeeded = SEEDED_RESTAURANT_EMAILS.has(r.email.toLowerCase());
      const known = knownPasswordFor(r.email, "RESTAURANTE");
      accounts.push({
        id: `restaurante-${r.id}`,
        dbId: r.id,
        categoria: "RESTAURANTE",
        nombre: r.nombre,
        email: r.email,
        password: known.password,
        origenPassword: known.origen || "Solo hash BCrypt en BD — contraseña no disponible",
        rol: "ROLE_RESTAURANT",
        estado: isActive(r.active) ? "ACTIVO" : "INACTIVO",
        entorno: "Local (proyectoTFG)",
        url: `${FRONTEND_URL}/login`,
        descripcion: isSeeded
          ? "Restaurante histórico reconstruido (ver .agent/discoveries.md)"
          : "Restaurante en base de datos",
        origenCuenta: isSeeded ? "Reconstruido (HistoricalRestaurantSeeder)" : "Base de datos",
        creadoEn: r.created_at,
      });
    }

    for (const u of usuarios) {
      const role = u.role || "ROLE_USER";
      const categoria = role === "ROLE_ADMIN" ? "ADMINISTRADOR" : "CLIENTE";
      const known = knownPasswordFor(u.email, categoria === "ADMINISTRADOR" ? "ADMIN" : "CLIENTE");
      accounts.push({
        id: `usuario-${u.id}`,
        dbId: u.id,
        categoria,
        nombre: u.nombre,
        email: u.email,
        password: known.password,
        origenPassword: known.origen || "Solo hash BCrypt en BD — contraseña no disponible",
        rol: role,
        estado: isActive(u.active) ? "ACTIVO" : "INACTIVO",
        entorno: "Local (proyectoTFG)",
        url: `${FRONTEND_URL}/login`,
        descripcion: "Usuario en base de datos",
        origenCuenta: "Base de datos",
        creadoEn: u.created_at,
      });
    }

    // Cuenta de administrador: no existe como fila en la tabla `usuarios`
    // (el login admin es un endpoint especial en AuthController que compara
    // contra la variable de entorno, no contra una fila de BD).
    const adminYaEnLista = accounts.some(
      (a) => a.categoria === "ADMINISTRADOR" && a.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()
    );
    if (!adminYaEnLista) {
      accounts.unshift({
        id: "admin-virtual",
        dbId: null,
        categoria: "ADMINISTRADOR",
        nombre: "Administrador FidelyFood",
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        origenPassword: "Valor por defecto en AuthController.java (fidelyfood.admin.password)",
        rol: "ROLE_ADMIN",
        estado: "ACTIVO",
        entorno: "Local (proyectoTFG)",
        url: `${FRONTEND_URL}/admin/login`,
        descripcion: "Login de administrador vía endpoint especial /api/auth/login-admin (no es una fila de la tabla usuarios)",
        origenCuenta: "Código (AuthController.java)",
        creadoEn: null,
      });
    }

    return accounts;
  } finally {
    await conn.end();
  }
}

const app = express();
app.use(express.json());

// CORS solo para el frontend local de FidelyFood (necesario para que
// AgentStateService pueda hacer POST aquí desde el navegador). Sigue sin
// exponerse nada fuera de este Mac: el servidor entero solo escucha en
// 127.0.0.1, esto únicamente permite que otro puerto de localhost lo llame.
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", FRONTEND_URL);
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.static(path.join(__dirname, "public")));

// --- Puente de estado del Agent Widget (frontend -> aquí -> widget de escritorio) ---
// El AgentWidgetComponent (frontend Angular) hace POST aquí cada vez que su
// estado cambia. El widget de escritorio (Übersicht) hace GET aquí para
// mostrar la misma actividad en tiempo real fuera del navegador. Solo
// guarda el último snapshot en memoria — no hay persistencia ni historial
// aquí (el historial completo vive en el propio AgentStateService del
// frontend, ver .../core/agent/agent-state.service.ts).
let lastAgentState = null;

app.post("/api/agent-state", (req, res) => {
  lastAgentState = { ...req.body, receivedAt: new Date().toISOString() };
  res.json({ ok: true });
});

app.get("/api/agent-state", (req, res) => {
  if (!lastAgentState) {
    return res.json({ status: "UNKNOWN", message: "Sin datos todavía — abre el panel admin de FidelyFood en el navegador." });
  }
  res.json(lastAgentState);
});

// --- Eventos reales del agente (Claude Code) vía hooks ---
// Cada evento llega desde .claude/hooks/emit-event.sh, disparado por los
// hooks PreToolUse/PostToolUse/Stop reales de esta sesión — nunca simulado.
// Solo se guarda en memoria (se pierde al reiniciar el proceso), con un
// límite de tamaño para no crecer indefinidamente.
const MAX_EVENTS = 300;
let agentEvents = [];
let agentMetrics = resetMetrics();

function resetMetrics() {
  return {
    date: new Date().toISOString().slice(0, 10),
    tasksCompleted: 0,
    testsPassed: 0,
    testsFailed: 0,
    bugsDetected: 0,
    bugsFixed: 0,
    filesChanged: 0,
    builds: 0,
    securityIssues: 0,
  };
}

function ensureTodayMetrics() {
  const today = new Date().toISOString().slice(0, 10);
  if (agentMetrics.date !== today) {
    agentMetrics = resetMetrics();
  }
}

const METRIC_BY_EVENT = {
  TASK_COMPLETED: "tasksCompleted",
  TEST_PASSED: "testsPassed",
  TEST_FAILED: "testsFailed",
  BUG_FOUND: "bugsDetected",
  BUG_FIXED: "bugsFixed",
  FILE_MODIFIED: "filesChanged",
  BUILD_PASSED: "builds",
  BUILD_FAILED: "builds",
  SECURITY_ISSUE_FOUND: "securityIssues",
};

// Nunca hay que reenviar contenido crudo de comandos/archivos (podría
// contener secretos). Solo se aceptan campos ya resumidos/sanitizados por
// el propio script del hook.
function sanitizeEvent(body) {
  const pick = (v, max = 300) => (typeof v === "string" ? v.slice(0, max) : null);
  return {
    type: pick(body.type, 60) || "UNKNOWN",
    tool: pick(body.tool, 60),
    file: pick(body.file, 300),
    detail: pick(body.detail, 300),
    ts: new Date().toISOString(),
  };
}

// El widget consulta esto varias veces por segundo. `git status` puede
// tomar brevemente el índice de git (.git/index.lock) — sin un mínimo de
// espera entre llamadas reales, esas consultas tan frecuentes podrían
// chocar justo con un comando git tuyo en curso. Se cachea el resultado
// unos segundos para no ejecutar `git status` más rápido de lo necesario.
let modifiedFilesCache = null;
let modifiedFilesCacheAt = 0;
const MODIFIED_FILES_TTL_MS = 3000;

function currentModifiedFiles(cb) {
  const now = Date.now();
  if (modifiedFilesCache && now - modifiedFilesCacheAt < MODIFIED_FILES_TTL_MS) {
    return cb(modifiedFilesCache);
  }
  execFile("git", ["status", "--porcelain"], { cwd: REPO_PATH, timeout: 3000 }, (err, stdout) => {
    if (err) return cb(modifiedFilesCache || []);
    const files = stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.replace(/^[MADRCU?!]{1,2}\s+/, ""));
    modifiedFilesCache = files;
    modifiedFilesCacheAt = now;
    cb(files);
  });
}

app.post("/api/agent-events", (req, res) => {
  ensureTodayMetrics();
  const event = sanitizeEvent(req.body || {});

  const metricKey = METRIC_BY_EVENT[event.type];
  if (metricKey) agentMetrics[metricKey] += 1;

  const finish = (conflict) => {
    event.conflict = conflict;
    agentEvents.push(event);
    if (agentEvents.length > MAX_EVENTS) agentEvents = agentEvents.slice(-MAX_EVENTS);
    res.json({ ok: true, conflict });
  };

  // Detección real de conflicto: si el archivo que el agente está a punto
  // de tocar aparece en el `git status` real de este repo (trabajo tuyo sin
  // commitear), se marca el evento como conflicto — el agente debe frenar
  // en ese archivo (esto lo decide el propio Claude durante la sesión, el
  // servidor solo reporta el hecho verificado).
  if (event.file && (event.type === "PRE_TOOL_USE" || event.type === "FILE_ANALYZING")) {
    currentModifiedFiles((files) => {
      const conflict = files.some((f) => event.file.endsWith(f) || f.endsWith(event.file));
      finish(conflict);
    });
  } else {
    finish(false);
  }
});

app.get("/api/agent-events", (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, MAX_EVENTS);
  res.json({ events: agentEvents.slice(-limit).reverse() });
});

app.get("/api/agent-metrics", (req, res) => {
  ensureTodayMetrics();
  res.json(agentMetrics);
});

// --- "MY WORK" real: qué estás haciendo tú, leído directamente de git ---
app.get("/api/my-work", (req, res) => {
  execFile("git", ["branch", "--show-current"], { cwd: REPO_PATH, timeout: 3000 }, (err, branchOut) => {
    const branch = err ? null : branchOut.trim();
    currentModifiedFiles((files) => {
      res.json({ branch, modifiedFiles: files, checkedAt: new Date().toISOString() });
    });
  });
});

// --- Jarvis (Agent Layer): estado REAL leido de agent/data, solo lectura ---
// Lo escriben el servidor MCP y el runner (agent/src). Aqui no se simula
// nada: si el agente no ha corrido, se devuelve vacio.
const AGENT_DATA = path.join(REPO_PATH, "agent", "data");

function readJsonSafe(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function readJsonl(file) {
  try {
    return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

function buildJarvis() {
  const status = readJsonSafe(path.join(AGENT_DATA, "status.json"), null);

  const approvalLines = readJsonl(path.join(AGENT_DATA, "approvals.jsonl"));
  const decided = new Map(approvalLines.filter((l) => l.type === "decision").map((l) => [l.id, l.decision]));
  const pendingApprovals = approvalLines
    .filter((l) => l.type === "request" && !decided.has(l.id))
    .map((l) => ({ id: l.id, tool: l.tool, reason: l.reason, summary: l.summary, requestedAt: l.requestedAt }));

  let audit = [];
  try {
    const dir = path.join(AGENT_DATA, "audit");
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl")).sort().reverse().slice(0, 2);
    for (const f of files) audit = audit.concat(readJsonl(path.join(dir, f)).reverse());
  } catch {
    audit = [];
  }
  const today = new Date().toISOString().slice(0, 10);
  const todays = audit.filter((a) => String(a.ts).startsWith(today));
  const byDecision = {};
  const byTool = {};
  for (const a of todays) {
    byDecision[a.decision] = (byDecision[a.decision] || 0) + 1;
    byTool[a.tool] = (byTool[a.tool] || 0) + 1;
  }
  const topTools = Object.entries(byTool).sort((a, b) => b[1] - a[1]).slice(0, 8);

  let runs = [];
  try {
    const dir = path.join(AGENT_DATA, "runs");
    runs = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => readJsonSafe(path.join(dir, f), null))
      .filter(Boolean)
      .sort((a, b) => String(b.finishedAt).localeCompare(String(a.finishedAt)))
      .slice(0, 8)
      .map((r) => ({ runId: r.runId, finishedAt: r.finishedAt, task: r.task, stopReason: r.stopReason, model: `${r.provider}/${r.model}`, steps: r.steps, tokens: r.tokens, estimatedCostUsd: r.estimatedCostUsd, testsPassed: r.testsPassed, testsFailed: r.testsFailed }));
  } catch {
    runs = [];
  }

  return {
    hasData: Boolean(status),
    status,
    pendingApprovals,
    recentToolCalls: audit.slice(0, 25).map((a) => ({ ts: a.ts, tool: a.tool, decision: a.decision, ok: a.ok, durationMs: a.durationMs, error: a.error || null })),
    today: { calls: todays.length, byDecision, topTools },
    recentRuns: runs,
    readAt: new Date().toISOString(),
  };
}

app.get("/api/jarvis", (req, res) => res.json(buildJarvis()));

// --- Oficina de Agentes: datos REALES para la vista isometrica ---
// Mezcla el audit del Agent Layer, los eventos de hooks de Claude Code y
// las tareas de AGENT_TASKS.md. Nada simulado: sin actividad, listas vacias.
function parseAgentTasks() {
  try {
    const text = fs.readFileSync(path.join(REPO_PATH, "AGENT_TASKS.md"), "utf8");
    const s = text.indexOf("<!-- TASKS:START -->");
    const e = text.indexOf("<!-- TASKS:END -->");
    if (s < 0 || e < s) return [];
    return text
      .slice(s, e)
      .split(/^### (?=AGT-\d+)/m)
      .slice(1)
      .map((part) => {
        const [titleLine, ...rest] = part.split("\n");
        const body = rest.join("\n");
        const field = (name) => {
          const m = body.match(new RegExp("^- \\*\\*" + name + ":\\*\\*\\s?(.*)$", "m"));
          return m ? m[1].trim() : "";
        };
        const dash = (v) => (v === "—" ? "" : v);
        return {
          id: (titleLine.match(/^AGT-\d+/) || [""])[0],
          title: titleLine.replace(/^AGT-\d+\s*[·-]\s*/, "").trim(),
          area: field("Área").toLowerCase(),
          priority: field("Prioridad"),
          state: field("Estado"),
          description: field("Descripción"),
          files: dash(field("Archivos afectados")),
          deps: dash(field("Dependencias")),
          acceptance: field("Criterios de aceptación"),
          tests: field("Tests necesarios"),
          result: dash(field("Resultado")),
        };
      });
  } catch {
    return [];
  }
}

app.get("/api/oficina", (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  let audit = [];
  try {
    const dir = path.join(AGENT_DATA, "audit");
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl")).sort().reverse().slice(0, 2);
    for (const f of files) audit = audit.concat(readJsonl(path.join(dir, f)));
  } catch {
    audit = [];
  }
  const activity = [
    ...audit.slice(-400).map((a) => ({ ts: a.ts, tool: a.tool, decision: a.decision, ok: a.ok, source: "agent-layer" })),
    ...agentEvents.map((ev) => ({ ts: ev.ts, tool: ev.tool, file: ev.file, type: ev.type, source: "claude-code" })),
  ].filter((a) => a.tool);

  const approvalLines = readJsonl(path.join(AGENT_DATA, "approvals.jsonl"));
  const decided = new Set(approvalLines.filter((l) => l.type === "decision").map((l) => l.id));
  const pendingApprovals = approvalLines
    .filter((l) => l.type === "request" && !decided.has(l.id))
    .map((l) => ({ id: l.id, tool: l.tool, reason: l.reason }));

  let brainNotes = 0;
  try {
    brainNotes = fs.readFileSync(path.join(REPO_PATH, ".agent", "memory.jsonl"), "utf8").split("\n").filter(Boolean).length;
  } catch {
    brainNotes = 0;
  }

  res.json({
    today,
    activity,
    pendingApprovals,
    tasks: parseAgentTasks(),
    brainNotes,
    agentStatus: readJsonSafe(path.join(AGENT_DATA, "status.json"), null),
    jarvis: buildJarvis(),
    readAt: new Date().toISOString(),
  });
});

app.get("/api/accounts", async (req, res) => {
  try {
    const accounts = await fetchAccounts();
    res.json({
      accounts,
      sourcedAt: new Date().toISOString(),
      source: `MySQL ${DB_HOST}:${DB_PORT}/${DB_NAME} + .env (${path.join(__dirname, "..", ".env")})`,
      urls: { backend: BACKEND_URL, frontend: FRONTEND_URL },
    });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

app.get("/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, HOST, () => {
  console.log(`FidelyFood Access Center: http://localhost:${PORT}  (solo ${HOST}, no accesible desde fuera de este Mac)`);
});
