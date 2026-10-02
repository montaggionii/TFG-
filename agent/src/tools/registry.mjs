import { z } from "zod";
import { PolicyDenied } from "../lib/policy.mjs";
import { consumeApproval, requestApproval } from "../lib/approvals.mjs";
import { auditToolCall } from "../lib/audit.mjs";
import { updateStatus, noteError, emitEvent } from "../lib/status.mjs";
import { redact, truncate } from "../lib/redact.mjs";
import { loadProfile } from "../lib/env.mjs";
import { WORK_ROOT, REPO_ROOT } from "../lib/paths.mjs";
import { policy } from "../lib/policy.mjs";

export class ApprovalRequired extends Error {
  constructor(approvalId, reason, detail) {
    super(reason);
    this.name = "ApprovalRequired";
    this.approvalId = approvalId;
    this.detail = detail;
  }
}

export const tools = new Map();

export function defineTool(def) {
  if (tools.has(def.name)) throw new Error(`Herramienta duplicada: ${def.name}`);
  tools.set(def.name, { risk: "read", ...def, inputSchema: def.inputSchema ?? z.object({}) });
}

export function createContext({ agent = "claude-code", model = null, runId = null, provider = null } = {}) {
  return { agent, model, provider, runId: runId ?? `run_${Date.now().toString(36)}`, profile: loadProfile(), workRoot: WORK_ROOT, repoRoot: REPO_ROOT };
}

// Aplica el veredicto de la politica. 'deny' siempre bloquea; 'approval'
// exige un approval_id firmado por un humano para ESTA accion exacta.
export async function guard(ctx, toolName, args, verdict) {
  if (verdict.decision === "allow") return;
  if (verdict.decision === "deny") throw new PolicyDenied(verdict.reason);
  const check = consumeApproval(ctx.approvalId, toolName, args);
  if (check.ok) {
    ctx.approvedBy = "human";
    return;
  }
  const id = requestApproval({ tool: toolName, args, reason: verdict.reason, runId: ctx.runId });
  throw new ApprovalRequired(id, verdict.reason, check.reason);
}

export function schemaWithApproval(tool) {
  return tool.inputSchema.extend({ approval_id: z.string().optional().describe("Id de una aprobacion humana previa para esta accion exacta") });
}

function toText(value) {
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

export async function invokeTool(name, rawArgs, ctx) {
  const tool = tools.get(name);
  const started = Date.now();
  if (!tool) return { ok: false, status: "error", error: `Herramienta desconocida: ${name}` };

  const parsed = schemaWithApproval(tool).safeParse(rawArgs ?? {});
  if (!parsed.success) {
    const error = `Argumentos invalidos: ${parsed.error.issues.map((i) => `${i.path.join(".") || "(raiz)"}: ${i.message}`).join("; ")}`;
    auditToolCall({ runId: ctx.runId, agent: ctx.agent, model: ctx.model, env: ctx.profile.name, tool: name, decision: "invalid", ok: false, error, durationMs: 0 });
    return { ok: false, status: "invalid_arguments", error };
  }
  const args = parsed.data;
  updateStatus({ currentOperation: name, runId: ctx.runId, agent: ctx.agent, model: ctx.model, environment: ctx.profile.name });

  let result;
  let entry;
  try {
    ctx.approvedBy = undefined;
    ctx.approvalId = args.approval_id;
    const value = await tool.handler(args, ctx);
    const max = policy.limits.maxOutputChars;
    const t = truncate(redact(toText(value)), max);
    result = { ok: true, status: "ok", output: t.text, ...(t.truncated ? { truncated: true } : {}) };
    entry = { decision: ctx.approvedBy ? "approved_by_human" : "allow", ok: true };
    updateStatus({ lastAction: `${name} OK` });
  } catch (err) {
    if (err instanceof ApprovalRequired) {
      result = {
        ok: false,
        status: "approval_required",
        approval_id: err.approvalId,
        reason: err.message,
        detail: err.detail,
        how_to_approve: `Un humano debe ejecutar: npm --prefix agent run approve -- approve ${err.approvalId}  y despues repetir esta llamada con approval_id="${err.approvalId}".`,
      };
      entry = { decision: "approval_required", ok: false, approvalId: err.approvalId };
      updateStatus({ lastAction: `${name} esperando aprobacion ${err.approvalId}`, agentStatus: "BLOCKED_ON_APPROVAL" });
      emitEvent("APPROVAL_REQUIRED", `${name}: ${err.message}`);
    } else if (err instanceof PolicyDenied) {
      result = { ok: false, status: "denied", error: err.message };
      entry = { decision: "deny", ok: false, error: err.message };
      updateStatus({ lastAction: `${name} DENEGADA` });
    } else {
      const msg = redact(err?.message ?? String(err));
      result = { ok: false, status: "error", error: msg };
      entry = { decision: "allow", ok: false, error: msg };
      noteError(`${name}: ${msg}`);
    }
  }
  auditToolCall({ runId: ctx.runId, agent: ctx.agent, model: ctx.model, env: ctx.profile.name, tool: name, args, durationMs: Date.now() - started, ...entry });
  return result;
}
