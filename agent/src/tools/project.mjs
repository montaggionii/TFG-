import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { defineTool, guard } from "./registry.mjs";
import { checkReadPath, checkWritePath, resolveInRepo, requireCapability, allow, needApproval, deny } from "../lib/policy.mjs";
import { relFromRoot, readJson } from "../lib/paths.mjs";
import { run } from "../lib/exec.mjs";
import { noteFile } from "../lib/status.mjs";
import { policy } from "../lib/policy.mjs";

const SKIP_DIRS = new Set([".git", "node_modules", "target", "uploads", "dist", ".angular", "www", "android", "ios", "backups", "data", ".idea", "playwright-report", "test-results"]);

function walk(dir, root, depth, maxDepth, out, limit) {
  if (out.length >= limit) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return;
  }
  for (const e of entries) {
    if (out.length >= limit) return;
    if (e.isDirectory() && SKIP_DIRS.has(e.name)) continue;
    const rel = relFromRoot(path.join(dir, e.name), root);
    if (checkReadPath(rel).decision === "deny") continue;
    out.push(e.isDirectory() ? `${rel}/` : rel);
    if (e.isDirectory() && depth < maxDepth) walk(path.join(dir, e.name), root, depth + 1, maxDepth, out, limit);
  }
}

export function currentBranch(ctx) {
  return run(["git", "rev-parse", "--abbrev-ref", "HEAD"], { cwd: ctx.workRoot, timeoutMs: 10000 }).then((r) => r.output.trim());
}

async function uncommittedFiles(ctx) {
  const r = await run(["git", "status", "--porcelain=v1"], { cwd: ctx.workRoot, timeoutMs: 15000 });
  return r.output.split("\n").filter(Boolean).map((l) => l.slice(3).replace(/^"|"$/g, ""));
}

defineTool({
  name: "list_files",
  description: "Lista archivos y carpetas del repositorio (sin node_modules, target, uploads ni secretos).",
  risk: "read",
  inputSchema: z.object({ path: z.string().default("."), depth: z.number().int().min(1).max(6).default(2), limit: z.number().int().min(1).max(1000).default(300) }),
  handler: async ({ path: p, depth, limit }, ctx) => {
    const abs = resolveInRepo(p, ctx.workRoot);
    const out = [];
    walk(abs, ctx.workRoot, 1, depth, out, limit);
    return out.join("\n") || "(vacio)";
  },
});

defineTool({
  name: "read_file",
  description: "Lee un archivo del repositorio (con numeros de linea). Bloquea .env, claves y otros secretos.",
  risk: "read",
  inputSchema: z.object({ path: z.string(), start_line: z.number().int().min(1).optional(), end_line: z.number().int().min(1).optional() }),
  handler: async ({ path: p, start_line, end_line }, ctx) => {
    const abs = resolveInRepo(p, ctx.workRoot);
    const rel = relFromRoot(abs, ctx.workRoot);
    await guard(ctx, "read_file", { path: p }, checkReadPath(rel));
    const stat = fs.statSync(abs);
    if (!stat.isFile()) throw new Error(`${rel} no es un archivo`);
    if (stat.size > policy.limits.maxFileBytes) throw new Error(`${rel} pesa ${stat.size} bytes (maximo ${policy.limits.maxFileBytes}); usa start_line/end_line con search_code`);
    const lines = fs.readFileSync(abs, "utf8").split("\n");
    const from = (start_line ?? 1) - 1;
    const to = end_line ?? lines.length;
    return lines.slice(from, to).map((l, i) => `${from + i + 1}\t${l}`).join("\n");
  },
});

defineTool({
  name: "write_file",
  description: "Crea o sobrescribe un archivo del repositorio. Solo en ramas agent/*; pide aprobacion si el archivo tiene cambios sin commitear que no son de esta sesion (trabajo humano).",
  risk: "write",
  inputSchema: z.object({ path: z.string(), content: z.string() }),
  handler: async ({ path: p, content }, ctx) => {
    await guard(ctx, "write_file", { path: p }, requireCapability(ctx.profile, "allowFileWrites"));
    const abs = resolveInRepo(p, ctx.workRoot);
    const rel = relFromRoot(abs, ctx.workRoot);
    await guard(ctx, "write_file", { path: p }, checkWritePath(rel));
    if (Buffer.byteLength(content) > policy.limits.maxFileBytes) throw new Error("Contenido demasiado grande");
    const branch = await currentBranch(ctx);
    if (!branch.startsWith("agent/") && process.env.AGENT_ALLOW_ANY_BRANCH !== "1") {
      await guard(ctx, "write_file", { path: p, content }, deny(`Estas en la rama "${branch}". Crea una rama agent/* con git_create_branch antes de modificar archivos.`));
    }
    if (fs.existsSync(abs)) {
      const dirty = await uncommittedFiles(ctx);
      if (dirty.includes(rel) && !(ctx.touched ??= new Set()).has(rel)) {
        await guard(ctx, "write_file", { path: p, content }, needApproval(`"${rel}" tiene cambios sin commitear que no son de esta sesion (posible trabajo humano)`));
      }
    }
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
    (ctx.touched ??= new Set()).add(rel);
    noteFile(rel);
    return `Escrito ${rel} (${content.length} caracteres)`;
  },
});

defineTool({
  name: "search_code",
  description: "Busca texto/regex en el codigo (ripgrep si existe, grep si no). Excluye secretos, node_modules y artefactos.",
  risk: "read",
  inputSchema: z.object({ pattern: z.string().min(1), path: z.string().default("."), glob: z.string().optional(), max_results: z.number().int().min(1).max(500).default(100), ignore_case: z.boolean().default(true) }),
  handler: async ({ pattern, path: p, glob, max_results, ignore_case }, ctx) => {
    const abs = resolveInRepo(p, ctx.workRoot);
    const rel = relFromRoot(abs, ctx.workRoot) || ".";
    await guard(ctx, "search_code", { path: p }, checkReadPath(rel === "." ? "x" : rel));
    const hasRg = (await run(["which", "rg"], { cwd: ctx.workRoot, timeoutMs: 3000 })).code === 0;
    let argv;
    if (hasRg) {
      argv = ["rg", "--line-number", "--no-heading", "--color", "never", "--max-count", "50", "-g", "!.env*", "-g", "!node_modules", "-g", "!target", "-g", "!uploads", "-g", "!agent/data", "-g", "!*.lock", "-g", "!package-lock.json"];
      if (ignore_case) argv.push("-i");
      if (glob) argv.push("-g", glob);
      argv.push("-e", pattern, "--", rel);
    } else {
      argv = ["grep", "-rIn", "--exclude-dir=node_modules", "--exclude-dir=.git", "--exclude-dir=target", "--exclude-dir=uploads", "--exclude=.env*", "--exclude=package-lock.json"];
      if (ignore_case) argv.push("-i");
      if (glob) argv.push(`--include=${glob}`);
      argv.push("-e", pattern, "--", rel);
    }
    const r = await run(argv, { cwd: ctx.workRoot, timeoutMs: 60000 });
    if (r.code === 1 && !r.output.trim()) return "(sin coincidencias)";
    return r.output.split("\n").filter(Boolean).slice(0, max_results).join("\n");
  },
});

function countFiles(dir, re) {
  let n = 0;
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) n += countFiles(path.join(dir, e.name), re);
      else if (re.test(e.name)) n++;
    }
  } catch {
    /* carpeta inexistente */
  }
  return n;
}

defineTool({
  name: "inspect_project",
  description: "Resumen real del proyecto: modulos, versiones, conteos de codigo/tests, rama git, documentacion y ficheros del Agent Layer.",
  risk: "read",
  handler: async (_args, ctx) => {
    const root = ctx.workRoot;
    const pom = fs.existsSync(path.join(root, "pom.xml")) ? fs.readFileSync(path.join(root, "pom.xml"), "utf8") : "";
    const fe = readJson(path.join(root, "frontend", "package.json"), {});
    const back = path.join(root, "src", "main", "java");
    const branch = await currentBranch(ctx);
    const dirty = await uncommittedFiles(ctx);
    const docs = ["AGENTS.md", "ARCHITECTURE.md", "DATABASE.md", "API.md", "DEVELOPMENT.md", "TESTING.md", "SECURITY.md", "DEPLOYMENT.md", "AGENT_TASKS.md", "CHANGELOG_AGENT.md", "AGENT_LAYER.md"].filter((f) => fs.existsSync(path.join(root, f)));
    return {
      environment: ctx.profile.name,
      branch,
      uncommittedFiles: dirty.length,
      backend: {
        stack: "Spring Boot (Java) + Spring Security + JWT + JPA/Hibernate + MySQL",
        javaVersion: (pom.match(/<java\.version>([^<]+)</) || [])[1] ?? null,
        springBootParent: (pom.match(/<artifactId>spring-boot-starter-parent<\/artifactId>\s*<version>([^<]+)</) || [])[1] ?? null,
        controllers: countFiles(path.join(back, "progresa", "springboot_tfg", "controller"), /\.java$/),
        services: countFiles(path.join(back, "progresa", "springboot_tfg", "service"), /\.java$/),
        entities: countFiles(path.join(back, "progresa", "springboot_tfg", "entity"), /\.java$/),
        unitTestFiles: countFiles(path.join(root, "src", "test"), /Test\.java$/),
      },
      frontend: {
        stack: "Angular + Ionic + TypeScript",
        angular: fe.dependencies?.["@angular/core"] ?? null,
        ionic: fe.dependencies?.["@ionic/angular"] ?? null,
        scripts: Object.keys(fe.scripts ?? {}),
        e2eSpecs: countFiles(path.join(root, "frontend", "e2e"), /\.spec\.ts$/),
        playwright: Boolean(fe.devDependencies?.["@playwright/test"] || fe.dependencies?.["@playwright/test"]),
      },
      database: "MySQL (local: proyectoTFG; produccion: Aiven)",
      deployment: "Render (backend, Docker) + Vercel (frontend) + Aiven (MySQL) — ver DEPLOYMENT.md",
      docs,
      agentLayer: { mcpServer: "agent/src/mcp/server.mjs", skills: "skills/fidelyfood/", tasks: "AGENT_TASKS.md", memory: ".agent/memory.jsonl", monitor: "access-center (puerto 5757)" },
    };
  },
});

defineTool({
  name: "inspect_architecture",
  description: "Devuelve la arquitectura documentada (ARCHITECTURE.md) junto con el inventario real de entidades, servicios, controllers y rutas del frontend.",
  risk: "read",
  handler: async (_args, ctx) => {
    const root = ctx.workRoot;
    const base = path.join(root, "src", "main", "java", "progresa", "springboot_tfg");
    const list = (d) => (fs.existsSync(path.join(base, d)) ? fs.readdirSync(path.join(base, d)).filter((f) => f.endsWith(".java")).map((f) => f.replace(".java", "")) : []);
    const routes = [];
    const walkRoutes = (dir) => {
      for (const e of fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : []) {
        if (e.isDirectory()) walkRoutes(path.join(dir, e.name));
        else if (/routes?\.ts$/.test(e.name) || e.name === "app.routes.ts") routes.push(relFromRoot(path.join(dir, e.name), root));
      }
    };
    walkRoutes(path.join(root, "frontend", "src", "app"));
    const archFile = path.join(root, "ARCHITECTURE.md");
    return {
      documented: fs.existsSync(archFile) ? fs.readFileSync(archFile, "utf8").slice(0, 8000) : "(no existe ARCHITECTURE.md)",
      backend: { controllers: list("controller"), services: list("service"), entities: list("entity"), dao: list("dao"), dto: list("dto"), security: list("security"), config: list("config") },
      frontendRouteFiles: routes,
    };
  },
});
