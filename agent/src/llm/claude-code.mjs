import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DATA_DIR, AGENT_ROOT, ensureDir } from "../lib/paths.mjs";
import { updateStatus } from "../lib/status.mjs";
import { redact } from "../lib/redact.mjs";

// Proveedor "claude-code": en vez de pedir al modelo un paso cada vez (complete()),
// delega TODO el bucle agentico en `claude -p` (Claude Code en modo no interactivo)
// autenticado con la suscripcion de Claude. Las herramientas siguen siendo las del
// servidor MCP de FidelyFood (politica, approvals, audit y memoria viven ahi), y
// se desactivan las herramientas nativas de Claude Code (Bash, Edit...).

const MCP_PREFIX = "mcp__fidelyfood__";
// Variables que harian que Claude Code facture a la API en vez de usar la suscripcion.
const BILLING_VARS = ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "CLAUDE_CODE_USE_BEDROCK", "CLAUDE_CODE_USE_VERTEX", "CLAUDE_CODE_USE_FOUNDRY"];

export function claudeCodeEnv(base = process.env) {
  const env = { ...base };
  delete env.CLAUDECODE; // permite lanzarlo desde dentro de otra sesion de Claude Code
  if (env.AGENT_CLAUDE_ALLOW_API_KEY !== "1") for (const k of BILLING_VARS) delete env[k];
  return env;
}

export function claudeCodeArgs({ model, maxTurns, maxCostUsd, mcpConfigFile, systemFile }) {
  const args = ["-p", "--output-format", "stream-json", "--verbose", "--mcp-config", mcpConfigFile, "--strict-mcp-config", "--tools", "", "--allowedTools", "mcp__fidelyfood", "--permission-mode", "dontAsk", "--max-turns", String(maxTurns), "--no-session-persistence", "--setting-sources", "user", "--disable-slash-commands", "--append-system-prompt-file", systemFile];
  if (model) args.push("--model", model);
  if (maxCostUsd != null) args.push("--max-budget-usd", String(maxCostUsd));
  return args;
}

export function claudeCode({ model, env = process.env, spawnImpl = spawn }) {
  return {
    name: "claude-code",
    model: model || "claude-code (modelo de tu suscripcion)",
    delegated: true,
    pricePerMTok: null,
    // Ejecuta el bucle completo. Actualiza `stats` y devuelve {stop, text, blocked, auth}.
    async run({ system, userText, budgets, ctx, stats, log = () => {} }) {
      const bin = env.AGENT_CLAUDE_BIN || "claude";
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fidelyfood-claude-"));
      const childStatus = path.join(ensureDir(DATA_DIR), `status.${ctx.runId}.child.json`);
      const mcpConfigFile = path.join(tmp, "mcp.json");
      const systemFile = path.join(tmp, "system.md");
      fs.writeFileSync(systemFile, system);
      fs.writeFileSync(mcpConfigFile, JSON.stringify({ mcpServers: { fidelyfood: { command: process.execPath, args: [path.join(AGENT_ROOT, "src", "mcp", "server.mjs")], env: {
        AGENT_ENV: ctx.profile.name, AGENT_NAME: "jarvis-claude-code", AGENT_PROVIDER: "claude-code", AGENT_MODEL: model || "", AGENT_RUN_ID: ctx.runId, AGENT_STATUS_FILE: childStatus,
        ...(env.AGENT_WORKDIR ? { AGENT_WORKDIR: env.AGENT_WORKDIR } : {}), ...(env.AGENT_DATA_DIR ? { AGENT_DATA_DIR: env.AGENT_DATA_DIR } : {}),
      } } } }));

      const args = claudeCodeArgs({ model, maxTurns: budgets.maxSteps, maxCostUsd: budgets.maxCostUsd, mcpConfigFile, systemFile });
      const child = spawnImpl(bin, args, { cwd: ctx.workRoot, env: claudeCodeEnv(env), stdio: ["pipe", "pipe", "pipe"] });
      child.stdin.end(userText);

      let stop = null, text = "", blocked = null, auth = null, stderr = "", buffer = "", killed = null, sawResult = false;
      const kill = (reason) => { if (!killed) { killed = reason; child.kill("SIGTERM"); } };
      const timer = setTimeout(() => kill("timeout"), budgets.maxWallClockMinutes * 60000);
      const sync = () => {
        try {
          const c = JSON.parse(fs.readFileSync(childStatus, "utf8"));
          updateStatus({ filesChanged: c.filesChanged ?? [], testsPassed: c.testsPassed ?? 0, testsFailed: c.testsFailed ?? 0, errors: c.errors ?? [] });
        } catch { /* el servidor MCP aun no ha escrito nada */ }
      };

      const onEvent = (e) => {
        if (e.type === "system" && e.subtype === "init") {
          auth = e.apiKeySource ?? null;
          if (e.model) { this.model = e.model; updateStatus({ model: e.model }); }
          const mcp = (e.mcp_servers ?? []).find((s) => s.name === "fidelyfood");
          if (!mcp || mcp.status !== "connected") { stop = "provider_error"; text = `El servidor MCP de FidelyFood no conecto en Claude Code (estado: ${mcp?.status ?? "ausente"}).`; kill("mcp"); return; }
          if (auth !== "none" && env.AGENT_CLAUDE_ALLOW_API_KEY !== "1") { stop = "provider_error"; text = `Claude Code no usa la suscripcion sino otra credencial (origen: ${auth}). Cierra sesion de la API/Console o define AGENT_CLAUDE_ALLOW_API_KEY=1 si aceptas el cobro por API.`; kill("auth"); return; }
        } else if (e.type === "assistant" && Array.isArray(e.message?.content)) {
          const u = e.message.usage ?? {};
          stats.tokens.input += (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
          stats.tokens.output += u.output_tokens ?? 0;
          stats.cacheReadTokens = (stats.cacheReadTokens ?? 0) + (u.cache_read_input_tokens ?? 0);
          stats.steps += 1;
          for (const c of e.message.content) {
            if (c.type !== "tool_use") continue;
            const name = c.name.replace(MCP_PREFIX, "");
            stats.toolCalls[name] = (stats.toolCalls[name] ?? 0) + 1;
            log(`  [${stats.steps}] ${name} ${redact(JSON.stringify(c.input ?? {})).slice(0, 140)}`);
            updateStatus({ currentOperation: name });
          }
          updateStatus({ steps: stats.steps, tokens: { ...stats.tokens } });
          if (stats.tokens.input + stats.tokens.output > budgets.maxTotalTokens) { stop = "token_budget"; kill("token_budget"); }
        } else if (e.type === "user" && Array.isArray(e.message?.content)) {
          for (const c of e.message.content) {
            if (c.type !== "tool_result") continue;
            const body = Array.isArray(c.content) ? c.content.map((p) => p.text ?? "").join("\n") : String(c.content ?? "");
            if (c.is_error) stats.errors += 1;
            if (/"status":\s*"approval_required"/.test(body)) {
              try { const r = JSON.parse(body); blocked = { tool: r.tool ?? null, approvalId: r.approval_id, reason: r.reason }; } catch { blocked = { tool: null, approvalId: null, reason: "approval_required" }; }
              stop = "approval_required"; kill("approval");
            }
          }
          sync();
        } else if (e.type === "result") {
          sawResult = true;
          text = stop ? text || (e.result ?? "") : e.result ?? text;
          if (e.usage) { stats.tokens.input = (e.usage.input_tokens ?? 0) + (e.usage.cache_creation_input_tokens ?? 0); stats.tokens.output = e.usage.output_tokens ?? 0; stats.cacheReadTokens = e.usage.cache_read_input_tokens ?? 0; }
          if (typeof e.num_turns === "number") stats.steps = e.num_turns;
          stats.cost = typeof e.total_cost_usd === "number" ? e.total_cost_usd : null;
          if (!stop) stop = e.subtype === "success" && !e.is_error ? "completed" : e.subtype === "error_max_turns" ? "max_steps" : e.subtype === "error_max_budget_usd" ? "cost_budget" : "provider_error";
        }
      };

      child.stdout.on("data", (d) => {
        buffer += d;
        let i;
        while ((i = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, i).trim(); buffer = buffer.slice(i + 1);
          if (line) { try { onEvent(JSON.parse(line)); } catch { /* linea no JSON */ } }
        }
      });
      child.stderr.on("data", (d) => { stderr = (stderr + d).slice(-2000); });
      const code = await new Promise((resolve) => { child.on("error", (err) => { stderr = err.code === "ENOENT" ? `No se encontro el comando "${bin}". Instala Claude Code y ejecuta "claude" para iniciar sesion.` : err.message; resolve(-1); }); child.on("close", resolve); });
      clearTimeout(timer);
      sync();
      fs.rmSync(tmp, { recursive: true, force: true });
      fs.rmSync(childStatus, { force: true });

      if (killed === "timeout") { stop = "timeout"; text = text || "Tiempo maximo agotado."; }
      else if (!stop) { stop = "provider_error"; text = text || `Claude Code termino sin resultado (codigo ${code}). ${redact(stderr)}`.trim(); }
      else if (stop === "provider_error" && !text) text = redact(stderr);
      return { stop, text, blocked, auth, sawResult };
    },
  };
}
