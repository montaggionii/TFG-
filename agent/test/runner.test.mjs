import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ff-run-"));
const repo = path.join(tmp, "repo");
fs.mkdirSync(path.join(repo, "skills", "fidelyfood", "backend"), { recursive: true });
const git = (...a) => execFileSync("git", a, { cwd: repo, encoding: "utf8" });
git("init", "-q", "-b", "main");
git("config", "user.email", "t@t.t");
git("config", "user.name", "t");
fs.writeFileSync(path.join(repo, "AGENTS.md"), "# Proyecto de prueba\n");
fs.writeFileSync(path.join(repo, "skills", "fidelyfood", "backend", "SKILL.md"), "# Skill backend\n\n## Propósito\n\nTrabajar en el backend.\n\n## Otro\n");
fs.writeFileSync(path.join(repo, "AGENT_TASKS.md"), `# Tareas\n\n<!-- TASKS:START -->\n\n### AGT-001 · Anadir fichero de notas\n- **ID:** AGT-001\n- **Descripción:** Crear NOTAS.md con una linea\n- **Prioridad:** P2\n- **Área:** documentation\n- **Estado:** TODO\n- **Dependencias:** —\n- **Archivos afectados:** NOTAS.md\n- **Criterios de aceptación:** El archivo existe\n- **Tests necesarios:** ninguno\n- **Resultado:** —\n\n<!-- TASKS:END -->\n`);
git("add", "-A");
git("commit", "-qm", "init");

process.env.AGENT_REPO_ROOT = repo;
process.env.AGENT_DATA_DIR = path.join(tmp, "data");
process.env.AGENT_APPROVAL_KEY_FILE = path.join(tmp, "key", "approval.key");
process.env.AGENT_ENV = "local";

let R;
let M;
let T;
before(async () => {
  R = await import("../src/runner/run.mjs");
  M = await import("../src/tools/index.mjs");
  T = await import("../src/lib/tasks.mjs");
});

function scripted(turns) {
  let i = 0;
  const seen = [];
  return {
    name: "fake",
    model: "fake-1",
    pricePerMTok: { input: null, output: null },
    seen,
    async complete({ messages, system }) {
      seen.push({ n: messages.length, system });
      const t = turns[Math.min(i++, turns.length - 1)];
      return { text: t.text ?? "", toolCalls: (t.calls ?? []).map((c, k) => ({ id: `id${i}_${k}`, ...c })), usage: { input: 100, output: 20 }, stopReason: "x" };
    },
  };
}

const mkctx = () => M.createContext({ agent: "test-runner", model: "fake-1", provider: "fake" });

test("tarea de extremo a extremo con herramientas reales: rama, edicion, commit, REVIEW, changelog", async () => {
  const provider = scripted([
    { calls: [{ name: "git_status", args: {} }, { name: "read_skill", args: { name: "backend" } }, { name: "task_update", args: { id: "AGT-001", status: "IN_PROGRESS" } }] },
    { calls: [{ name: "git_create_branch", args: { name: "agent/notas" } }] },
    { calls: [{ name: "write_file", args: { path: "NOTAS.md", content: "Notas del agente\n" } }] },
    { calls: [{ name: "git_commit", args: { message: "docs: anade NOTAS.md", files: ["NOTAS.md"] } }] },
    { calls: [{ name: "task_update", args: { id: "AGT-001", status: "DONE" } }] },
    { calls: [{ name: "task_update", args: { id: "AGT-001", status: "REVIEW", result: "NOTAS.md creado y commiteado" } }] },
    { text: "Hecho: creado NOTAS.md. Tests: no aplican. Riesgos: ninguno." },
  ]);
  const report = await R.runAgent({ provider, ctx: mkctx(), taskId: "AGT-001", log: () => {} });
  assert.equal(report.stopReason, "completed");
  assert.equal(R.EXIT[report.stopReason], 0);
  assert.equal(fs.readFileSync(path.join(repo, "NOTAS.md"), "utf8"), "Notas del agente\n");
  assert.match(git("log", "-1", "--pretty=%s"), /anade NOTAS\.md/);
  assert.equal(git("branch", "--show-current").trim(), "agent/notas");
  const task = T.parseTasks(repo)[0];
  assert.equal(task["Estado"], "REVIEW", "el agente no puede cerrar en DONE");
  assert.equal(task["Resultado"], "NOTAS.md creado y commiteado");
  assert.equal(report.toolCalls.task_update, 3);
  assert.equal(report.toolErrors, 1, "el intento de DONE fue rechazado");
  assert.equal(report.tokens.input, 700);
  assert.ok(report.filesChanged.includes("NOTAS.md"));
  const changelog = fs.readFileSync(path.join(repo, "CHANGELOG_AGENT.md"), "utf8");
  assert.match(changelog, /AGT-001 · completed/);
  assert.match(changelog, /fake\/fake-1/);
  assert.ok(fs.existsSync(path.join(process.env.AGENT_DATA_DIR, "runs", `${report.runId}.json`)));
  const sys = provider.seen[0].system;
  assert.match(sys, /Skill|backend: Trabajar en el backend/);
  assert.match(sys, /Proyecto de prueba/);
  assert.ok(JSON.parse(fs.readFileSync(path.join(process.env.AGENT_DATA_DIR, "status.json"), "utf8")).agentStatus === "IDLE");
});

test("se detiene en una operacion que necesita decision humana y no la rodea", async () => {
  const provider = scripted([
    { calls: [{ name: "run_command", args: { command: "git push origin main" } }] },
    { calls: [{ name: "git_status", args: {} }] },
  ]);
  const report = await R.runAgent({ provider, ctx: mkctx(), prompt: "sube los cambios", log: () => {} });
  assert.equal(report.stopReason, "approval_required");
  assert.equal(R.EXIT.approval_required, 3);
  assert.match(report.blocked.approvalId, /^apr_/);
  assert.equal(report.steps, 1, "no siguio trabajando tras el bloqueo");
  assert.match(fs.readFileSync(path.join(repo, "CHANGELOG_AGENT.md"), "utf8"), /Bloqueado esperando aprobacion humana/);
});

test("detecta bucles de llamadas identicas y para", async () => {
  const provider = scripted([{ calls: [{ name: "git_log", args: { limit: 2 } }] }]);
  const report = await R.runAgent({ provider, ctx: mkctx(), prompt: "x", log: () => {} });
  assert.equal(report.stopReason, "loop_detected");
  assert.ok(report.steps <= 5);
});

test("respeta el presupuesto de pasos, tokens y errores consecutivos", async () => {
  let n = 0;
  const varied = { name: "fake", model: "m", pricePerMTok: {}, async complete() { n++; return { text: "", toolCalls: [{ id: `x${n}`, name: "git_log", args: { limit: n } }], usage: { input: 10, output: 1 }, stopReason: "x" }; } };
  assert.equal((await R.runAgent({ provider: varied, ctx: mkctx(), prompt: "x", budgets: { maxSteps: 3 }, log: () => {} })).stopReason, "max_steps");
  assert.equal((await R.runAgent({ provider: varied, ctx: mkctx(), prompt: "x", budgets: { maxTotalTokens: 25, maxSteps: 50 }, log: () => {} })).stopReason, "token_budget");
  const failing = scripted([{ calls: [{ name: "read_file", args: { path: "no-existe-1.txt" } }] }, { calls: [{ name: "read_file", args: { path: "no-existe-2.txt" } }] }, { calls: [{ name: "read_file", args: { path: "no-existe-3.txt" } }] }]);
  const rep = await R.runAgent({ provider: failing, ctx: mkctx(), prompt: "x", budgets: { loopDetection: { identicalToolCalls: 9, consecutiveErrors: 2 } }, log: () => {} });
  assert.equal(rep.stopReason, "repeated_errors");
});

test("un fallo del proveedor termina la ejecucion limpiamente y sin secretos", async () => {
  const broken = { name: "fake", model: "m", pricePerMTok: {}, async complete() { throw new Error("HTTP 401 con clave sk-abcdefghijklmnopqrstuvwxyz123456"); } };
  const report = await R.runAgent({ provider: broken, ctx: mkctx(), prompt: "x", log: () => {} });
  assert.equal(report.stopReason, "provider_error");
  assert.ok(!report.summary.includes("sk-abcdefghijklmnop"));
});
