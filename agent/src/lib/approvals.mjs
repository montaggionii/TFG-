import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DATA_DIR, APPROVAL_KEY_FILE, ensureDir } from "./paths.mjs";
import { policy } from "./policy.mjs";
import { redact } from "./redact.mjs";

const FILE = () => path.join(ensureDir(DATA_DIR), "approvals.jsonl");
const CONSUMED = () => path.join(ensureDir(DATA_DIR), "approvals-consumed.jsonl");

// Las aprobaciones las firma un humano con una clave que vive FUERA del repo
// (~/.fidelyfood-agent/approval.key, modo 600). El servidor MCP solo la lee
// para verificar; solo el CLI humano (`npm run approve`) puede crearla.
export function loadKey({ create = false } = {}) {
  try {
    return fs.readFileSync(APPROVAL_KEY_FILE, "utf8").trim();
  } catch {
    if (!create) return null;
    fs.mkdirSync(path.dirname(APPROVAL_KEY_FILE), { recursive: true, mode: 0o700 });
    const key = crypto.randomBytes(32).toString("hex");
    fs.writeFileSync(APPROVAL_KEY_FILE, key, { mode: 0o600 });
    return key;
  }
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function fingerprint(tool, args) {
  const { approval_id, ...rest } = args || {};
  return crypto.createHash("sha256").update(stable({ tool, args: rest })).digest("hex");
}

function sign(key, id, fp, decision, decidedAt) {
  return crypto.createHmac("sha256", key).update(`${id}|${fp}|${decision}|${decidedAt}`).digest("hex");
}

function readLines(file) {
  try {
    return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

export function listRequests() {
  const lines = readLines(FILE());
  const requests = new Map();
  for (const l of lines) {
    if (l.type === "request") requests.set(l.id, { ...l, status: "pending" });
  }
  for (const l of lines) {
    if (l.type === "decision" && requests.has(l.id)) {
      const r = requests.get(l.id);
      r.status = l.decision;
      r.decidedAt = l.decidedAt;
      r.sig = l.sig;
    }
  }
  const consumed = new Set(readLines(CONSUMED()).map((c) => c.id));
  for (const r of requests.values()) if (consumed.has(r.id)) r.consumed = true;
  return [...requests.values()];
}

export function requestApproval({ tool, args, reason, runId }) {
  const fp = fingerprint(tool, args);
  const existing = listRequests().find((r) => r.fingerprint === fp && r.status === "pending");
  if (existing) return existing.id;
  const id = `apr_${crypto.randomBytes(5).toString("hex")}`;
  const summary = redact(JSON.stringify(args ?? {})).slice(0, 600);
  fs.appendFileSync(FILE(), `${JSON.stringify({ type: "request", id, fingerprint: fp, tool, summary, reason, runId: runId ?? null, requestedAt: new Date().toISOString() })}\n`);
  return id;
}

// Solo lo llama el CLI humano.
export function decide(id, decision) {
  const req = listRequests().find((r) => r.id === id);
  if (!req) throw new Error(`No existe la solicitud ${id}`);
  const key = loadKey({ create: true });
  const decidedAt = new Date().toISOString();
  const sig = sign(key, id, req.fingerprint, decision, decidedAt);
  fs.appendFileSync(FILE(), `${JSON.stringify({ type: "decision", id, fingerprint: req.fingerprint, decision, decidedAt, sig })}\n`);
  return { ...req, status: decision, decidedAt };
}

// Verifica una aprobacion para (tool, args). Es de un solo uso y caduca.
export function consumeApproval(approvalId, tool, args) {
  if (!approvalId) return { ok: false, reason: "sin approval_id" };
  const key = loadKey();
  if (!key) return { ok: false, reason: "no existe la clave de aprobacion (ningun humano ha aprobado nunca nada)" };
  const lines = readLines(FILE());
  const req = lines.find((l) => l.type === "request" && l.id === approvalId);
  if (!req) return { ok: false, reason: "approval_id desconocido" };
  const fp = fingerprint(tool, args);
  if (req.fingerprint !== fp) return { ok: false, reason: "la aprobacion no corresponde a esta accion exacta" };
  const dec = [...lines].reverse().find((l) => l.type === "decision" && l.id === approvalId);
  if (!dec) return { ok: false, reason: "pendiente de aprobacion humana" };
  if (dec.decision !== "approved") return { ok: false, reason: "denegada por el humano" };
  if (dec.sig !== sign(key, dec.id, dec.fingerprint, dec.decision, dec.decidedAt)) return { ok: false, reason: "firma de aprobacion invalida" };
  const ageMin = (Date.now() - Date.parse(dec.decidedAt)) / 60000;
  if (ageMin > policy.limits.approvalTtlMinutes) return { ok: false, reason: "aprobacion caducada" };
  if (readLines(CONSUMED()).some((c) => c.id === approvalId)) return { ok: false, reason: "aprobacion ya utilizada" };
  fs.appendFileSync(CONSUMED(), `${JSON.stringify({ id: approvalId, consumedAt: new Date().toISOString() })}\n`);
  return { ok: true };
}
