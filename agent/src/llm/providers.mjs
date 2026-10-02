import path from "node:path";
import { AGENT_ROOT, readJson } from "../lib/paths.mjs";
import { geminiSchema } from "./schema.mjs";

export const modelsConfig = () => readJson(path.join(AGENT_ROOT, "config", "models.json"), null);

// Formato interno de mensajes (neutral respecto al proveedor):
//   {role:"user", content}
//   {role:"assistant", content, toolCalls:[{id,name,args}]}
//   {role:"tool", toolCallId, name, content, isError}
// complete() devuelve {text, toolCalls, usage:{input,output}, stopReason}

async function postJson(fetchImpl, url, headers, body, { retries = 3 } = {}) {
  let last;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetchImpl(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(180000) });
    const text = await res.text();
    if (res.ok) return JSON.parse(text);
    last = new Error(`HTTP ${res.status} de ${new URL(url).host}: ${text.slice(0, 400)}`);
    if (![429, 500, 502, 503, 529].includes(res.status) || attempt === retries) break;
    await new Promise((r) => setTimeout(r, Number(process.env.AGENT_RETRY_BASE_MS ?? 1500) * 2 ** attempt));
  }
  throw last;
}

function anthropic({ apiKey, baseUrl, model, fetchImpl, maxOutputTokens }) {
  return {
    name: "anthropic",
    model,
    async complete({ system, messages, tools }) {
      const msgs = [];
      for (const m of messages) {
        if (m.role === "tool") {
          const block = { type: "tool_result", tool_use_id: m.toolCallId, content: m.content, ...(m.isError ? { is_error: true } : {}) };
          const prev = msgs[msgs.length - 1];
          if (prev && prev.role === "user" && Array.isArray(prev.content) && prev.content[0]?.type === "tool_result") prev.content.push(block);
          else msgs.push({ role: "user", content: [block] });
        } else if (m.role === "assistant") {
          const content = [];
          if (m.content) content.push({ type: "text", text: m.content });
          for (const c of m.toolCalls ?? []) content.push({ type: "tool_use", id: c.id, name: c.name, input: c.args });
          msgs.push({ role: "assistant", content });
        } else msgs.push({ role: "user", content: m.content });
      }
      const data = await postJson(fetchImpl, `${baseUrl}/v1/messages`, { "x-api-key": apiKey, "anthropic-version": "2023-06-01" }, {
        model,
        max_tokens: maxOutputTokens,
        system,
        messages: msgs,
        tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })),
      });
      return {
        text: data.content.filter((b) => b.type === "text").map((b) => b.text).join("\n"),
        toolCalls: data.content.filter((b) => b.type === "tool_use").map((b) => ({ id: b.id, name: b.name, args: b.input ?? {} })),
        usage: { input: data.usage?.input_tokens ?? 0, output: data.usage?.output_tokens ?? 0 },
        stopReason: data.stop_reason,
      };
    },
  };
}

function openai({ apiKey, baseUrl, model, fetchImpl }) {
  return {
    name: "openai",
    model,
    async complete({ system, messages, tools }) {
      const msgs = [{ role: "system", content: system }];
      for (const m of messages) {
        if (m.role === "tool") msgs.push({ role: "tool", tool_call_id: m.toolCallId, content: m.content });
        else if (m.role === "assistant") {
          msgs.push({ role: "assistant", content: m.content || null, ...(m.toolCalls?.length ? { tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: JSON.stringify(c.args) } })) } : {}) });
        } else msgs.push({ role: "user", content: m.content });
      }
      const data = await postJson(fetchImpl, `${baseUrl}/v1/chat/completions`, { Authorization: `Bearer ${apiKey}` }, {
        model,
        messages: msgs,
        tools: tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } })),
      });
      const choice = data.choices?.[0];
      const msg = choice?.message ?? {};
      return {
        text: msg.content ?? "",
        toolCalls: (msg.tool_calls ?? []).map((c) => ({ id: c.id, name: c.function.name, args: safeParse(c.function.arguments) })),
        usage: { input: data.usage?.prompt_tokens ?? 0, output: data.usage?.completion_tokens ?? 0 },
        stopReason: choice?.finish_reason,
      };
    },
  };
}

function gemini({ apiKey, baseUrl, model, fetchImpl }) {
  return {
    name: "gemini",
    model,
    async complete({ system, messages, tools }) {
      const contents = [];
      const pushPart = (role, part) => {
        const prev = contents[contents.length - 1];
        if (prev && prev.role === role) prev.parts.push(part);
        else contents.push({ role, parts: [part] });
      };
      for (const m of messages) {
        if (m.role === "tool") pushPart("user", { functionResponse: { name: m.name, response: { result: m.content, ...(m.isError ? { error: true } : {}) } } });
        else if (m.role === "assistant") {
          if (m.content) pushPart("model", { text: m.content });
          for (const c of m.toolCalls ?? []) pushPart("model", { functionCall: { name: c.name, args: c.args } });
        } else pushPart("user", { text: m.content });
      }
      const data = await postJson(fetchImpl, `${baseUrl}/v1beta/models/${encodeURIComponent(model)}:generateContent`, { "x-goog-api-key": apiKey }, {
        systemInstruction: { parts: [{ text: system }] },
        contents,
        tools: [{ functionDeclarations: tools.map((t) => ({ name: t.name, description: t.description, parameters: geminiSchema(t.parameters) })) }],
      });
      const cand = data.candidates?.[0];
      const parts = cand?.content?.parts ?? [];
      return {
        text: parts.filter((p) => p.text).map((p) => p.text).join("\n"),
        toolCalls: parts.filter((p) => p.functionCall).map((p, i) => ({ id: `gem_${Date.now().toString(36)}_${i}`, name: p.functionCall.name, args: p.functionCall.args ?? {} })),
        usage: { input: data.usageMetadata?.promptTokenCount ?? 0, output: data.usageMetadata?.candidatesTokenCount ?? 0 },
        stopReason: cand?.finishReason,
      };
    },
  };
}

function safeParse(s) {
  try {
    return JSON.parse(s || "{}");
  } catch {
    return {};
  }
}

const FACTORIES = { anthropic, openai, gemini };

export function createProvider({ provider, model, fetchImpl = fetch, env = process.env, maxOutputTokens = 8192 } = {}) {
  const cfg = modelsConfig();
  const name = (provider || env.AGENT_PROVIDER || cfg.defaultProvider).toLowerCase();
  const p = cfg.providers[name];
  if (!p || !FACTORIES[name]) throw new Error(`Proveedor desconocido: "${name}" (disponibles: ${Object.keys(FACTORIES).join(", ")})`);
  const chosenModel = model || env.AGENT_MODEL || p.defaultModel;
  if (!chosenModel) throw new Error(`Falta el modelo para ${name}: usa --model o AGENT_MODEL (no hay modelo por defecto configurado para este proveedor).`);
  const apiKey = env[p.apiKeyVar];
  if (!apiKey) throw new Error(`Falta la variable de entorno ${p.apiKeyVar} para usar ${name}. Las claves solo se leen del entorno, nunca del repositorio.`);
  const baseUrl = (env[`AGENT_${name.toUpperCase()}_BASE_URL`] || p.baseUrl).replace(/\/$/, "");
  return { ...FACTORIES[name]({ apiKey, baseUrl, model: chosenModel, fetchImpl, maxOutputTokens }), pricePerMTok: p.pricePerMTok };
}

export function estimateCost(provider, usage) {
  const price = provider.pricePerMTok;
  if (!price || price.input == null || price.output == null) return null;
  return (usage.input * price.input + usage.output * price.output) / 1e6;
}
