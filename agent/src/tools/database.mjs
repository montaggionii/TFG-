import { z } from "zod";
import { defineTool, guard } from "./registry.mjs";
import { run } from "../lib/exec.mjs";
import { classifySql, requireCapability, deny, needApproval, policy } from "../lib/policy.mjs";
import { resolveDb } from "../lib/env.mjs";

const SENSITIVE_COL = /(password|passwd|secret|token|api_?key|hash)/i;

async function mysql(ctx, sql, { readOnly }) {
  const db = resolveDb(ctx.profile);
  const argv = ["mysql", "-h", db.host, "-P", String(db.port), "-u", db.user, "-D", db.name, "--batch", "--raw", "--default-character-set=utf8mb4", "--connect-timeout=10"];
  if (readOnly) argv.push("--init-command=SET SESSION TRANSACTION READ ONLY");
  argv.push("-e", sql);
  // La contraseña viaja por entorno (MYSQL_PWD), nunca por argv ni al modelo.
  return run(argv, { cwd: ctx.workRoot, env: { MYSQL_PWD: db.password }, timeoutMs: 60000, maxChars: 200000 });
}

// Columnas del SELECT, en orden, resolviendo "AS alias"/alias sin AS a su
// expresion de origen — enmascarar solo por el nombre de salida se puede
// evitar con "SELECT password AS foo"; el header entonces es "foo" y nunca
// coincide con SENSITIVE_COL aunque el dato siga siendo la contraseña real.
export function selectSourceExpressions(sql) {
  const m = sql.match(/^\s*select\s+(.*?)\s+from\s+/is);
  if (!m) return null;
  const items = [];
  let depth = 0;
  let cur = "";
  for (const ch of m[1]) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      items.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) items.push(cur);
  return items.map((item) => {
    const trimmed = item.trim();
    const asMatch = trimmed.match(/^(.*?)\s+as\s+[`"]?[\w$]+[`"]?\s*$/i);
    const bareAliasMatch = !asMatch && trimmed.match(/^([\w$.]+)\s+[`"]?([A-Za-z_]\w*)[`"]?\s*$/);
    const source = asMatch ? asMatch[1] : bareAliasMatch ? bareAliasMatch[1] : trimmed;
    return source.trim();
  });
}

export function parseTable(output, sql) {
  const lines = output.split("\n").filter((l) => l.length);
  if (!lines.length) return { columns: [], rows: [] };
  const columns = lines[0].split("\t");
  const sources = sql ? selectSourceExpressions(sql) : null;
  const masked = columns.map((c, i) => SENSITIVE_COL.test(c) || Boolean(sources?.[i] && SENSITIVE_COL.test(sources[i])));
  const rows = lines.slice(1).map((l) => {
    const cells = l.split("\t");
    return Object.fromEntries(columns.map((c, i) => [c, masked[i] ? "[MASKED]" : cells[i]]));
  });
  return { columns, rows, maskedColumns: columns.filter((_, i) => masked[i]) };
}

async function readQuery(ctx, tool, sql) {
  const c = classifySql(sql);
  await guard(ctx, tool, { sql }, c.kind === "read" ? { decision: "allow", reason: c.reason } : c.decision === "deny" ? deny(c.reason) : deny(`${tool} solo admite consultas de solo lectura. ${c.reason}. Para modificar datos usa execute_database_statement (requiere backup y aprobacion humana).`));
  const r = await mysql(ctx, c.sql, { readOnly: true });
  if (r.code !== 0) throw new Error(r.output.trim());
  const t = parseTable(r.output, c.sql);
  const max = policy.sql.maxRows;
  return { columns: t.columns, rowCount: t.rows.length, rows: t.rows.slice(0, max), truncated: t.rows.length > max, ...(t.maskedColumns?.length ? { maskedColumns: t.maskedColumns } : {}) };
}

defineTool({
  name: "inspect_database",
  description: "Lista las tablas de la base de datos del entorno activo con su numero aproximado de filas.",
  risk: "read",
  handler: async (_a, ctx) => {
    const db = resolveDb(ctx.profile);
    return readQuery(ctx, "inspect_database", `SELECT table_name, table_rows, ROUND((data_length+index_length)/1024) AS size_kb FROM information_schema.tables WHERE table_schema='${db.name.replace(/[^\w$]/g, "")}' ORDER BY table_name`);
  },
});

defineTool({
  name: "inspect_schema",
  description: "Esquema de una tabla: columnas, claves foraneas e indices (information_schema).",
  risk: "read",
  inputSchema: z.object({ table: z.string().regex(/^[A-Za-z_][\w$]{0,63}$/) }),
  handler: async ({ table }, ctx) => {
    const db = resolveDb(ctx.profile);
    const schema = db.name.replace(/[^\w$]/g, "");
    const cols = await readQuery(ctx, "inspect_schema", `SELECT column_name, column_type, is_nullable, column_key, column_default FROM information_schema.columns WHERE table_schema='${schema}' AND table_name='${table}' ORDER BY ordinal_position`);
    if (!cols.rowCount) throw new Error(`La tabla ${table} no existe en ${schema}`);
    const fks = await readQuery(ctx, "inspect_schema", `SELECT column_name, referenced_table_name, referenced_column_name FROM information_schema.key_column_usage WHERE table_schema='${schema}' AND table_name='${table}' AND referenced_table_name IS NOT NULL`);
    const idx = await readQuery(ctx, "inspect_schema", `SELECT index_name, column_name, non_unique FROM information_schema.statistics WHERE table_schema='${schema}' AND table_name='${table}' ORDER BY index_name, seq_in_index`);
    return { table, columns: cols.rows, foreignKeys: fks.rows, indexes: idx.rows };
  },
});

defineTool({
  name: "query_database",
  description: "Ejecuta UNA consulta de SOLO LECTURA (SELECT/SHOW/DESCRIBE/EXPLAIN/WITH). Sesion en modo READ ONLY, maximo 200 filas, columnas sensibles (password, token...) enmascaradas.",
  risk: "read",
  inputSchema: z.object({ sql: z.string().min(1).max(5000) }),
  handler: async ({ sql }, ctx) => readQuery(ctx, "query_database", sql),
});

defineTool({
  name: "explain_query",
  description: "EXPLAIN de una consulta SELECT para analizar su plan de ejecucion y rendimiento.",
  risk: "read",
  inputSchema: z.object({ sql: z.string().min(1).max(5000) }),
  handler: async ({ sql }, ctx) => {
    const inner = sql.trim().replace(/^explain\s+/i, "");
    if (!/^\s*(select|with)\b/i.test(inner)) throw new Error("explain_query solo acepta SELECT/WITH");
    const c = classifySql(inner);
    if (c.kind !== "read") await guard(ctx, "explain_query", { sql }, deny(c.reason));
    return readQuery(ctx, "explain_query", `EXPLAIN ${c.sql ?? inner}`);
  },
});

defineTool({
  name: "execute_database_statement",
  description:
    "Ejecuta una sentencia que MODIFICA datos o esquema. SIEMPRE requiere aprobacion humana. Las destructivas (DROP/TRUNCATE/ALTER/DELETE) exigen ademas backup_confirmed=true (AGENTS.md: no se toca la BD sin backup previo). Bloqueada en production.",
  risk: "approval",
  inputSchema: z.object({ sql: z.string().min(1).max(5000), reason: z.string().min(10), backup_confirmed: z.boolean().default(false) }),
  handler: async ({ sql, reason, backup_confirmed }, ctx) => {
    await guard(ctx, "execute_database_statement", { sql, reason, backup_confirmed }, requireCapability(ctx.profile, "allowDbWrites") .decision === "deny" ? deny(`El entorno ${ctx.profile.name} no permite escrituras en BD`) : { decision: "allow", reason: "entorno permite escrituras con aprobacion" });
    const c = classifySql(sql);
    if (c.kind === "invalid") await guard(ctx, "execute_database_statement", { sql }, deny(c.reason));
    const destructive = /\b(drop|truncate|alter|delete)\b/i.test(sql);
    if (destructive && !backup_confirmed) {
      await guard(ctx, "execute_database_statement", { sql }, deny("Sentencia destructiva sin backup_confirmed=true. Haz un backup (mysqldump) y vuelve a pedir la operacion."));
    }
    await guard(ctx, "execute_database_statement", { sql, reason, backup_confirmed }, needApproval(`${destructive ? "DESTRUCTIVA: " : ""}${reason}`));
    const r = await mysql(ctx, c.sql, { readOnly: false });
    if (r.code !== 0) throw new Error(r.output.trim());
    return r.output.trim() || "Sentencia ejecutada.";
  },
});
