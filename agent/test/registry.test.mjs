import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

// Repo git temporal + datos/clave temporales: la prueba ejecuta la puerta de
// permisos REAL (politica -> aprobacion firmada -> ejecucion -> auditoria).
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ff-reg-"));
const repo = path.join(tmp, "repo");
fs.mkdirSync(repo);
const git = (...a) => execFileSync("git", a, { cwd: repo, encoding: "utf8" });
git("init", "-q", "-b", "main");
git("config", "user.email", "t@t.t");
git("config", "user.name", "t");
fs.writeFileSync(path.join(repo, "README.md"), "hola\n");
fs.writeFileSync(path.join(repo, ".env"), "DB_PASSWORD=NoLoLeasNunca123\n");
git("add", "-A");
git("commit", "-qm", "init");

process.env.AGENT_REPO_ROOT = repo;
process.env.AGENT_DATA_DIR = path.join(tmp, "data");
process.env.AGENT_APPROVAL_KEY_FILE = path.join(tmp, "key", "approval.key");
process.env.AGENT_ENV = "local";

let M;
let A;
let ctx;
before(async () => {
  M = await import("../src/tools/index.mjs");
  A = await import("../src/lib/approvals.mjs");
  ctx = M.createContext({ agent: "test" });
});

const call = (name, args) => M.invokeTool(name, args, ctx);

test("lectura: permite codigo y bloquea .env", async () => {
  assert.equal((await call("read_file", { path: "README.md" })).ok, true);
  const env = await call("read_file", { path: ".env" });
  assert.equal(env.status, "denied");
  assert.ok(!JSON.stringify(env).includes("NoLoLeasNunca"));
  assert.equal((await call("read_file", { path: "../../etc/passwd" })).status, "denied");
});

test("escritura: exige rama agent/*, no pisa trabajo humano, protege rutas", async () => {
  assert.equal((await call("write_file", { path: "a.txt", content: "x" })).status, "denied", "en main esta prohibido");
  const br = await call("git_create_branch", { name: "agent/prueba" });
  assert.equal(br.ok, true, JSON.stringify(br));
  assert.equal((await call("git_create_branch", { name: "feature/mal" })).status, "invalid_arguments");
  assert.equal((await call("write_file", { path: "a.txt", content: "x" })).ok, true);
  assert.equal((await call("write_file", { path: ".env", content: "x" })).status, "denied");
  assert.equal((await call("write_file", { path: ".git/config", content: "x" })).status, "denied");
  assert.equal((await call("write_file", { path: "agent/config/policy.json", content: "{}" })).status, "denied");

  // trabajo humano sin commitear en README.md: el agente no puede sobrescribirlo sin aprobacion
  fs.writeFileSync(path.join(repo, "README.md"), "cambio humano sin commitear\n");
  const clash = await call("write_file", { path: "README.md", content: "pisado" });
  assert.equal(clash.status, "approval_required");
  assert.equal(fs.readFileSync(path.join(repo, "README.md"), "utf8"), "cambio humano sin commitear\n");
});

test("commit: solo archivos pedidos y solo en agent/*", async () => {
  fs.writeFileSync(path.join(repo, "otro.txt"), "no pedido");
  const ok = await call("git_commit", { message: "feat: anade a.txt de prueba", files: ["a.txt"] });
  assert.equal(ok.ok, true, JSON.stringify(ok));
  assert.match(git("status", "--porcelain"), /otro\.txt/, "el archivo no pedido sigue sin commitear");
  const protectedFile = await call("git_commit", { message: "intento commitear .env", files: [".env"] });
  assert.equal(protectedFile.status, "denied");
  git("switch", "-q", "main");
  const onMain = await call("git_commit", { message: "commit en main prohibido", files: ["otro.txt"] });
  assert.equal(onMain.ok, false);
  git("switch", "-q", "agent/prueba");
});

test("aprobacion humana de extremo a extremo con run_command", async () => {
  const args = { command: "ls /etc", cwd: ".", timeout_seconds: 120 };
  const first = await call("run_command", { command: "ls /etc" });
  assert.equal(first.status, "approval_required");
  const id = first.approval_id;
  assert.equal((await call("run_command", { command: "ls /etc", approval_id: id })).status, "approval_required", "pendiente: aun no vale");
  A.decide(id, "approved"); // lo que hace una persona con el CLI
  const withWrongArgs = await call("run_command", { command: "ls /var", approval_id: id });
  assert.equal(withWrongArgs.status, "approval_required", "no vale para otra accion");
  const done = await call("run_command", { command: "ls /etc", approval_id: id });
  assert.equal(done.ok, true, JSON.stringify(done));
  assert.equal((await call("run_command", { command: "ls /etc", approval_id: id })).status, "approval_required", "un solo uso");
  void args;
});

test("comandos peligrosos no se ejecutan", async () => {
  assert.equal((await call("run_command", { command: "git push origin main" })).status, "approval_required");
  assert.equal((await call("run_command", { command: "sudo ls" })).status, "denied");
  assert.equal((await call("run_command", { command: "ls; id" })).status, "denied");
  assert.equal((await call("run_command", { command: "git status --short" })).ok, true);
});

test("BD: DDL/DML nunca pasa por query_database y execute exige backup + aprobacion", async () => {
  assert.equal((await call("query_database", { sql: "DROP TABLE usuarios" })).status, "denied");
  assert.equal((await call("query_database", { sql: "SELECT 1; SELECT 2" })).status, "denied");
  const noBackup = await call("execute_database_statement", { sql: "DELETE FROM usuarios", reason: "limpieza de prueba de tests" });
  assert.equal(noBackup.status, "denied");
  assert.match(noBackup.error, /backup/i);
  const withBackup = await call("execute_database_statement", { sql: "DELETE FROM usuarios", reason: "limpieza de prueba de tests", backup_confirmed: true });
  assert.equal(withBackup.status, "approval_required");
});

test("argumentos invalidos se rechazan sin ejecutar nada", async () => {
  const r = await call("run_maven", { goals: ["test; rm -rf /"] });
  assert.equal(r.status, "invalid_arguments");
  assert.equal((await call("herramienta_inexistente", {})).ok, false);
});

test("la auditoria registra cada llamada sin secretos", async () => {
  await call("run_command", { command: "echo sk-abcdefghijklmnopqrstuvwxyz123456" });
  const dir = path.join(process.env.AGENT_DATA_DIR, "audit");
  const text = fs.readdirSync(dir).map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join("\n");
  const lines = text.split("\n").filter(Boolean).map((l) => JSON.parse(l));
  assert.ok(lines.length >= 10);
  assert.ok(lines.every((l) => l.tool && l.ts && l.runId && l.env === "local"));
  assert.ok(!text.includes("sk-abcdefghijklmnopqrst"));
  assert.ok(lines.some((l) => l.decision === "approved_by_human"));
  assert.ok(lines.some((l) => l.decision === "deny"));
});
