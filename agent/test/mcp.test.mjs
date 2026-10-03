import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// Cliente MCP real <-> servidor MCP real por stdio (el mismo protocolo que
// usa Claude Code), contra el repositorio real en modo solo lectura.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ff-mcp-"));
const server = path.resolve(import.meta.dirname, "..", "src", "mcp", "server.mjs");
let client;

before(async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [server],
    env: { ...process.env, AGENT_DATA_DIR: path.join(tmp, "data"), AGENT_APPROVAL_KEY_FILE: path.join(tmp, "k", "approval.key"), AGENT_ENV: "local", AGENT_NAME: "mcp-test" },
    stderr: "pipe",
  });
  client = new Client({ name: "test-client", version: "1.0.0" });
  await client.connect(transport);
});

after(async () => {
  await client?.close();
});

const text = (r) => r.content.map((c) => c.text).join("\n");

test("expone todas las herramientas con su esquema y riesgo", async () => {
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name);
  for (const required of ["inspect_project", "search_code", "read_file", "write_file", "inspect_architecture", "git_status", "git_diff", "git_log", "git_branch", "git_create_branch", "git_commit", "run_command", "run_maven", "run_npm", "inspect_api", "call_api", "inspect_endpoint", "inspect_logs", "inspect_database", "inspect_schema", "query_database", "explain_query", "run_unit_tests", "run_integration_tests", "run_e2e_tests", "run_playwright", "github_list_prs", "github_create_pr", "task_list", "task_update", "memory_add", "memory_search", "agent_status"]) {
    assert.ok(names.includes(required), `falta ${required}`);
  }
  const rf = tools.find((t) => t.name === "read_file");
  assert.match(rf.description, /\[riesgo: read\]/);
  assert.ok(rf.inputSchema.properties.approval_id, "toda herramienta admite approval_id");
});

test("lectura real a traves de MCP", async () => {
  const r = await client.callTool({ name: "inspect_api", arguments: { filter: "auth" } });
  assert.ok(!r.isError);
  assert.match(text(r), /POST\s+\/api\/auth\/login-restaurante\s+permitAll/);
  const s = await client.callTool({ name: "git_status", arguments: {} });
  assert.ok(!s.isError);
  assert.match(text(s), /"branch"/);
});

test("la politica se aplica tambien a traves de MCP", async () => {
  const env = await client.callTool({ name: "read_file", arguments: { path: ".env" } });
  assert.equal(env.isError, true);
  assert.match(text(env), /"status": "denied"/);
  const push = await client.callTool({ name: "run_command", arguments: { command: "git push origin main" } });
  assert.equal(push.isError, true);
  assert.match(text(push), /approval_required/);
  assert.match(text(push), /how_to_approve/);
  const bad = await client.callTool({ name: "run_maven", arguments: { goals: ["x; rm -rf /"] } });
  assert.equal(bad.isError, true);
});

test("agent_status refleja la actividad real y las aprobaciones pendientes", async () => {
  const r = await client.callTool({ name: "agent_status", arguments: {} });
  const st = JSON.parse(text(r));
  assert.equal(st.environment, "local");
  assert.equal(st.agent, "mcp-test");
  assert.ok(st.pendingApprovals.some((a) => a.tool === "run_command"));
});
