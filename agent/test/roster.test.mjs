import test from "node:test";
import assert from "node:assert/strict";
import { loadRoster, getAgent, allowedToolsFor, routeByArea, checkWritePath } from "../src/lib/roster.mjs";
import { tools, invokeTool, createContext } from "../src/tools/index.mjs";

test("roster: ids unicos y todas las herramientas existen", () => {
  const r = loadRoster();
  assert.equal(new Set(r.agents.map((a) => a.id)).size, r.agents.length);
  for (const a of r.agents) for (const t of allowedToolsFor(a, r)) assert.ok(tools.has(t), `${a.id}: herramienta inexistente ${t}`);
});

test("roster: solo lectura no escribe; escritores solo en sus rutas", () => {
  const r = loadRoster();
  for (const a of r.agents.filter((x) => x.mode !== "write")) {
    const t = allowedToolsFor(a, r);
    assert.ok(!t.has("write_file") && !t.has("git_commit"), a.id);
  }
  assert.ok(checkWritePath(getAgent("backend-java"), "src/main/java/x/Foo.java"));
  assert.ok(!checkWritePath(getAgent("backend-java"), "frontend/src/app/a.ts"));
  assert.ok(!checkWritePath(getAgent("documentacion"), "src/main/java/x/Foo.java"));
});

test("roster: ninguna ruta de escritura de dos agentes con mismo fichero tipico se solapa sin querer", () => {
  const r = loadRoster();
  const probe = ["src/main/java/a/service/S.java", "frontend/src/app/x.component.ts", "frontend/e2e/a.spec.ts", "frontend/android/app/build.gradle", "docs/a.md"];
  for (const p of probe) {
    const owners = r.agents.filter((a) => checkWritePath(a, p)).map((a) => a.id);
    assert.ok(owners.length >= 1, `${p} sin propietario`);
  }
});

test("routeByArea enruta por reglas", () => {
  assert.equal(routeByArea("frontend").id, "frontend-angular-ionic");
  assert.equal(routeByArea("e2e").id, "tests-e2e");
  assert.equal(routeByArea("inexistente"), null);
});

test("invokeTool deniega herramientas y rutas fuera del rol", async () => {
  const ctx = createContext({ role: "seguridad" });
  const a = await invokeTool("write_file", { path: "docs/x.md", content: "x" }, ctx);
  assert.equal(a.status, "denied");
  const b = await invokeTool("write_file", { path: "src/main/java/A.java", content: "x" }, createContext({ role: "documentacion" }));
  assert.equal(b.status, "denied");
  assert.match(b.error, /no puede escribir/);
});
