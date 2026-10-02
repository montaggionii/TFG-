import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ff-appr-"));
process.env.AGENT_DATA_DIR = path.join(tmp, "data");
process.env.AGENT_APPROVAL_KEY_FILE = path.join(tmp, "key", "approval.key");

let A;
let policy;
before(async () => {
  A = await import("../src/lib/approvals.mjs");
  policy = (await import("../src/lib/policy.mjs")).policy;
});

const args = { command: "ls /etc", cwd: "." };

test("sin clave ni decision humana la aprobacion no se puede consumir", () => {
  const id = A.requestApproval({ tool: "run_command", args, reason: "fuera del repo" });
  assert.match(id, /^apr_[0-9a-f]{10}$/);
  assert.equal(A.consumeApproval(id, "run_command", args).ok, false);
});

test("la misma accion reutiliza la solicitud pendiente", () => {
  const a = A.requestApproval({ tool: "run_command", args, reason: "x" });
  const b = A.requestApproval({ tool: "run_command", args: { cwd: ".", command: "ls /etc" }, reason: "x" });
  assert.equal(a, b);
});

test("flujo completo: aprobada, valida una sola vez, solo para la accion exacta", () => {
  const id = A.requestApproval({ tool: "run_command", args, reason: "x" });
  const pending = A.consumeApproval(id, "run_command", args);
  assert.equal(pending.ok, false);
  assert.match(pending.reason, /pendiente de aprobacion humana|no existe la clave/);
  A.decide(id, "approved");
  assert.equal(A.consumeApproval(id, "run_command", { command: "ls /var", cwd: "." }).ok, false, "otra accion no debe valer");
  assert.equal(A.consumeApproval(id, "write_file", args).ok, false, "otra herramienta no debe valer");
  assert.equal(A.consumeApproval(id, "run_command", { ...args, approval_id: id }).ok, true, "approval_id no cuenta en la huella");
  assert.equal(A.consumeApproval(id, "run_command", args).reason, "aprobacion ya utilizada");
});

test("una denegacion humana bloquea", () => {
  const a2 = { command: "ls /usr", cwd: "." };
  const id = A.requestApproval({ tool: "run_command", args: a2, reason: "x" });
  A.decide(id, "denied");
  assert.equal(A.consumeApproval(id, "run_command", a2).reason, "denegada por el humano");
});

test("la aprobacion caduca", () => {
  const a3 = { command: "ls /opt", cwd: "." };
  const id = A.requestApproval({ tool: "run_command", args: a3, reason: "x" });
  A.decide(id, "approved");
  const ttl = policy.limits.approvalTtlMinutes;
  policy.limits.approvalTtlMinutes = -1;
  assert.equal(A.consumeApproval(id, "run_command", a3).reason, "aprobacion caducada");
  policy.limits.approvalTtlMinutes = ttl;
});

test("una decision falsificada (firma invalida) se rechaza", () => {
  const a4 = { command: "ls /srv", cwd: "." };
  const id = A.requestApproval({ tool: "run_command", args: a4, reason: "x" });
  const req = A.listRequests().find((r) => r.id === id);
  fs.appendFileSync(path.join(process.env.AGENT_DATA_DIR, "approvals.jsonl"), `${JSON.stringify({ type: "decision", id, fingerprint: req.fingerprint, decision: "approved", decidedAt: new Date().toISOString(), sig: "f".repeat(64) })}\n`);
  assert.equal(A.consumeApproval(id, "run_command", a4).reason, "firma de aprobacion invalida");
});

test("los secretos no se guardan en el resumen de la solicitud", () => {
  const a5 = { command: "echo sk-abcdefghijklmnopqrstuvwxyz123456", cwd: "." };
  const id = A.requestApproval({ tool: "run_command", args: a5, reason: "x" });
  const req = A.listRequests().find((r) => r.id === id);
  assert.ok(!req.summary.includes("sk-abcdefghijklmnop"));
});
