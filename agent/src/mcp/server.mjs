#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { tools, invokeTool, createContext, schemaWithApproval } from "../tools/index.mjs";
import { updateStatus } from "../lib/status.mjs";

// IMPORTANTE: en un servidor MCP stdio, stdout es el canal del protocolo.
// Todo diagnostico va a stderr.
const ctx = createContext({ agent: process.env.AGENT_NAME || "claude-code", model: process.env.AGENT_MODEL || null, provider: process.env.AGENT_PROVIDER || null, runId: process.env.AGENT_RUN_ID || null });

const server = new McpServer({ name: "fidelyfood", version: "0.1.0" });

for (const tool of tools.values()) {
  server.registerTool(
    tool.name,
    {
      description: `${tool.description}\n[riesgo: ${tool.risk}]`,
      inputSchema: schemaWithApproval(tool).shape,
    },
    async (args) => {
      const result = await invokeTool(tool.name, args, ctx);
      const text = result.ok ? result.output : JSON.stringify(result, null, 2);
      return { content: [{ type: "text", text }], isError: !result.ok };
    },
  );
}

updateStatus({ agentStatus: "CONNECTED", runId: ctx.runId, agent: ctx.agent, model: ctx.model, provider: ctx.provider, environment: ctx.profile.name, startedAt: new Date().toISOString() });
await server.connect(new StdioServerTransport());
process.stderr.write(`[fidelyfood-mcp] ${tools.size} herramientas | entorno=${ctx.profile.name} | repo=${ctx.workRoot}\n`);

const bye = () => {
  updateStatus({ agentStatus: "IDLE", currentOperation: null });
  process.exit(0);
};
process.on("SIGINT", bye);
process.on("SIGTERM", bye);
process.stdin.on("end", bye);
