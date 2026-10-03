import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { defineTool } from "./registry.mjs";

const skillsDir = (ctx) => path.join(ctx.workRoot, "skills", "fidelyfood");

export function listSkills(root) {
  const dir = path.join(root, "skills", "fidelyfood");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory() && fs.existsSync(path.join(dir, e.name, "SKILL.md"))).map((e) => {
    const text = fs.readFileSync(path.join(dir, e.name, "SKILL.md"), "utf8");
    const purpose = (text.match(/^## Propósito\s*\n+([\s\S]*?)(?=\n## )/m) || [])[1]?.trim().split("\n")[0] ?? "";
    return { name: e.name, purpose };
  });
}

defineTool({
  name: "list_skills",
  description: "Lista las skills de FidelyFood (procedimientos especializados) con su proposito.",
  risk: "read",
  handler: async (_a, ctx) => listSkills(ctx.workRoot),
});

defineTool({
  name: "read_skill",
  description: "Lee el procedimiento completo de una skill (backend, frontend, database, security, testing, debugging, git, api, documentation, qa, deployment, architecture). Leela ANTES de trabajar en esa area.",
  risk: "read",
  inputSchema: z.object({ name: z.string().regex(/^[a-z-]+$/) }),
  handler: async ({ name }, ctx) => {
    const file = path.join(skillsDir(ctx), name, "SKILL.md");
    if (!fs.existsSync(file)) throw new Error(`No existe la skill "${name}". Disponibles: ${listSkills(ctx.workRoot).map((s) => s.name).join(", ")}`);
    return fs.readFileSync(file, "utf8");
  },
});
