#!/usr/bin/env node
// Convierte un evento en una tarea de AGENT_TASKS.md y, con --run, lanza el runner.
//   npm --prefix agent run event -- issue 12 [--run]
//   npm --prefix agent run event -- error backend [--run]
//   npm --prefix agent run event -- feature "Que los usuarios vean sus puntos por restaurante" [--area frontend] [--run]
import { spawn } from "node:child_process";
import path from "node:path";
import { createContext } from "../tools/index.mjs";
import { taskFromIssue, taskFromErrors, taskFromFeature } from "../events/handlers.mjs";
import { AGENT_ROOT } from "../lib/paths.mjs";

const [kind, ...rest] = process.argv.slice(2);
const flags = new Set(rest.filter((a) => a.startsWith("--") && !a.startsWith("--area")));
const positional = rest.filter((a, i) => !a.startsWith("--") && rest[i - 1] !== "--area");
const area = rest.includes("--area") ? rest[rest.indexOf("--area") + 1] : undefined;
const ctx = createContext({ agent: "event-cli" });

let task;
if (kind === "issue" && positional[0]) task = await taskFromIssue(Number(positional[0]), ctx);
else if (kind === "error" && positional[0]) task = await taskFromErrors(positional[0], ctx);
else if (kind === "feature" && positional[0]) task = taskFromFeature(positional.join(" "), ctx, { area });
else {
  console.error('Uso: event.mjs issue <numero> | error <backend|frontend> | feature "<texto>" [--area x] [--run]');
  process.exit(1);
}

if (!task) {
  console.log("No se encontraron errores en el log: no se crea ninguna tarea.");
  process.exit(0);
}
console.log(`Tarea creada: ${task.ID} · ${task.title} (${task["Prioridad"]}, ${task["Área"]})`);
if (flags.has("--run")) {
  const child = spawn(process.execPath, [path.join(AGENT_ROOT, "src", "runner", "run.mjs"), "--task", task.ID], { stdio: "inherit" });
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  console.log(`Para ejecutarla: npm --prefix agent run run -- --task ${task.ID}   (o desde Claude Code: pidele que ejecute ${task.ID})`);
}
