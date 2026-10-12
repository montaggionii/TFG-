#!/usr/bin/env node
// CLI de aprobaciones HUMANAS. Uso:
//   npm --prefix agent run approve -- list
//   npm --prefix agent run approve -- show <id>
//   npm --prefix agent run approve -- approve <id>
//   npm --prefix agent run approve -- deny <id>
//   npm --prefix agent run approve -- ui-code      (codigo para desbloquear el Centro de Aprobaciones web)
import readline from "node:readline/promises";
import { listRequests, decide } from "../lib/approvals.mjs";
import { createUnlockCode, MAX_FAILED_ATTEMPTS } from "../lib/ui-unlock.mjs";

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

if (cmd === "ui-code") {
  // Codigo de un solo uso para desbloquear el Centro de Aprobaciones web. Igual que
  // approve/deny: solo una persona en una terminal interactiva.
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error("El codigo de desbloqueo solo puede generarse desde una terminal interactiva, por una persona.");
    process.exit(2);
  }
  const { code, expiresAt } = createUnlockCode();
  console.log(`Codigo de desbloqueo del Centro de Aprobaciones: ${code}`);
  console.log(`Caduca ${expiresAt} (5 min), vale una sola vez y se invalida tras ${MAX_FAILED_ATTEMPTS} fallos.`);
  console.log("Tecleado en la Oficina abre una sesion de aprobaciones de 15 min de inactividad. No lo compartas ni lo pegues en ningun chat.");
  process.exit(0);
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
  if (r.lifecycle !== "pending") {
    console.error(`La solicitud ${id} no esta pendiente (estado: ${r.lifecycle}${r.expiresAt ? `, vigencia hasta ${r.expiresAt}` : ""}). Si caduco, el agente debe pedir una aprobacion nueva.`);
    process.exit(1);
  }
  console.log(pretty(r));
  const rl =readline.createInterface({ input: process.stdin, output: process.stdout });
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

console.error("Uso: approve.mjs list [--all] | show <id> | approve <id> | deny <id> | ui-code");
process.exit(1);
