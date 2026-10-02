#!/usr/bin/env node
// CLI de aprobaciones HUMANAS. Uso:
//   npm --prefix agent run approve -- list
//   npm --prefix agent run approve -- show <id>
//   npm --prefix agent run approve -- approve <id>
//   npm --prefix agent run approve -- deny <id>
import readline from "node:readline/promises";
import { listRequests, decide } from "../lib/approvals.mjs";

const [cmd, id] = process.argv.slice(2);
const pretty = (r) => `${r.id}  [${r.status}${r.consumed ? ", usada" : ""}]  ${r.tool}\n  motivo:  ${r.reason}\n  accion:  ${r.summary}\n  pedida:  ${r.requestedAt}`;

if (cmd === "list" || !cmd) {
  const all = listRequests();
  const shown = process.argv.includes("--all") ? all : all.filter((r) => r.status === "pending");
  console.log(shown.length ? shown.map(pretty).join("\n\n") : "No hay aprobaciones pendientes.");
  process.exit(0);
}

if (cmd === "show") {
  const r = listRequests().find((x) => x.id === id);
  console.log(r ? pretty(r) : `No existe ${id}`);
  process.exit(r ? 0 : 1);
}

if (cmd === "approve" || cmd === "deny") {
  // Un agente que ejecute esto por tuberias no tiene TTY: se niega.
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error("Las aprobaciones solo pueden darse desde una terminal interactiva, por una persona.");
    process.exit(2);
  }
  const r = listRequests().find((x) => x.id === id);
  if (!r) {
    console.error(`No existe la solicitud ${id}`);
    process.exit(1);
  }
  console.log(pretty(r));
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(`\n¿${cmd === "approve" ? "APROBAR" : "DENEGAR"} esta accion exacta? Escribe "si" para confirmar: `)).trim().toLowerCase();
  rl.close();
  if (answer !== "si") {
    console.log("Cancelado. No se ha registrado ninguna decision.");
    process.exit(0);
  }
  const out = decide(id, cmd === "approve" ? "approved" : "denied");
  console.log(`Registrado: ${out.id} → ${out.status}. ${cmd === "approve" ? "El agente puede repetir la llamada con approval_id (valida una vez, 30 min)." : ""}`);
  process.exit(0);
}

console.error("Uso: approve.mjs list [--all] | show <id> | approve <id> | deny <id>");
process.exit(1);
