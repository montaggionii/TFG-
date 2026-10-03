import { z } from "zod";
import { tools, schemaWithApproval } from "../tools/index.mjs";

// Esquema JSON de cada herramienta, derivado del mismo zod que valida en el
// servidor MCP: una sola fuente de verdad para todos los proveedores.
export function toolSpecs() {
  return [...tools.values()].map((t) => {
    const schema = z.toJSONSchema(schemaWithApproval(t));
    delete schema.$schema;
    return { name: t.name, description: `${t.description}\n[riesgo: ${t.risk}]`, parameters: schema };
  });
}

// Gemini acepta solo un subconjunto de JSON Schema.
export function geminiSchema(schema) {
  const drop = new Set(["$schema", "additionalProperties", "exclusiveMinimum", "exclusiveMaximum", "default", "pattern", "minLength", "maxLength", "minItems", "maxItems", "minimum", "maximum", "propertyNames", "$ref", "$defs"]);
  const walk = (node) => {
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === "object") {
      const out = {};
      for (const [k, v] of Object.entries(node)) {
        if (drop.has(k)) continue;
        if (k === "anyOf" || k === "oneOf") {
          const first = v.find((x) => x.type && x.type !== "null") ?? v[0];
          Object.assign(out, walk(first));
          continue;
        }
        if (k === "type" && Array.isArray(v)) {
          out.type = v.find((t) => t !== "null") ?? "string";
          continue;
        }
        out[k] = walk(v);
      }
      if (out.type === undefined && out.properties) out.type = "object";
      if (out.type === "object" && !out.properties) out.properties = {};
      return out;
    }
    return node;
  };
  return walk(schema);
}
