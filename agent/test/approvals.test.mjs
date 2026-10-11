import { test, before, mock } from "node:test";
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

// --- lifecycleOf: ciclo de vida derivado --------------------------------------
// Puras y deterministas: el instante de referencia `now` se pasa explicito, sin
// esperas ni temporizadores. El TTL se lee de la politica, no se hardcodea.
const DECIDED_AT = "2026-10-08T12:00:00.000Z";
const decidedMs = Date.parse(DECIDED_AT);
const ttlMs = () => policy.limits.approvalTtlMinutes * 60000;
const approved = (extra = {}) => ({ id: "apr_x", status: "approved", decidedAt: DECIDED_AT, ...extra });

test("lifecycleOf: pending no lleva expiresAt", () => {
  assert.deepEqual(A.lifecycleOf({ id: "apr_x", status: "pending" }, decidedMs), { lifecycle: "pending" });
});

test("lifecycleOf: denied se propaga sin expiresAt, tambien si esta caducada", () => {
  const r = { id: "apr_x", status: "denied", decidedAt: DECIDED_AT };
  assert.deepEqual(A.lifecycleOf(r, decidedMs), { lifecycle: "denied" });
  assert.deepEqual(A.lifecycleOf(r, decidedMs + 10 * ttlMs()), { lifecycle: "denied" });
});

test("lifecycleOf: approved vigente y sin usar es approved_unused con expiresAt = decidedAt + TTL", () => {
  const out = A.lifecycleOf(approved(), decidedMs);
  assert.equal(out.lifecycle, "approved_unused");
  assert.equal(out.expiresAt, new Date(decidedMs + ttlMs()).toISOString());
});

test("lifecycleOf: limites temporales (justo antes, en el instante y justo despues de caducar)", () => {
  const exp = decidedMs + ttlMs();
  assert.equal(A.lifecycleOf(approved(), exp - 1).lifecycle, "approved_unused", "1 ms antes");
  assert.equal(A.lifecycleOf(approved(), exp).lifecycle, "approved_unused", "en el instante exacto sigue vigente (comparacion estricta)");
  assert.equal(A.lifecycleOf(approved(), exp + 1).lifecycle, "expired", "1 ms despues");
});

test("lifecycleOf: consumed gana sobre expired y conserva expiresAt", () => {
  const exp = decidedMs + ttlMs();
  const expected = { lifecycle: "consumed", expiresAt: new Date(exp).toISOString() };
  assert.deepEqual(A.lifecycleOf(approved({ consumed: true }), decidedMs), expected, "consumida dentro del TTL");
  assert.deepEqual(A.lifecycleOf(approved({ consumed: true }), exp + 60000), expected, "consumida y ya pasado el TTL");
});

test("lifecycleOf: es determinista y no muta su entrada", () => {
  const r = approved();
  const copia = structuredClone(r);
  const now = decidedMs + 5 * 60000;
  assert.deepEqual(A.lifecycleOf(r, now), A.lifecycleOf(r, now));
  assert.deepEqual(r, copia);
});

test("lifecycleOf: respeta el TTL de la politica (cambiarlo mueve la frontera)", () => {
  const ttl = policy.limits.approvalTtlMinutes;
  try {
    policy.limits.approvalTtlMinutes = 1;
    assert.equal(A.lifecycleOf(approved(), decidedMs + 60000).lifecycle, "approved_unused");
    assert.equal(A.lifecycleOf(approved(), decidedMs + 60001).lifecycle, "expired");
  } finally {
    policy.limits.approvalTtlMinutes = ttl;
  }
});

test("lifecycleOf: un estado desconocido se devuelve tal cual", () => {
  assert.deepEqual(A.lifecycleOf({ id: "apr_x", status: "revoked" }, decidedMs), { lifecycle: "revoked" });
});

test("listRequests/decide persisten y exponen el ciclo de vida de extremo a extremo", () => {
  const a = { command: "ls /lifecycle-e2e", cwd: "." };
  const id = A.requestApproval({ tool: "run_command", args: a, reason: "x" });

  // recien creada: pending
  let r = A.listRequests().find((x) => x.id === id);
  assert.equal(r.lifecycle, "pending");
  assert.equal(r.expiresAt, undefined);

  // aprobada: el valor devuelto por decide() y el persistido coinciden
  const decided = A.decide(id, "approved");
  assert.equal(decided.lifecycle, "approved_unused");
  const lineas = fs.readFileSync(path.join(process.env.AGENT_DATA_DIR, "approvals.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const dec = lineas.filter((l) => l.type === "decision" && l.id === id).at(-1);
  assert.deepEqual(Object.keys(dec).sort(), ["decidedAt", "decision", "fingerprint", "id", "sig", "type"], "el log persistido no almacena campos derivados");
  assert.match(dec.sig, /^[0-9a-f]{64}$/);
  const t = Date.parse(dec.decidedAt);
  assert.equal(decided.expiresAt, new Date(t + ttlMs()).toISOString());

  // reloj inyectado: sin esperas, se recorre vigente -> caducada
  r = A.listRequests(t + ttlMs()).find((x) => x.id === id);
  assert.equal(r.lifecycle, "approved_unused");
  r = A.listRequests(t + ttlMs() + 1).find((x) => x.id === id);
  assert.equal(r.lifecycle, "expired");

  // consumida: pasa a consumed, incluso mirando despues de la caducidad
  assert.equal(A.consumeApproval(id, "run_command", a).ok, true);
  r = A.listRequests().find((x) => x.id === id);
  assert.equal(r.lifecycle, "consumed");
  assert.equal(r.consumed, true);
  assert.equal(A.listRequests(t + ttlMs() + 1).find((x) => x.id === id).lifecycle, "consumed");
});

test("listRequests: una solicitud denegada queda en lifecycle denied", () => {
  const a = { command: "ls /lifecycle-denied", cwd: "." };
  const id = A.requestApproval({ tool: "run_command", args: a, reason: "x" });
  assert.equal(A.decide(id, "denied").lifecycle, "denied");
  assert.equal(A.listRequests().find((x) => x.id === id).lifecycle, "denied");
});

// --- consumeApproval: limite temporal con reloj controlado ---------------------
// consumeApproval lee Date.now(); se fija con mock.method (sin tocar produccion).
// decidedAt sale de `new Date()`, que no pasa por Date.now, asi que no se ve afectado.
function aprobar(cmd) {
  const a = { command: cmd, cwd: "." };
  const id = A.requestApproval({ tool: "run_command", args: a, reason: "x" });
  A.decide(id, "approved");
  const decidedMs = Date.parse(A.listRequests().find((r) => r.id === id).decidedAt);
  return { id, a, decidedMs };
}
function consumirEn(ahoraMs, { id, a }) {
  const m = mock.method(Date, "now", () => ahoraMs);
  try {
    return A.consumeApproval(id, "run_command", a);
  } finally {
    m.mock.restore();
  }
}

test("consumeApproval: limite temporal (1 ms antes y en el instante exacto valen; 1 ms despues caduca)", () => {
  const ttl = policy.limits.approvalTtlMinutes * 60000;
  const antes = aprobar("ls /clock-before");
  assert.equal(consumirEn(antes.decidedMs + ttl - 1, antes).ok, true, "1 ms antes");
  const exacto = aprobar("ls /clock-exact");
  assert.equal(consumirEn(exacto.decidedMs + ttl, exacto).ok, true, "en el instante exacto (comparacion estricta)");
  const despues = aprobar("ls /clock-after");
  assert.equal(consumirEn(despues.decidedMs + ttl + 1, despues).reason, "aprobacion caducada", "1 ms despues");
});

test("consumeApproval y lifecycleOf coinciden en la frontera de caducidad", () => {
  const ttl = policy.limits.approvalTtlMinutes * 60000;
  for (const delta of [-1, 0, 1]) {
    const ap = aprobar(`ls /clock-agree${delta}`);
    const vigenteSegunLifecycle = A.listRequests(ap.decidedMs + ttl + delta).find((r) => r.id === ap.id).lifecycle === "approved_unused";
    assert.equal(consumirEn(ap.decidedMs + ttl + delta, ap).ok, vigenteSegunLifecycle, `delta ${delta} ms`);
  }
});

// --- decide(): solo se decide una solicitud pendiente ---------------------------
test("decide: rechaza una decision que no sea approved/denied", () => {
  const id = A.requestApproval({ tool: "run_command", args: { command: "ls /decide-invalid", cwd: "." }, reason: "x" });
  assert.throws(() => A.decide(id, "banana"), /Decision invalida/);
  assert.equal(A.listRequests().find((r) => r.id === id).lifecycle, "pending", "no se escribio nada");
});

test("decide: una solicitud ya decidida no se puede volver a decidir (ni renovar ni voltear)", () => {
  const file = () => fs.readFileSync(path.join(process.env.AGENT_DATA_DIR, "approvals.jsonl"), "utf8");
  for (const [primera, segunda, esperado] of [["approved", "approved", "approved_unused"], ["approved", "denied", "approved_unused"], ["denied", "approved", "denied"]]) {
    const id = A.requestApproval({ tool: "run_command", args: { command: `ls /decide-${primera}-${segunda}`, cwd: "." }, reason: "x" });
    A.decide(id, primera);
    const antes = file();
    assert.throws(() => A.decide(id, segunda), (e) => e.code === "NOT_PENDING" && e.lifecycle === esperado, `${primera} -> ${segunda}`);
    assert.equal(file(), antes, "el log no cambia");
  }
});

test("decide: una aprobacion caducada no se renueva volviendo a aprobarla", () => {
  const args = { command: "ls /decide-expired", cwd: "." };
  const id = A.requestApproval({ tool: "run_command", args, reason: "x" });
  A.decide(id, "approved");
  const ttl = policy.limits.approvalTtlMinutes;
  policy.limits.approvalTtlMinutes = -1; // caducada de inmediato
  try {
    assert.equal(A.listRequests().find((r) => r.id === id).lifecycle, "expired");
    assert.throws(() => A.decide(id, "approved"), (e) => e.code === "NOT_PENDING" && e.lifecycle === "expired");
    assert.equal(A.consumeApproval(id, "run_command", args).reason, "aprobacion caducada");
  } finally {
    policy.limits.approvalTtlMinutes = ttl;
  }
});
