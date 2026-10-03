import path from "node:path";
import { z } from "zod";
import { defineTool, guard } from "./registry.mjs";
import { run, javaEnv } from "../lib/exec.mjs";
import { tokenize, classifyArgv, resolveInRepo } from "../lib/policy.mjs";
import { policy } from "../lib/policy.mjs";

const SUBDIRS = { root: ".", frontend: "frontend", agent: "agent", "access-center": "access-center" };

export async function execClassified(ctx, toolName, argv, { cwd, timeoutMs, auditArgs, env: extraEnv = {}, maxChars }) {
  await guard(ctx, toolName, auditArgs ?? { argv, cwd }, classifyArgv(argv, cwd));
  const env = { ...(/(^|\/)(mvnw?|java)$/.test(argv[0]) ? javaEnv() : {}), ...extraEnv };
  return run(argv, { cwd, env, timeoutMs: Math.min(timeoutMs ?? policy.limits.commandTimeoutMs, policy.limits.commandTimeoutMs), maxChars: maxChars ?? policy.limits.maxOutputChars });
}

export function formatRun(r) {
  const head = `exit=${r.code}${r.timedOut ? " (TIMEOUT)" : ""} ${r.durationMs}ms`;
  return `${head}\n${r.output}`;
}

defineTool({
  name: "run_command",
  description:
    "Ejecuta UN programa (sin shell: no se admiten ; & | < > ` $()). Politica de minimo privilegio: lectura/tests/build/git seguro se ejecutan; push, rm, reset --hard, deploy, publicar, rutas fuera del repo, etc. requieren aprobacion humana.",
  risk: "exec",
  inputSchema: z.object({ command: z.string().min(1), cwd: z.string().default("."), timeout_seconds: z.number().int().min(1).max(600).default(120) }),
  handler: async ({ command, cwd, timeout_seconds }, ctx) => {
    const argv = tokenize(command);
    const abs = resolveInRepo(cwd, ctx.workRoot);
    const r = await execClassified(ctx, "run_command", argv, { cwd: abs, timeoutMs: timeout_seconds * 1000, auditArgs: { command, cwd } });
    return formatRun(r);
  },
});

defineTool({
  name: "run_maven",
  description: "Ejecuta Maven (con JDK 17 autodetectado). Objetivos seguros: compile, test, test-compile, package, verify, clean.",
  risk: "exec",
  inputSchema: z.object({ goals: z.array(z.string().regex(/^[\w:.-]+$/)).min(1), args: z.array(z.string().regex(/^-[\w.=:,*-]+$/)).default([]), timeout_seconds: z.number().int().min(10).max(600).default(300) }),
  handler: async ({ goals, args, timeout_seconds }, ctx) => {
    const argv = ["./mvnw", "-B", ...args, ...goals];
    const r = await execClassified(ctx, "run_maven", argv, { cwd: ctx.workRoot, timeoutMs: timeout_seconds * 1000, auditArgs: { goals, args } });
    return formatRun(r);
  },
});

defineTool({
  name: "run_npm",
  description: "Ejecuta npm run <script> (o ci/install/ls/outdated/audit) en frontend, agent, access-center o la raiz.",
  risk: "exec",
  inputSchema: z.object({ project: z.enum(["frontend", "agent", "access-center", "root"]).default("frontend"), script: z.string().regex(/^[\w:.-]+$/), args: z.array(z.string()).default([]), timeout_seconds: z.number().int().min(10).max(600).default(300) }),
  handler: async ({ project, script, args, timeout_seconds }, ctx) => {
    const cwd = path.join(ctx.workRoot, SUBDIRS[project]);
    const direct = ["ci", "install", "ls", "outdated", "audit", "test"].includes(script);
    const argv = direct ? ["npm", script, ...args] : ["npm", "run", script, ...(args.length ? ["--", ...args] : [])];
    const r = await execClassified(ctx, "run_npm", argv, { cwd, timeoutMs: timeout_seconds * 1000, auditArgs: { project, script, args } });
    return formatRun(r);
  },
});
