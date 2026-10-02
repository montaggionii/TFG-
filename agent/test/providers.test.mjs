import { test } from "node:test";
import assert from "node:assert/strict";
import { createProvider, estimateCost } from "../src/llm/providers.mjs";
import { toolSpecs, geminiSchema } from "../src/llm/schema.mjs";

process.env.AGENT_RETRY_BASE_MS = "1";

// Estas pruebas verifican la traduccion de peticiones/respuestas con fetch
// simulado. NO prueban los servicios reales (requieren API keys): ver AGENT_LAYER.md.
function fakeFetch(responses) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, headers: init.headers, body: JSON.parse(init.body) });
    const r = responses.shift();
    return { ok: r.status === undefined || r.status < 400, status: r.status ?? 200, text: async () => JSON.stringify(r.body) };
  };
  return { impl, calls };
}

const tools = [{ name: "git_status", description: "estado", parameters: { type: "object", properties: {} } }];
const messages = [
  { role: "user", content: "hola" },
  { role: "assistant", content: "voy", toolCalls: [{ id: "t1", name: "git_status", args: {} }, { id: "t2", name: "git_log", args: { limit: 3 } }] },
  { role: "tool", toolCallId: "t1", name: "git_status", content: "limpio" },
  { role: "tool", toolCallId: "t2", name: "git_log", content: "abc", isError: true },
];

test("esquemas: las herramientas se convierten a JSON Schema y Gemini lo acepta", () => {
  const specs = toolSpecs();
  assert.ok(specs.length >= 45);
  const call = specs.find((s) => s.name === "call_api");
  assert.equal(call.parameters.type, "object");
  assert.ok(call.parameters.properties.approval_id);
  const g = JSON.stringify(specs.map((s) => geminiSchema(s.parameters)));
  assert.ok(!/additionalProperties|exclusiveMinimum|"\$schema"|"anyOf"/.test(g));
});

test("sin API key o sin modelo: error claro que nombra la variable, nunca un secreto", () => {
  assert.throws(() => createProvider({ provider: "openai", model: "m", env: {} }), /OPENAI_API_KEY/);
  assert.throws(() => createProvider({ provider: "gemini", env: { GEMINI_API_KEY: "k" } }), /Falta el modelo/);
  assert.throws(() => createProvider({ provider: "nope", env: {} }), /desconocido/);
  assert.equal(createProvider({ provider: "anthropic", env: { ANTHROPIC_API_KEY: "k" } }).model, "claude-sonnet-5-5");
  assert.equal(createProvider({ env: { ANTHROPIC_API_KEY: "k", AGENT_PROVIDER: "openai", OPENAI_API_KEY: "k2", AGENT_MODEL: "x" } }).name, "openai");
});

test("anthropic: cabeceras, agrupacion de tool_result y parseo", async () => {
  const f = fakeFetch([{ body: { content: [{ type: "text", text: "listo" }, { type: "tool_use", id: "u1", name: "git_status", input: { a: 1 } }], usage: { input_tokens: 10, output_tokens: 5 }, stop_reason: "tool_use" } }]);
  const p = createProvider({ provider: "anthropic", env: { ANTHROPIC_API_KEY: "ak" }, fetchImpl: f.impl });
  const r = await p.complete({ system: "sys", messages, tools });
  const c = f.calls[0];
  assert.equal(c.url, "https://api.anthropic.com/v1/messages");
  assert.equal(c.headers["x-api-key"], "ak");
  assert.equal(c.headers["anthropic-version"], "2023-06-01");
  assert.equal(c.body.system, "sys");
  assert.equal(c.body.tools[0].input_schema.type, "object");
  const last = c.body.messages.at(-1);
  assert.equal(last.role, "user");
  assert.deepEqual(last.content.map((b) => b.type), ["tool_result", "tool_result"], "los resultados van juntos en un solo mensaje user");
  assert.equal(last.content[1].is_error, true);
  assert.deepEqual(r.toolCalls, [{ id: "u1", name: "git_status", args: { a: 1 } }]);
  assert.deepEqual(r.usage, { input: 10, output: 5 });
  assert.equal(r.text, "listo");
});

test("openai: formato chat.completions con tool_calls y reintento ante 429", async () => {
  const f = fakeFetch([{ status: 429, body: { error: "rate" } }, { body: { choices: [{ message: { content: null, tool_calls: [{ id: "c1", function: { name: "git_log", arguments: '{"limit":2}' } }] }, finish_reason: "tool_calls" }], usage: { prompt_tokens: 7, completion_tokens: 3 } } }]);
  const p = createProvider({ provider: "openai", model: "modelo-x", env: { OPENAI_API_KEY: "ok" }, fetchImpl: f.impl });
  const r = await p.complete({ system: "sys", messages, tools });
  assert.equal(f.calls.length, 2, "reintento tras 429");
  const c = f.calls[1];
  assert.equal(c.url, "https://api.openai.com/v1/chat/completions");
  assert.equal(c.headers.Authorization, "Bearer ok");
  assert.equal(c.body.messages[0].role, "system");
  assert.equal(c.body.messages.find((m) => m.role === "assistant").tool_calls[1].function.arguments, '{"limit":3}');
  assert.equal(c.body.messages.filter((m) => m.role === "tool").length, 2);
  assert.deepEqual(r.toolCalls, [{ id: "c1", name: "git_log", args: { limit: 2 } }]);
  assert.deepEqual(r.usage, { input: 7, output: 3 });
});

test("gemini: functionCall/functionResponse y cabecera de clave", async () => {
  const f = fakeFetch([{ body: { candidates: [{ content: { parts: [{ text: "ok" }, { functionCall: { name: "git_status", args: {} } }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 2 } } }]);
  const p = createProvider({ provider: "gemini", model: "gem-x", env: { GEMINI_API_KEY: "gk" }, fetchImpl: f.impl });
  const r = await p.complete({ system: "sys", messages, tools });
  const c = f.calls[0];
  assert.equal(c.url, "https://generativelanguage.googleapis.com/v1beta/models/gem-x:generateContent");
  assert.equal(c.headers["x-goog-api-key"], "gk");
  assert.equal(c.body.systemInstruction.parts[0].text, "sys");
  const last = c.body.contents.at(-1);
  assert.equal(last.role, "user");
  assert.equal(last.parts.filter((x) => x.functionResponse).length, 2);
  assert.equal(r.toolCalls[0].name, "git_status");
  assert.deepEqual(r.usage, { input: 4, output: 2 });
});

test("coste: desconocido si no hay precios configurados, calculado si los hay", () => {
  assert.equal(estimateCost({ pricePerMTok: { input: null, output: null } }, { input: 1000, output: 1000 }), null);
  assert.equal(estimateCost({ pricePerMTok: { input: 2, output: 10 } }, { input: 1_000_000, output: 500_000 }), 7);
});
