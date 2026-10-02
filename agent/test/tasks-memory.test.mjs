import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseTasks, createTask, updateTask, tasksFile } from "../src/lib/tasks.mjs";
import { addMemory, searchMemory, readMemory } from "../src/lib/memory.mjs";
import { redact } from "../src/lib/redact.mjs";

function repo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ff-tasks-"));
  fs.writeFileSync(tasksFile(dir), "# Tareas\n\nHistorico FID-001 intacto.\n\n<!-- TASKS:START -->\n\n<!-- TASKS:END -->\n\n## Resto\ntexto final\n");
  return dir;
}

const base = { title: "Arreglar logout", description: "El logout no limpia el estado del usuario", priority: "P1", area: "frontend", acceptance: "Tras logout no queda token en localStorage", tests: "E2E client-flows" };

test("crear y leer tareas conserva el resto del documento", () => {
  const dir = repo();
  const t1 = createTask({ ...base, files: ["frontend/src/app/core/auth/auth.service.ts"] }, dir);
  const t2 = createTask({ ...base, title: "Segunda tarea", dependencies: [t1.ID] }, dir);
  assert.equal(t1.ID, "AGT-001");
  assert.equal(t2.ID, "AGT-002");
  const tasks = parseTasks(dir);
  assert.equal(tasks.length, 2);
  assert.equal(tasks[0]["Estado"], "TODO");
  assert.deepEqual(tasks[1].deps, ["AGT-001"]);
  assert.deepEqual(tasks[0].files, ["frontend/src/app/core/auth/auth.service.ts"]);
  const doc = fs.readFileSync(tasksFile(dir), "utf8");
  assert.match(doc, /Historico FID-001 intacto/);
  assert.match(doc, /## Resto\ntexto final/);
});

test("maquina de estados: dependencias, REVIEW y DONE solo humano", () => {
  const dir = repo();
  const a = createTask(base, dir);
  const b = createTask({ ...base, title: "Depende de la primera", dependencies: [a.ID] }, dir);
  assert.throws(() => updateTask(b.ID, { status: "IN_PROGRESS" }, { root: dir }), /Dependencias sin completar/);
  assert.throws(() => updateTask(a.ID, { status: "REVIEW" }, { root: dir }), /Transicion no permitida/);
  updateTask(a.ID, { status: "IN_PROGRESS" }, { root: dir });
  updateTask(a.ID, { status: "REVIEW", result: "Corregido y verificado con E2E" }, { root: dir });
  assert.throws(() => updateTask(a.ID, { status: "DONE" }, { root: dir }), /Solo una persona/);
  updateTask(a.ID, { status: "DONE" }, { root: dir, human: true });
  updateTask(b.ID, { status: "IN_PROGRESS" }, { root: dir });
  const done = parseTasks(dir).find((t) => t.ID === a.ID);
  assert.equal(done["Estado"], "DONE");
  assert.equal(done["Resultado"], "Corregido y verificado con E2E");
});

test("memoria: guarda, busca por relevancia y redacta secretos", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ff-mem-"));
  addMemory({ type: "problem", title: "Render pierde las imagenes subidas", content: "El disco de Render es efimero: los archivos de uploads desaparecen en cada deploy.", tags: ["render", "uploads"] }, dir);
  addMemory({ type: "decision", title: "Imagenes en base de datos", content: "Se guardan como data URI en LONGTEXT.", tags: ["imagenes"] }, dir);
  const leaked = addMemory({ type: "convention", title: "Clave de prueba", content: "No usar sk-abcdefghijklmnopqrstuvwxyz123456 jamas", tags: [] }, dir);
  assert.equal(leaked.redacted, true);
  assert.ok(!readMemory(dir).some((m) => m.content.includes("sk-abcdefghijkl")));
  const hits = searchMemory("imagenes render deploy", {}, dir);
  assert.equal(hits[0].title, "Render pierde las imagenes subidas");
  assert.equal(searchMemory("inexistente zzz", {}, dir).length, 0);
  assert.throws(() => addMemory({ type: "otro", title: "x", content: "y" }, dir), /Tipo invalido/);
});

test("redact: claves, JWT y bearer", () => {
  const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTYifQ.abcdefghijklmnop";
  const out = redact(`k=sk-proj-abcdefghijklmnopqrst g=AIzaSyabcdefghijklmnopqrstuv h=Bearer ${jwt} j=${jwt}`);
  assert.ok(!/sk-proj|AIza|eyJ/.test(out), out);
  assert.match(redact("jdbc:mysql://h:3306/db?useSSL=true&password=SuperSecreta1&x=1"), /password=\[REDACTED\]/);
});
