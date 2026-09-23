#!/usr/bin/env node
// Puente entre los hooks reales de Claude Code y el monitor local
// (Access Center -> widget de escritorio). Lee el payload del hook por
// stdin, extrae SOLO metadatos no sensibles (nombre de herramienta, ruta de
// archivo, tipo de evento) y lo envía al servidor local. Nunca reenvía el
// contenido de comandos, diffs ni archivos — así no hay riesgo de que un
// secreto acabe en el feed de actividad del widget.
//
// Debe fallar en silencio y terminar rápido siempre: un problema aquí NUNCA
// debe bloquear ni romper una herramienta real de Claude Code.
import http from "http";

const finish = () => process.exit(0);
const hardTimeout = setTimeout(finish, 1000);

let raw = "";
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  let payload = {};
  try {
    payload = JSON.parse(raw);
  } catch {
    payload = {};
  }

  const hookEvent = payload.hook_event_name || "";
  const toolName = payload.tool_name || null;
  const toolInput = payload.tool_input || {};
  const filePath = typeof toolInput.file_path === "string" ? toolInput.file_path : null;

  let type = hookEvent || "UNKNOWN";
  if (hookEvent === "PreToolUse") type = "PRE_TOOL_USE";
  else if (hookEvent === "PostToolUse") type = toolName === "Edit" || toolName === "Write" ? "FILE_MODIFIED" : "POST_TOOL_USE";
  else if (hookEvent === "Stop") type = "TASK_COMPLETED";
  else if (hookEvent === "SessionStart") type = "AGENT_STARTED";

  const detailParts = [toolName, filePath ? filePath.split("/").pop() : null].filter(Boolean);

  const body = JSON.stringify({
    type,
    tool: toolName,
    file: filePath,
    detail: detailParts.join(" · ") || hookEvent,
  });

  try {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 5757,
        path: "/api/agent-events",
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
      },
      (res) => {
        res.resume();
        res.on("end", () => {
          clearTimeout(hardTimeout);
          finish();
        });
      }
    );
    req.on("error", () => {
      clearTimeout(hardTimeout);
      finish();
    });
    req.write(body);
    req.end();
  } catch {
    clearTimeout(hardTimeout);
    finish();
  }
});

process.stdin.on("error", () => {
  clearTimeout(hardTimeout);
  finish();
});
