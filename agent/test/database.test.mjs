import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTable, selectSourceExpressions } from "../src/tools/database.mjs";

// Hallazgo: enmascarar solo por el nombre de la columna de SALIDA se puede
// evitar con "SELECT password AS foo" (el header es "foo", nunca coincide
// con SENSITIVE_COL) — mismo patron de fuga de FID-017, pero en el Agent
// Layer en vez de en la API REST. parseTable ahora tambien resuelve el
// alias a su expresion de origen.

test("parseTable enmascara password sin alias (comportamiento ya existente)", () => {
  const t = parseTable("id\tpassword\n1\t$2a$10$hash\n", "SELECT id, password FROM restaurante");
  assert.deepEqual(t.rows[0], { id: "1", password: "[MASKED]" });
  assert.deepEqual(t.maskedColumns, ["password"]);
});

test("parseTable enmascara password renombrado con AS (bypass real)", () => {
  const t = parseTable("id\tfoo\n1\t$2a$10$hash\n", "SELECT id, password AS foo FROM restaurante");
  assert.deepEqual(t.rows[0], { id: "1", foo: "[MASKED]" });
  assert.deepEqual(t.maskedColumns, ["foo"]);
});

test("parseTable enmascara password renombrado sin AS (alias desnudo)", () => {
  const t = parseTable("id\tfoo\n1\t$2a$10$hash\n", "SELECT id, password foo FROM restaurante");
  assert.deepEqual(t.rows[0], { id: "1", foo: "[MASKED]" });
});

test("parseTable enmascara password con el nombre de tabla calificado", () => {
  const t = parseTable("pw\n$2a$10$hash\n", "SELECT restaurante.password AS pw FROM restaurante");
  assert.deepEqual(t.rows[0], { pw: "[MASKED]" });
});

test("parseTable enmascara password envuelto en una funcion", () => {
  const t = parseTable("pw\nHSAH\n", "SELECT REVERSE(password) AS pw FROM restaurante");
  assert.deepEqual(t.rows[0], { pw: "[MASKED]" });
});

test("parseTable no enmascara columnas normales con alias", () => {
  const t = parseTable("total\n42\n", "SELECT COUNT(*) AS total FROM restaurante");
  assert.deepEqual(t.rows[0], { total: "42" });
  assert.deepEqual(t.maskedColumns, []);
});

test("selectSourceExpressions respeta comas dentro de funciones", () => {
  const cols = selectSourceExpressions("SELECT id, ROUND((data_length+index_length)/1024) AS size_kb FROM t");
  assert.deepEqual(cols, ["id", "ROUND((data_length+index_length)/1024)"]);
});

test("parseTable sin sql (otras llamadas) sigue enmascarando solo por header", () => {
  const t = parseTable("password\nhash\n");
  assert.deepEqual(t.rows[0], { password: "[MASKED]" });
});
