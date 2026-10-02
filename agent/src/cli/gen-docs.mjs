#!/usr/bin/env node
// Regenera API.md y DATABASE.md a partir de la realidad (controllers + SecurityConfig
// parseados, y la BD del entorno activo). Uso: npm --prefix agent run docs
import fs from "node:fs";
import path from "node:path";
import { invokeTool, createContext } from "../tools/index.mjs";
import { parseEndpoints } from "../tools/backend.mjs";

const ctx = createContext({ agent: "gen-docs" });
const root = ctx.workRoot;
const today = new Date().toISOString().slice(0, 10);

function api() {
  const eps = parseEndpoints(root);
  const byController = new Map();
  for (const e of eps) byController.set(e.controller, [...(byController.get(e.controller) ?? []), e]);
  let md = `# API — FidelyFood

> Generado desde el código el ${today} con \`npm --prefix agent run docs\` (controllers + reglas de \`SecurityConfig.java\`). No lo edites a mano: cambia el código y regenera.

## Convenciones
- Base URL: local \`http://localhost:8081\`; producción en Render (ver \`DEPLOYMENT.md\`).
- Autenticación: JWT en la cabecera \`Authorization: Bearer <token>\`, obtenido en \`/api/auth/login\` (cliente), \`/api/auth/login-restaurante\` (restaurante) o \`/api/auth/login-admin\` (admin).
- Roles (autoridades de Spring Security): \`ROLE_USER\` (cliente), \`ROLE_RESTAURANT\`, \`ROLE_ADMIN\`. "authenticated (anyRequest)" = cualquier usuario autenticado cuando ninguna regla específica casa.
- Subidas multipart (máx. 5 MB; JPG/PNG/WEBP): promociones usan el campo \`imagen\`; la foto de restaurante usa \`file\`; la foto de perfil de usuario usa su propio endpoint.
- Errores: \`BadRequestException\` → 400, \`ResourceNotFoundException\` → 404, acceso denegado → 403, login incorrecto → 401, demasiados intentos de login → 429.
- Un recurso de usuario/restaurante solo es accesible por su dueño (\`requireOwner\` en los servicios), además de por el rol.

## Endpoints (${eps.length})
`;
  for (const [ctrl, list] of [...byController.entries()].sort()) {
    md += `\n### ${ctrl}\n\n| Método | Ruta | Acceso | Tipo | Código |\n|---|---|---|---|---|\n`;
    for (const e of list) md += `| ${e.method} | \`${e.path}\` | ${e.access} | ${e.consumes ?? ""} | ${e.controller}.java:${e.line} |\n`;
  }
  md += "\n";
  fs.writeFileSync(path.join(root, "API.md"), md);
  return eps.length;
}

async function database() {
  const call = async (name, args) => {
    const r = await invokeTool(name, args, ctx);
    if (!r.ok) throw new Error(`${name}: ${r.error ?? r.status}`);
    return JSON.parse(r.output);
  };
  const tables = (await call("inspect_database", {})).rows.map((r) => r.TABLE_NAME);
  let md = `# DATABASE — FidelyFood

> Generado desde la base de datos del entorno \`${ctx.profile.name}\` el ${today} con \`npm --prefix agent run docs\`. No lo edites a mano.

## Cómo se gestiona el esquema
- Motor: MySQL. Local: \`proyectoTFG\`. Producción: Aiven (plan gratuito: la BD **se apaga sola por inactividad**; ver \`DEPLOYMENT.md\`).
- No hay herramienta de migraciones: Hibernate (\`spring.jpa.hibernate.ddl-auto=update\`) crea tablas y columnas nuevas al arrancar. El esquema se cambia modificando las entidades en \`src/main/java/progresa/springboot_tfg/entity/\`; nunca se hacen \`DROP\`/\`TRUNCATE\`/\`ALTER\` destructivos sin backup y aprobación.
- Acceso del agente: \`query_database\` (solo lectura, columnas password/token enmascaradas) y \`inspect_schema\`.

## Tablas (${tables.length})
`;
  for (const t of tables) {
    const s = await call("inspect_schema", { table: t });
    md += `\n### \`${t}\`\n\n| Columna | Tipo | Nulo | Clave | Por defecto |\n|---|---|---|---|---|\n`;
    for (const c of s.columns) md += `| ${c.COLUMN_NAME} | ${c.COLUMN_TYPE} | ${c.IS_NULLABLE} | ${c.COLUMN_KEY || ""} | ${c.COLUMN_DEFAULT === "NULL" ? "" : c.COLUMN_DEFAULT} |\n`;
    if (s.foreignKeys.length) md += `\n**Claves foráneas:** ${s.foreignKeys.map((f) => `\`${f.COLUMN_NAME}\` → \`${f.REFERENCED_TABLE_NAME}.${f.REFERENCED_COLUMN_NAME}\``).join(", ")}\n`;
    const idx = new Map();
    for (const i of s.indexes) idx.set(i.INDEX_NAME, [...(idx.get(i.INDEX_NAME) ?? []), i.COLUMN_NAME]);
    if (idx.size) md += `\n**Índices:** ${[...idx.entries()].map(([n, cols]) => `\`${n}\` (${cols.join(", ")})`).join("; ")}\n`;
  }
  md += "\n";
  fs.writeFileSync(path.join(root, "DATABASE.md"), md);
  return tables.length;
}

const nEndpoints = api();
console.log(`API.md: ${nEndpoints} endpoints`);
try {
  console.log(`DATABASE.md: ${await database()} tablas`);
} catch (e) {
  console.error(`DATABASE.md no se pudo generar: ${e.message}`);
  process.exitCode = 1;
}
