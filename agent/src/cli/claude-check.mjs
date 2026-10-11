#!/usr/bin/env node
// Comprobacion segura de Claude Code como motor de Jarvis (proveedor "claude-code").
//   npm --prefix agent run claude:check
// No muestra nunca claves, tokens ni cookies: solo CONFIGURADA / NO CONFIGURADA y el origen de la credencial.
import { spawnSync } from "node:child_process";
import { claudeCodeEnv } from "../llm/claude-code.mjs";

const bin = process.env.AGENT_CLAUDE_BIN || "claude";
const env = claudeCodeEnv();
const run = (args, input) => spawnSync(bin, args, { env, input, encoding: "utf8", timeout: 120000 });
const mask = (s) => String(s ?? "").replace(/(sk-[A-Za-z0-9_-]{4})[A-Za-z0-9_-]+/g, "$1…[redactado]").replace(/(token|key|secret)(["':= ]+)[^\s",}]+/gi, "$1$2[redactado]");
const line = (k, v) => console.log(`${k.padEnd(34)} ${v}`);

console.log("== Claude Code como motor de Jarvis ==");
const v = run(["--version"]);
if (v.error || v.status !== 0) { line("Comando `claude`", "NO DISPONIBLE (instala Claude Code y ejecuta `claude` para iniciar sesion)"); process.exit(1); }
line("Comando `claude`", `disponible · ${v.stdout.trim()}`);
line("ANTHROPIC_API_KEY en tu entorno", process.env.ANTHROPIC_API_KEY ? "CONFIGURADA (el runner la ignora salvo AGENT_CLAUDE_ALLOW_API_KEY=1)" : "NO CONFIGURADA");
line("OPENAI_API_KEY (no se usa)", process.env.OPENAI_API_KEY ? "CONFIGURADA (ignorada)" : "NO CONFIGURADA");

const a = run(["auth", "status"]);
try {
  const j = JSON.parse(a.stdout);
  line("Sesion iniciada", j.loggedIn ? "si" : "NO (ejecuta `claude` y haz /login)");
  line("Metodo de autenticacion", mask(j.authMethod ?? j.method ?? "desconocido"));
  if (j.subscriptionType) line("Plan", j.subscriptionType);
} catch { line("claude auth status", mask(a.stdout || a.stderr).slice(0, 200) || "sin salida"); }

const t = run(["-p", "Responde únicamente con: JARVIS_OK", "--output-format", "stream-json", "--verbose", "--tools", "", "--max-turns", "1", "--no-session-persistence", "--setting-sources", "user"]);
let source = null, result = null;
for (const l of String(t.stdout).split("\n")) { try { const e = JSON.parse(l); if (e.type === "system" && e.subtype === "init") source = e.apiKeySource; if (e.type === "result") result = e; } catch { /* no JSON */ } }
line("Origen de la credencial usada", source === "none" ? "suscripcion (OAuth de claude.ai) ✔" : source ? `OTRA (${source}) ✘ se cobraria a la API` : "desconocido");
line("`claude -p` responde", result && !result.is_error ? `si · "${String(result.result).trim().slice(0, 40)}"` : `NO · ${mask(result?.result ?? t.stderr ?? "sin respuesta").slice(0, 200)}`);
if (result?.total_cost_usd != null) line("Coste equivalente en API (estimado)", `$${result.total_cost_usd.toFixed(4)} · con suscripcion no se cobra: consume tu cupo del plan`);
process.exit(result && !result.is_error && source === "none" ? 0 : 1);
