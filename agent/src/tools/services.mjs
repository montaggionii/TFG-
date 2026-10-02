import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import { z } from "zod";
import { defineTool, guard } from "./registry.mjs";
import { requireCapability } from "../lib/policy.mjs";
import { DATA_DIR, ensureDir, readJson } from "../lib/paths.mjs";
import { javaEnv } from "../lib/exec.mjs";
import { resolveDb, loadDotEnvKeys } from "../lib/env.mjs";
import { getStatus } from "../lib/status.mjs";
import { listRequests } from "../lib/approvals.mjs";

const REGISTRY = () => path.join(ensureDir(DATA_DIR), "services.json");

const DEFAULTS = {
  backend: { port: 8081, health: "/ping" },
  frontend: { port: 8100, health: "/" },
};

export function portOpen(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const s = net.connect({ port, host, timeout: 800 });
    s.once("connect", () => (s.destroy(), resolve(true)));
    s.once("error", () => resolve(false));
    s.once("timeout", () => (s.destroy(), resolve(false)));
  });
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

defineTool({
  name: "service_status",
  description: "Estado de los servicios de desarrollo (backend 8081, frontend 8100): si el puerto responde y si lo arranco el agente.",
  risk: "read",
  handler: async () => {
    const reg = readJson(REGISTRY(), {});
    const out = {};
    for (const [name, cfg] of Object.entries(DEFAULTS)) {
      const managed = reg[name];
      out[name] = { defaultPort: cfg.port, listening: await portOpen(managed?.port ?? cfg.port), managedByAgent: Boolean(managed && alive(managed.pid)), managedPort: managed?.port, pid: managed && alive(managed.pid) ? managed.pid : undefined };
    }
    return out;
  },
});

defineTool({
  name: "service_start",
  description:
    "Arranca el backend (./mvnw spring-boot:run con JDK 17 y la BD local) o el frontend (npm start) en segundo plano, con su log en agent/data/logs. Si el puerto ya esta ocupado NO lo toca (puede ser el entorno del usuario): usa otro puerto con 'port'. Solo en local.",
  risk: "exec",
  inputSchema: z.object({ service: z.enum(["backend", "frontend"]), port: z.number().int().min(1024).max(65535).optional(), wait_seconds: z.number().int().min(5).max(300).default(180) }),
  handler: async ({ service, port, wait_seconds }, ctx) => {
    await guard(ctx, "service_start", { service, port }, requireCapability(ctx.profile, "allowServiceControl"));
    const cfg = DEFAULTS[service];
    const p = port ?? cfg.port;
    if (await portOpen(p)) return `El puerto ${p} ya esta en uso (probablemente un servicio del usuario). No se ha arrancado nada. Para aislarte usa otro puerto (service_start con port) o usa el servicio existente.`;
    const logDir = ensureDir(path.join(DATA_DIR, "logs"));
    const logFile = path.join(logDir, `${service}.log`);
    const fd = fs.openSync(logFile, "w");
    let argv;
    let cwd;
    let env = {};
    if (service === "backend") {
      const db = resolveDb(ctx.profile);
      const dotenv = loadDotEnvKeys(["APP_JWT_SECRET", "APP_SEED_RESTAURANT_PASSWORD"]);
      argv = ["./mvnw", "-B", "spring-boot:run"];
      cwd = ctx.workRoot;
      env = {
        ...javaEnv(),
        SERVER_PORT: String(p),
        DB_URL: `jdbc:mysql://${db.host}:${db.port}/${db.name}?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true`,
        DB_USERNAME: db.user,
        DB_PASSWORD: db.password,
        ...dotenv,
      };
    } else {
      argv = ["npm", "start", "--", "--port", String(p), "--host", "127.0.0.1"];
      cwd = path.join(ctx.workRoot, "frontend");
    }
    const child = spawn(argv[0], argv.slice(1), { cwd, env: { ...process.env, ...env }, detached: true, stdio: ["ignore", fd, fd] });
    child.unref();
    const reg = readJson(REGISTRY(), {});
    reg[service] = { pid: child.pid, port: p, startedAt: new Date().toISOString(), log: path.relative(ctx.workRoot, logFile) };
    fs.writeFileSync(REGISTRY(), JSON.stringify(reg, null, 2));
    const deadline = Date.now() + wait_seconds * 1000;
    while (Date.now() < deadline) {
      if (!alive(child.pid)) return `El proceso de ${service} termino antes de abrir el puerto ${p}. Revisa inspect_logs(service="${service}").`;
      if (await portOpen(p)) return { started: true, service, port: p, pid: child.pid, bootSeconds: Math.round((Date.now() - Date.parse(reg[service].startedAt)) / 1000) };
      await new Promise((r) => setTimeout(r, 2000));
    }
    return `${service} sigue arrancando tras ${wait_seconds}s (pid ${child.pid}). Mira inspect_logs y service_status.`;
  },
});

defineTool({
  name: "service_stop",
  description: "Detiene un servicio arrancado por el agente con service_start (nunca toca procesos que no haya lanzado el agente).",
  risk: "exec",
  inputSchema: z.object({ service: z.enum(["backend", "frontend"]) }),
  handler: async ({ service }, ctx) => {
    await guard(ctx, "service_stop", { service }, requireCapability(ctx.profile, "allowServiceControl"));
    const reg = readJson(REGISTRY(), {});
    const entry = reg[service];
    if (!entry || !alive(entry.pid)) return `No hay un ${service} gestionado por el agente en ejecucion.`;
    const signal = (sig) => {
      try {
        process.kill(-entry.pid, sig);
      } catch {
        try {
          process.kill(entry.pid, sig);
        } catch {
          /* ya habia terminado */
        }
      }
    };
    signal("SIGTERM");
    let closed = false;
    for (let i = 0; i < 20 && !closed; i++) {
      closed = !(await portOpen(entry.port));
      if (!closed) await new Promise((r) => setTimeout(r, 1000));
    }
    if (!closed) signal("SIGKILL");
    delete reg[service];
    fs.writeFileSync(REGISTRY(), JSON.stringify(reg, null, 2));
    return closed ? `${service} detenido (pid ${entry.pid}); el puerto ${entry.port} esta libre.` : `${service} no cerro en 20 s: se forzo SIGKILL (pid ${entry.pid}).`;
  },
});

defineTool({
  name: "agent_status",
  description: "Estado real del agente: tarea, operacion actual, rama, archivos cambiados, tests, errores, tokens/coste, tiempo y aprobaciones pendientes.",
  risk: "read",
  handler: async () => ({ ...getStatus(), pendingApprovals: listRequests().filter((r) => r.status === "pending").map((r) => ({ id: r.id, tool: r.tool, reason: r.reason, requestedAt: r.requestedAt })) }),
});
