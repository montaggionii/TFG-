import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Los datos del agente van a un directorio temporal: ninguna prueba toca agent/data.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "claude-code-test-"));
process.env.AGENT_DATA_DIR = path.join(tmp, "data");
process.env.AGENT_ENV = "local";

const { claudeCodeEnv, claudeCodeArgs, claudeCode } = await import("../src/llm/claude-code.mjs");
const { createProvider } = await import("../src/llm/providers.mjs");
const { createContext } = await import("../src/tools/index.mjs");

// `claude` falso: emite el stream-json que pida FAKE_SCENARIO. Nunca llama a ningun servicio.
const fake = path.join(tmp, "claude");
fs.writeFileSync(fake, `#!/usr/bin/env node
const ev = (o) => console.log(JSON.stringify(o));
const init = (src) => ev({ type: "system", subtype: "init", model: "claude-test", apiKeySource: src, mcp_servers: [{ name: "fidelyfood", status: process.env.FAKE_MCP || "connected" }] });
const usage = { input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 100, cache_read_input_tokens: 1000 };
process.stdin.resume(); process.stdin.on("data", () => {}); process.stdin.on("end", () => {
  const s = process.env.FAKE_SCENARIO;
  if (s === "ok") { init("none"); ev({ type: "assistant", message: { content: [{ type: "tool_use", id: "a", name: "mcp__fidelyfood__git_status", input: {} }], usage } }); ev({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "a", content: [{ type: "text", text: "{}" }] }] } }); ev({ type: "assistant", message: { content: [{ type: "text", text: "JARVIS_OK" }], usage } }); ev({ type: "result", subtype: "success", is_error: false, result: "JARVIS_OK", num_turns: 2, total_cost_usd: 0.01, usage }); }
  if (s === "approval") { init("none"); ev({ type: "assistant", message: { content: [{ type: "tool_use", id: "a", name: "mcp__fidelyfood__execute_database_statement", input: {} }], usage } }); ev({ type: "user", message: { content: [{ type: "tool_result", is_error: true, tool_use_id: "a", content: [{ type: "text", text: JSON.stringify({ ok: false, status: "approval_required", approval_id: "apr_1", reason: "escritura en BD" }) }] }] } }); setInterval(() => {}, 1000); }
  if (s === "apikey") { init("ANTHROPIC_API_KEY"); setInterval(() => {}, 1000); }
  if (s === "env") { init("none"); ev({ type: "result", subtype: "success", is_error: false, result: [process.env.ANTHROPIC_API_KEY ? "KEY" : "NOKEY", process.env.CLAUDECODE ? "CC" : "NOCC"].join(","), num_turns: 1, usage }); }
  if (s === "maxturns") { init("none"); ev({ type: "result", subtype: "error_max_turns", is_error: false, result: "", num_turns: 3, usage }); }
});
`, { mode: 0o755 });

const stats = () => ({ steps: 0, tokens: { input: 0, output: 0 }, cost: null, toolCalls: {}, errors: 0 });
const budgets = { maxSteps: 5, maxWallClockMinutes: 1, maxTotalTokens: 1_000_000, maxCostUsd: null };
async function runScenario(scenario, extraEnv = {}, b = budgets) {
  const env = { ...process.env, AGENT_CLAUDE_BIN: fake, FAKE_SCENARIO: scenario, ...extraEnv };
  const provider = claudeCode({ model: null, env });
  const s = stats();
  const ctx = createContext({ runId: `run_test_${scenario}` });
  const out = await provider.run({ system: "sys", userText: "hola", budgets: b, ctx, stats: s });
  return { out, s };
}

test("credenciales: se quitan las variables que harian cobrar a la API (salvo opt-in) y CLAUDECODE", () => {
  const base = { ANTHROPIC_API_KEY: "k", ANTHROPIC_AUTH_TOKEN: "t", CLAUDE_CODE_USE_BEDROCK: "1", CLAUDECODE: "1", PATH: "/bin", OPENAI_API_KEY: "o" };
  const env = claudeCodeEnv(base);
  assert.deepEqual(Object.keys(env).sort(), ["OPENAI_API_KEY", "PATH"]);
  assert.equal(base.ANTHROPIC_API_KEY, "k", "no muta el entorno original");
  assert.equal(claudeCodeEnv({ ...base, AGENT_CLAUDE_ALLOW_API_KEY: "1" }).ANTHROPIC_API_KEY, "k");
});

test("argumentos: solo herramientas MCP, sin --bare (que no usa la suscripcion), sin prompts y sin sesion persistente", () => {
  const a = claudeCodeArgs({ model: "sonnet", maxTurns: 7, maxCostUsd: 2, mcpConfigFile: "/m.json", systemFile: "/s.md" });
  assert.ok(!a.includes("--bare"));
  assert.ok(a.includes("--strict-mcp-config") && a.includes("--no-session-persistence"));
  assert.equal(a[a.indexOf("--tools") + 1], "");
  assert.equal(a[a.indexOf("--permission-mode") + 1], "dontAsk");
  assert.equal(a[a.indexOf("--allowedTools") + 1], "mcp__fidelyfood");
  assert.equal(a[a.indexOf("--max-turns") + 1], "7");
  assert.equal(a[a.indexOf("--model") + 1], "sonnet");
  assert.equal(a[a.indexOf("--max-budget-usd") + 1], "2");
});

test("createProvider('claude-code'): no exige API key ni entrada en models.json; OpenAI sigue pidiendo la suya", () => {
  const p = createProvider({ provider: "claude-code", env: {} });
  assert.equal(p.name, "claude-code");
  assert.equal(p.delegated, true);
  assert.throws(() => createProvider({ provider: "openai", model: "m", env: {} }), /OPENAI_API_KEY/);
});

test("run completado: cuenta pasos, herramientas y tokens, y usa la suscripcion", async () => {
  const { out, s } = await runScenario("ok");
  assert.equal(out.stop, "completed");
  assert.equal(out.text, "JARVIS_OK");
  assert.equal(out.auth, "none");
  assert.equal(s.steps, 2);
  assert.equal(s.toolCalls.git_status, 1);
  assert.equal(s.cost, 0.01);
  assert.equal(s.cacheReadTokens, 1000);
});

test("approval_required: el run se detiene y queda bloqueado esperando a una persona", async () => {
  const { out } = await runScenario("approval");
  assert.equal(out.stop, "approval_required");
  assert.equal(out.blocked.approvalId, "apr_1");
});

test("si Claude Code usaria una API key en vez de la suscripcion, se aborta antes de gastar", async () => {
  const { out } = await runScenario("apikey");
  assert.equal(out.stop, "provider_error");
  assert.match(out.text, /no usa la suscripcion/);
  const ok = await runScenario("apikey", { AGENT_CLAUDE_ALLOW_API_KEY: "1", FAKE_SCENARIO: "ok" });
  assert.equal(ok.out.stop, "completed");
});

test("si el servidor MCP de FidelyFood no conecta, error claro", async () => {
  const { out } = await runScenario("ok", { FAKE_MCP: "failed" });
  assert.equal(out.stop, "provider_error");
  assert.match(out.text, /MCP/);
});

test("el proceso hijo no recibe ANTHROPIC_API_KEY ni CLAUDECODE", async () => {
  const { out } = await runScenario("env", { ANTHROPIC_API_KEY: "no-debe-llegar", CLAUDECODE: "1" });
  assert.equal(out.text, "NOKEY,NOCC");
});

test("presupuestos: tokens (se corta en cuanto se supera) y turnos maximos", async () => {
  const tok = await runScenario("ok", {}, { ...budgets, maxTotalTokens: 50 });
  assert.equal(tok.out.stop, "token_budget");
  const turns = await runScenario("maxturns");
  assert.equal(turns.out.stop, "max_steps");
});

test("sin el comando claude: error accionable", async () => {
  const provider = claudeCode({ model: null, env: { ...process.env, AGENT_CLAUDE_BIN: path.join(tmp, "no-existe") } });
  const out = await provider.run({ system: "s", userText: "u", budgets, ctx: createContext({ runId: "run_test_nobin" }), stats: stats() });
  assert.equal(out.stop, "provider_error");
  assert.match(out.text, /No se encontro el comando/);
});
