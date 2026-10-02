import fs from "node:fs";
import path from "node:path";
import { WORK_ROOT } from "./paths.mjs";

export const STATES = ["TODO", "IN_PROGRESS", "BLOCKED", "REVIEW", "DONE"];
export const FIELDS = ["ID", "Descripción", "Prioridad", "Área", "Estado", "Dependencias", "Archivos afectados", "Criterios de aceptación", "Tests necesarios", "Resultado"];
const START = "<!-- TASKS:START -->";
const END = "<!-- TASKS:END -->";

export const tasksFile = (root = WORK_ROOT) => path.join(root, "AGENT_TASKS.md");

function readDoc(root) {
  const text = fs.readFileSync(tasksFile(root), "utf8");
  const s = text.indexOf(START);
  const e = text.indexOf(END);
  if (s < 0 || e < 0 || e < s) throw new Error(`AGENT_TASKS.md no contiene el bloque ${START} ... ${END}`);
  return { text, s: s + START.length, e };
}

export function parseTasks(root = WORK_ROOT) {
  const { text, s, e } = readDoc(root);
  const block = text.slice(s, e);
  const parts = block.split(/^### (?=AGT-\d+)/m).slice(1);
  return parts.map((part) => {
    const [titleLine, ...rest] = part.split("\n");
    const task = { title: titleLine.replace(/^AGT-\d+\s*[·-]\s*/, "").trim() };
    let current = null;
    for (const line of rest) {
      const m = line.match(/^- \*\*([^:*]+):\*\*\s?(.*)$/);
      if (m) {
        current = m[1].trim();
        task[current] = m[2].trim();
      } else if (current && /^\s{2,}\S/.test(line)) {
        task[current] += `\n${line.trim()}`;
      }
    }
    task.deps = (task["Dependencias"] || "").split(/[,\s]+/).filter((d) => /^AGT-\d+$/.test(d));
    task.files = (task["Archivos afectados"] || "").split(/,\s*/).map((f) => f.trim()).filter((f) => f && f !== "—");
    return task;
  });
}

function render(task) {
  const lines = [`### ${task.ID} · ${task.title}`];
  for (const f of FIELDS) lines.push(`- **${f}:** ${(task[f] ?? "—").toString().replace(/\n/g, "\n  ")}`);
  return lines.join("\n");
}

function writeTasks(tasks, root) {
  const { text, s, e } = readDoc(root);
  const body = `\n\n${tasks.map(render).join("\n\n")}\n\n`;
  fs.writeFileSync(tasksFile(root), text.slice(0, s) + body + text.slice(e));
}

export function nextId(tasks) {
  const max = tasks.reduce((m, t) => Math.max(m, Number((t.ID || "").replace("AGT-", "")) || 0), 0);
  return `AGT-${String(max + 1).padStart(3, "0")}`;
}

export function createTask(fields, root = WORK_ROOT) {
  const tasks = parseTasks(root);
  const task = { title: fields.title, ID: nextId(tasks), Estado: "TODO" };
  task["Descripción"] = fields.description;
  task["Prioridad"] = fields.priority;
  task["Área"] = fields.area;
  task["Dependencias"] = (fields.dependencies ?? []).join(", ") || "—";
  task["Archivos afectados"] = (fields.files ?? []).join(", ") || "—";
  task["Criterios de aceptación"] = fields.acceptance;
  task["Tests necesarios"] = fields.tests;
  task["Resultado"] = "—";
  tasks.push(task);
  writeTasks(tasks, root);
  return task;
}

const TRANSITIONS = {
  TODO: ["IN_PROGRESS", "BLOCKED"],
  IN_PROGRESS: ["REVIEW", "BLOCKED", "TODO"],
  BLOCKED: ["TODO", "IN_PROGRESS"],
  REVIEW: ["IN_PROGRESS", "DONE", "BLOCKED"],
  DONE: [],
};

// `human` permite DONE: el agente deja las tareas en REVIEW y solo una persona las cierra.
export function updateTask(id, patch, { human = false, root = WORK_ROOT } = {}) {
  const tasks = parseTasks(root);
  const task = tasks.find((t) => t.ID === id);
  if (!task) throw new Error(`No existe la tarea ${id}`);
  if (patch.status && patch.status !== task["Estado"]) {
    if (!STATES.includes(patch.status)) throw new Error(`Estado invalido: ${patch.status}`);
    if (patch.status === "DONE" && !human) throw new Error("Solo una persona puede marcar una tarea como DONE; deja la tarea en REVIEW.");
    if (!TRANSITIONS[task["Estado"]]?.includes(patch.status)) throw new Error(`Transicion no permitida: ${task["Estado"]} → ${patch.status}`);
    if (patch.status === "IN_PROGRESS") {
      const open = task.deps.filter((d) => tasks.find((t) => t.ID === d)?.["Estado"] !== "DONE");
      if (open.length) throw new Error(`Dependencias sin completar (DONE): ${open.join(", ")}`);
    }
    task["Estado"] = patch.status;
  }
  if (patch.result !== undefined) task["Resultado"] = patch.result;
  if (patch.files) task["Archivos afectados"] = patch.files.join(", ") || "—";
  writeTasks(tasks, root);
  return task;
}
