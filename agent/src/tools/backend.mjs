import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { defineTool, guard } from "./registry.mjs";
import { requireCapability, allow, deny } from "../lib/policy.mjs";
import { DATA_DIR } from "../lib/paths.mjs";
import { redact } from "../lib/redact.mjs";

const CONTROLLER_DIR = "src/main/java/progresa/springboot_tfg/controller";
const SECURITY_FILE = "src/main/java/progresa/springboot_tfg/security/SecurityConfig.java";

function parseSecurityRules(root) {
  const file = path.join(root, SECURITY_FILE);
  if (!fs.existsSync(file)) return [];
  const rules = [];
  const lines = fs.readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    const m = line.match(/\.requestMatchers\(([^)]*)\)\s*\.(permitAll|hasAuthority|hasAnyAuthority|authenticated)\(([^)]*)\)/);
    if (!m) return;
    const method = (m[1].match(/HttpMethod\.(\w+)/) || [])[1] ?? null;
    const patterns = [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
    const roles = [...m[3].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
    rules.push({ method, patterns, access: m[2] === "permitAll" ? "permitAll" : m[2] === "authenticated" ? "authenticated" : roles.join(" | "), line: i + 1 });
  });
  return rules;
}

// Semantica de AntPathMatcher: "/a/**" tambien casa con "/a".
export function patternToRegex(p) {
  const trailing = p.endsWith("/**");
  const core = trailing ? p.slice(0, -3) : p;
  const esc = core.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\u0000/g, ".*");
  return new RegExp(`^${esc}${trailing ? "(/.*)?" : ""}$`);
}

function accessFor(rules, method, urlPath) {
  for (const r of rules) {
    if (r.method && r.method !== method) continue;
    if (r.patterns.some((p) => patternToRegex(p).test(urlPath))) return { access: r.access, ruleLine: r.line };
  }
  return { access: "authenticated (anyRequest)", ruleLine: null };
}

export function parseEndpoints(root) {
  const dir = path.join(root, CONTROLLER_DIR);
  if (!fs.existsSync(dir)) return [];
  const rules = parseSecurityRules(root);
  const out = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".java"))) {
    const lines = fs.readFileSync(path.join(dir, f), "utf8").split("\n");
    let base = "";
    lines.forEach((line, i) => {
      const cls = line.match(/^@RequestMapping\(\s*(?:value\s*=\s*)?"([^"]*)"/);
      if (cls) base = cls[1];
      const m = line.match(/@(Get|Post|Put|Delete|Patch)Mapping(?:\(\s*(?:value\s*=\s*)?(?:"([^"]*)")?)?/);
      if (m) {
        const method = m[1].toUpperCase();
        const full = `${base}${m[2] ?? ""}` || "/";
        const concrete = full.replace(/\{[^}]+\}/g, "1");
        out.push({ method, path: full, controller: f.replace(".java", ""), line: i + 1, consumes: /MULTIPART/.test(line) ? "multipart" : /APPLICATION_JSON/.test(line) ? "json" : undefined, ...accessFor(rules, method, concrete) });
      }
    });
  }
  return out;
}

defineTool({
  name: "inspect_api",
  description: "Inventario REAL de endpoints parseado del codigo (controllers + reglas de SecurityConfig): metodo, ruta, controller:linea y rol requerido.",
  risk: "read",
  inputSchema: z.object({ filter: z.string().optional().describe("Texto a buscar en la ruta/controller") }),
  handler: async ({ filter }, ctx) => {
    let eps = parseEndpoints(ctx.workRoot);
    if (filter) eps = eps.filter((e) => `${e.method} ${e.path} ${e.controller}`.toLowerCase().includes(filter.toLowerCase()));
    return eps.map((e) => `${e.method.padEnd(6)} ${e.path.padEnd(48)} ${e.access.padEnd(40)} ${e.controller}:${e.line}${e.consumes ? ` [${e.consumes}]` : ""}`).join("\n") || "(sin coincidencias)";
  },
});

defineTool({
  name: "inspect_endpoint",
  description: "Detalle de un endpoint: reglas de seguridad aplicables y el codigo fuente del metodo del controller.",
  risk: "read",
  inputSchema: z.object({ method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]), path: z.string().startsWith("/") }),
  handler: async ({ method, path: urlPath }, ctx) => {
    const eps = parseEndpoints(ctx.workRoot);
    const norm = (p) => p.replace(/\{[^}]+\}/g, "{}");
    const found = eps.filter((e) => e.method === method && norm(e.path) === norm(urlPath));
    if (!found.length) return `No hay endpoint ${method} ${urlPath}. Usa inspect_api para ver los reales.`;
    return found.map((e) => {
      const lines = fs.readFileSync(path.join(ctx.workRoot, CONTROLLER_DIR, `${e.controller}.java`), "utf8").split("\n");
      const snippet = lines.slice(e.line - 1, e.line + 34).map((l, i) => `${e.line + i}\t${l}`).join("\n");
      return `${e.method} ${e.path}\nAcceso: ${e.access}${e.ruleLine ? ` (SecurityConfig.java:${e.ruleLine})` : ""}\n\n${e.controller}.java\n${snippet}`;
    }).join("\n\n---\n\n");
  },
});

const tokenCache = new Map();
const ROLE_LOGIN = {
  client: { path: "/api/auth/login", emailVar: "AGENT_CLIENT_EMAIL", passVar: "AGENT_CLIENT_PASSWORD" },
  restaurant: { path: "/api/auth/login-restaurante", emailVar: "AGENT_RESTAURANT_EMAIL", passVar: "AGENT_RESTAURANT_PASSWORD" },
  admin: { path: "/api/auth/login-admin", emailVar: "AGENT_ADMIN_EMAIL", passVar: "AGENT_ADMIN_PASSWORD" },
};

async function loginAs(base, role) {
  const cfg = ROLE_LOGIN[role];
  const email = process.env[cfg.emailVar];
  const password = process.env[cfg.passVar];
  if (!email || !password) throw new Error(`Para auth="${role}" define las variables de entorno ${cfg.emailVar} y ${cfg.passVar} (cuenta de pruebas, nunca de produccion).`);
  const key = `${base}|${role}`;
  if (tokenCache.has(key)) return tokenCache.get(key);
  const res = await fetch(`${base}${cfg.path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }), signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`Login de ${role} fallo (HTTP ${res.status})`);
  const body = await res.json();
  if (!body.token) throw new Error(`La respuesta de login de ${role} no incluye token`);
  tokenCache.set(key, body.token);
  return body.token;
}

defineTool({
  name: "call_api",
  description:
    "Llama a la API REST del entorno activo (AGENT_ENV). auth='client'|'restaurant'|'admin' hace login real con las variables AGENT_*_EMAIL/PASSWORD (el token nunca se devuelve). Mutaciones: libres en local, con aprobacion en staging, bloqueadas en production.",
  risk: "exec",
  inputSchema: z.object({
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET"),
    path: z.string().startsWith("/").describe("Ruta relativa, p.ej. /api/restaurantes"),
    body: z.any().optional(),
    auth: z.enum(["none", "client", "restaurant", "admin"]).default("none"),
  }),
  handler: async ({ method, path: urlPath, body, auth }, ctx) => {
    const base = ctx.profile.apiBaseUrl;
    if (!base) throw new Error(`No hay URL de API para el entorno ${ctx.profile.name}`);
    if (urlPath.includes("..") || urlPath.startsWith("//")) throw new Error("Ruta invalida");
    if (method !== "GET") await guard(ctx, "call_api", { method, path: urlPath, body, auth }, requireCapability(ctx.profile, "allowApiMutations"));
    if (ctx.profile.name !== "local" && auth === "admin") await guard(ctx, "call_api", { method, path: urlPath, body, auth }, deny("auth=admin no esta permitido fuera de local"));
    const headers = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (auth !== "none") headers.Authorization = `Bearer ${await loginAs(base, auth)}`;
    const started = Date.now();
    let res;
    try {
      res = await fetch(`${base}${urlPath}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000) });
    } catch (e) {
      throw new Error(`No se pudo conectar con ${base}${urlPath}: ${e.cause?.code || e.message}. ¿Esta el backend en marcha? (service_status / service_start)`);
    }
    const text = await res.text();
    let shown = text;
    try {
      shown = JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      /* no es JSON */
    }
    return { status: res.status, ms: Date.now() - started, body: redact(shown).slice(0, 12000) };
  },
});

defineTool({
  name: "inspect_logs",
  description: "Ultimas lineas del log del backend/frontend arrancados con service_start (agent/data/logs). Soporta filtro por texto (p.ej. ERROR, Exception).",
  risk: "read",
  inputSchema: z.object({ service: z.enum(["backend", "frontend"]).default("backend"), lines: z.number().int().min(1).max(1000).default(200), contains: z.string().optional() }),
  handler: async ({ service, lines, contains }) => {
    const file = path.join(DATA_DIR, "logs", `${service}.log`);
    if (!fs.existsSync(file)) return `No hay log de ${service}: solo existen logs de servicios arrancados con service_start. Si el servicio lo arranco un humano, su salida esta en su terminal.`;
    let all = fs.readFileSync(file, "utf8").split("\n");
    if (contains) all = all.filter((l) => l.toLowerCase().includes(contains.toLowerCase()));
    return all.slice(-lines).join("\n");
  },
});
