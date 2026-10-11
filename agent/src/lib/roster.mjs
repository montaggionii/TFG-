import fs from "node:fs";
import path from "node:path";
import { AGENT_ROOT } from "./paths.mjs";

// Roster de agentes de desarrollo de FidelyFood (config/agents.json).
// Un "agente" es un rol: instrucciones + herramientas expuestas + rutas de escritura.
// Todos usan el mismo motor de ejecucion; su estado real sale de las ejecuciones, nunca de aqui.
const FILE = path.join(AGENT_ROOT, "config", "agents.json");

export function loadRoster(file = FILE) {
  const cfg = JSON.parse(fs.readFileSync(file, "utf8"));
  const ids = new Set();
  for (const a of cfg.agents) {
    if (ids.has(a.id)) throw new Error(`Agente duplicado en el roster: ${a.id}`);
    ids.add(a.id);
    if (a.mode === "read" && a.writePaths.length) throw new Error(`${a.id}: un agente de solo lectura no puede tener writePaths`);
    if (a.extraTools.some((t) => ["write_file", "git_commit"].includes(t)) && !a.writePaths.length) throw new Error(`${a.id}: escribe pero no declara writePaths`);
  }
  return { baseTools: cfg.baseTools, agents: cfg.agents };
}

export function getAgent(id, roster = loadRoster()) {
  return roster.agents.find((a) => a.id === id) ?? null;
}

export function allowedToolsFor(agent, roster = loadRoster()) {
  return new Set([...roster.baseTools, ...agent.extraTools]);
}

// Elige agente por area de la tarea (AGENT_TASKS.md). Enrutado determinista por reglas, no por LLM.
export function routeByArea(area, roster = loadRoster()) {
  const a = String(area ?? "").toLowerCase();
  return roster.agents.find((x) => x.id !== "harvey" && x.areas.includes(a)) ?? null;
}

export function checkWritePath(agent, relPath) {
  if (!agent.writePaths.length) return false;
  const p = String(relPath).replace(/^\.\//, "");
  return agent.writePaths.some((re) => new RegExp(re).test(p));
}

export function rolePrompt(agent) {
  const mode = agent.mode === "write" ? `Puedes escribir SOLO en: ${agent.writePaths.join(", ")}.` : "Eres de SOLO LECTURA: no puedes modificar archivos ni hacer commits.";
  return `ROL ASIGNADO: ${agent.name} (${agent.id}), departamento ${agent.department}. ${agent.role}\n${mode}\nSkills recomendadas: ${agent.skills.join(", ")}. Si la tarea sale de tu ambito, detente y dilo: Harvey la reasignara.`;
}
