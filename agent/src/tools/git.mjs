import { z } from "zod";
import { defineTool, guard } from "./registry.mjs";
import { run } from "../lib/exec.mjs";
import { requireCapability, checkWritePath, resolveInRepo } from "../lib/policy.mjs";
import { relFromRoot } from "../lib/paths.mjs";
import { updateStatus } from "../lib/status.mjs";
import { currentBranch } from "./project.mjs";

const git = (ctx, args, timeoutMs = 30000) => run(["git", ...args], { cwd: ctx.workRoot, timeoutMs });

defineTool({
  name: "git_status",
  description: "Estado de git (rama y archivos modificados). Ejecutalo SIEMPRE antes de empezar a trabajar para no pisar trabajo humano.",
  risk: "read",
  handler: async (_a, ctx) => {
    const r = await git(ctx, ["status", "--porcelain=v1", "-b"]);
    const lines = r.output.split("\n").filter(Boolean);
    const branchLine = lines.find((l) => l.startsWith("##")) ?? "";
    const files = lines.filter((l) => !l.startsWith("##")).map((l) => ({ status: l.slice(0, 2).trim() || "?", path: l.slice(3) }));
    updateStatus({ branch: branchLine.replace(/^## /, "").split("...")[0] });
    return { branch: branchLine.replace(/^## /, ""), clean: files.length === 0, files };
  },
});

defineTool({
  name: "git_diff",
  description: "Diff del repositorio (sin staged por defecto). Usa stat_only para un resumen.",
  risk: "read",
  inputSchema: z.object({ staged: z.boolean().default(false), path: z.string().optional(), stat_only: z.boolean().default(false), against: z.string().optional().describe("Ej. origin/main para comparar contra una referencia") }),
  handler: async ({ staged, path: p, stat_only, against }, ctx) => {
    const args = ["diff", "--no-color"];
    if (staged) args.push("--staged");
    if (stat_only) args.push("--stat");
    if (against) {
      if (!/^[\w./@^~-]+$/.test(against)) throw new Error("Referencia git invalida");
      args.push(against);
    }
    if (p) {
      const rel = relFromRoot(resolveInRepo(p, ctx.workRoot), ctx.workRoot);
      args.push("--", rel);
    }
    const r = await git(ctx, args);
    return r.output || "(sin diferencias)";
  },
});

defineTool({
  name: "git_log",
  description: "Historial de commits recientes.",
  risk: "read",
  inputSchema: z.object({ limit: z.number().int().min(1).max(100).default(15), path: z.string().optional() }),
  handler: async ({ limit, path: p }, ctx) => {
    const args = ["log", `-${limit}`, "--date=short", "--pretty=format:%h %ad %an  %s"];
    if (p) args.push("--", relFromRoot(resolveInRepo(p, ctx.workRoot), ctx.workRoot));
    return (await git(ctx, args)).output;
  },
});

defineTool({
  name: "git_branch",
  description: "Rama actual y lista de ramas locales.",
  risk: "read",
  handler: async (_a, ctx) => {
    const current = await currentBranch(ctx);
    const list = (await git(ctx, ["branch", "--list", "--format=%(refname:short)"])).output.split("\n").filter(Boolean);
    return { current, branches: list };
  },
});

defineTool({
  name: "git_create_branch",
  description: "Crea y cambia a una rama de trabajo del agente. El nombre debe empezar por agent/ (ej. agent/fix-logout).",
  risk: "write",
  inputSchema: z.object({ name: z.string().regex(/^agent\/[a-z0-9][a-z0-9._/-]{2,60}$/, "Debe ser agent/<nombre-en-minusculas>"), from: z.string().regex(/^[\w./@-]+$/).optional().describe("Referencia base, p.ej. origin/main") }),
  handler: async ({ name, from }, ctx) => {
    await guard(ctx, "git_create_branch", { name }, requireCapability(ctx.profile, "allowGitCommits"));
    const args = ["switch", "-c", name];
    if (from) args.push(from);
    const r = await git(ctx, args);
    if (r.code !== 0) throw new Error(r.output.trim());
    updateStatus({ branch: name });
    return `Rama creada y activa: ${name}`;
  },
});

defineTool({
  name: "git_commit",
  description: "Hace commit SOLO de los archivos indicados. Solo en ramas agent/*, nunca en main. No salta hooks. No hace push.",
  risk: "write",
  inputSchema: z.object({ message: z.string().min(8).max(2000), files: z.array(z.string()).min(1).max(100) }),
  handler: async ({ message, files }, ctx) => {
    await guard(ctx, "git_commit", { message, files }, requireCapability(ctx.profile, "allowGitCommits"));
    const branch = await currentBranch(ctx);
    if (!branch.startsWith("agent/")) throw new Error(`Los commits del agente solo se hacen en ramas agent/* (rama actual: ${branch})`);
    const rels = files.map((f) => relFromRoot(resolveInRepo(f, ctx.workRoot), ctx.workRoot));
    for (const rel of rels) await guard(ctx, "git_commit", { message, files }, checkWritePath(rel));
    const add = await git(ctx, ["add", "--", ...rels]);
    if (add.code !== 0) throw new Error(add.output.trim());
    const staged = (await git(ctx, ["diff", "--cached", "--name-only"])).output.split("\n").filter(Boolean);
    const extra = staged.filter((f) => !rels.includes(f));
    if (extra.length) {
      await git(ctx, ["reset", "-q", "--", ...extra]);
      throw new Error(`Habia archivos ya en staging que no pediste commitear (${extra.join(", ")}); se han sacado del staging. Repite el commit.`);
    }
    const commit = await git(ctx, ["commit", "-m", message], 120000);
    if (commit.code !== 0) throw new Error(commit.output.trim());
    const sha = (await git(ctx, ["rev-parse", "--short", "HEAD"])).output.trim();
    return { commit: sha, branch, files: rels };
  },
});
