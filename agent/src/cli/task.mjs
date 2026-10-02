#!/usr/bin/env node
// CLI humano para el sistema de tareas.
//   npm --prefix agent run task -- list [estado]
//   npm --prefix agent run task -- done AGT-001      (solo una persona; exige terminal interactiva)
//   npm --prefix agent run task -- set AGT-001 TODO|IN_PROGRESS|BLOCKED|REVIEW
import { parseTasks, updateTask, STATES } from "../lib/tasks.mjs";

const [cmd, id, state] = process.argv.slice(2);

if (!cmd || cmd === "list") {
  const filter = id;
  for (const t of parseTasks()) {
    if (filter && t["Estado"] !== filter) continue;
    console.log(`${t.ID}  ${t["Estado"].padEnd(11)} ${t["Prioridad"]}  ${t["Área"].padEnd(14)} ${t.title}`);
  }
  process.exit(0);
}

if (cmd === "done" || cmd === "set") {
  if (cmd === "done" && (!process.stdin.isTTY || !process.stdout.isTTY)) {
    console.error("Cerrar una tarea (DONE) solo puede hacerlo una persona desde una terminal interactiva.");
    process.exit(2);
  }
  const target = cmd === "done" ? "DONE" : state;
  if (cmd === "set" && target === "DONE") {
    console.error("Para cerrar una tarea usa `done` (exige terminal interactiva).");
    process.exit(2);
  }
  if (!id || !STATES.includes(target)) {
    console.error(`Uso: task.mjs done <AGT-xxx> | set <AGT-xxx> <${STATES.join("|")}>`);
    process.exit(1);
  }
  try {
    const t = updateTask(id, { status: target }, { human: true });
    console.log(`${t.ID} → ${t["Estado"]}`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
  process.exit(0);
}

console.error("Uso: task.mjs list [estado] | done <id> | set <id> <estado>");
process.exit(1);
