import { z } from "zod";
import { defineTool, guard } from "./registry.mjs";
import { parseTasks, createTask, updateTask, STATES } from "../lib/tasks.mjs";
import { addMemory, searchMemory, readMemory, MEMORY_TYPES } from "../lib/memory.mjs";
import { requireCapability } from "../lib/policy.mjs";
import { updateStatus, noteFile } from "../lib/status.mjs";

const brief = (t) => ({ id: t.ID, title: t.title, status: t["Estado"], priority: t["Prioridad"], area: t["Área"], dependencies: t.deps });

defineTool({
  name: "task_list",
  description: "Lista las tareas del sistema AGENT_TASKS.md (formato AGT-xxx) con filtros opcionales.",
  risk: "read",
  inputSchema: z.object({ status: z.enum(["TODO", "IN_PROGRESS", "BLOCKED", "REVIEW", "DONE"]).optional(), area: z.string().optional() }),
  handler: async ({ status, area }, ctx) => {
    let tasks = parseTasks(ctx.workRoot);
    if (status) tasks = tasks.filter((t) => t["Estado"] === status);
    if (area) tasks = tasks.filter((t) => (t["Área"] || "").toLowerCase() === area.toLowerCase());
    return tasks.map(brief);
  },
});

defineTool({
  name: "task_get",
  description: "Tarea completa: descripcion, archivos afectados, criterios de aceptacion, tests necesarios y resultado.",
  risk: "read",
  inputSchema: z.object({ id: z.string().regex(/^AGT-\d+$/) }),
  handler: async ({ id }, ctx) => {
    const t = parseTasks(ctx.workRoot).find((x) => x.ID === id);
    if (!t) throw new Error(`No existe la tarea ${id}`);
    const { deps, files, ...fields } = t;
    return { ...fields, dependenciasLista: deps, archivosLista: files };
  },
});

defineTool({
  name: "task_create",
  description: "Crea una tarea nueva (estado TODO) en AGENT_TASKS.md con todos los campos obligatorios.",
  risk: "write",
  inputSchema: z.object({
    title: z.string().min(5).max(120),
    description: z.string().min(10),
    priority: z.enum(["P0", "P1", "P2", "P3"]),
    area: z.enum(["backend", "frontend", "database", "security", "testing", "debugging", "git", "api", "documentation", "qa", "deployment", "architecture", "agent"]),
    dependencies: z.array(z.string().regex(/^AGT-\d+$/)).default([]),
    files: z.array(z.string()).default([]),
    acceptance: z.string().min(10),
    tests: z.string().min(5),
  }),
  handler: async (args, ctx) => {
    await guard(ctx, "task_create", args, requireCapability(ctx.profile, "allowFileWrites"));
    const t = createTask(args, ctx.workRoot);
    noteFile("AGENT_TASKS.md");
    return brief(t);
  },
});

defineTool({
  name: "task_update",
  description: "Cambia el estado/resultado de una tarea. Transiciones validas; IN_PROGRESS exige dependencias DONE; el agente NO puede poner DONE (deja la tarea en REVIEW para revision humana).",
  risk: "write",
  inputSchema: z.object({ id: z.string().regex(/^AGT-\d+$/), status: z.enum(["TODO", "IN_PROGRESS", "BLOCKED", "REVIEW", "DONE"]).optional(), result: z.string().max(4000).optional(), files: z.array(z.string()).optional() }),
  handler: async ({ id, status, result, files }, ctx) => {
    await guard(ctx, "task_update", { id, status }, requireCapability(ctx.profile, "allowFileWrites"));
    const t = updateTask(id, { status, result, files }, { root: ctx.workRoot });
    noteFile("AGENT_TASKS.md");
    updateStatus({ currentTask: t["Estado"] === "IN_PROGRESS" ? `${id} ${t.title}` : undefined, ...(status === "REVIEW" ? { currentTask: null, nextAction: "Revision humana" } : {}) });
    return brief(t);
  },
});

defineTool({
  name: "memory_add",
  description: "Guarda una entrada de memoria persistente (decision, problem, solution, convention, task, dependency, change) en .agent/memory.jsonl. Se redactan secretos automaticamente. No sustituye a la documentacion del repo.",
  risk: "write",
  inputSchema: z.object({ type: z.enum(MEMORY_TYPES), title: z.string().min(4).max(160), content: z.string().min(10).max(4000), tags: z.array(z.string()).max(10).default([]) }),
  handler: async (args, ctx) => {
    await guard(ctx, "memory_add", { type: args.type, title: args.title }, requireCapability(ctx.profile, "allowFileWrites"));
    const e = addMemory({ ...args, source: `${ctx.agent}/${ctx.runId}` }, ctx.workRoot);
    noteFile(".agent/memory.jsonl");
    return { id: e.id, redacted: e.redacted };
  },
});

defineTool({
  name: "memory_search",
  description: "Busca en la memoria persistente por palabras clave (titulo, contenido, tags). Consultala antes de empezar una tarea.",
  risk: "read",
  inputSchema: z.object({ query: z.string().min(2), type: z.enum(MEMORY_TYPES).optional(), limit: z.number().int().min(1).max(30).default(8) }),
  handler: async ({ query, type, limit }, ctx) => searchMemory(query, { type, limit }, ctx.workRoot),
});

defineTool({
  name: "memory_recent",
  description: "Ultimas entradas de memoria.",
  risk: "read",
  inputSchema: z.object({ limit: z.number().int().min(1).max(50).default(10) }),
  handler: async ({ limit }, ctx) => readMemory(ctx.workRoot).slice(-limit).reverse(),
});

export { STATES };
