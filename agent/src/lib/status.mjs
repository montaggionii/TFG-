import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { DATA_DIR, ensureDir } from "./paths.mjs";

const FILE = () => path.join(ensureDir(DATA_DIR), "status.json");

const state = {
  agentStatus: "IDLE",
  runId: null,
  agent: null,
  model: null,
  provider: null,
  environment: null,
  branch: null,
  currentTask: null,
  currentOperation: null,
  lastAction: null,
  nextAction: null,
  filesChanged: [],
  testsPassed: 0,
  testsFailed: 0,
  errors: [],
  steps: 0,
  tokens: { input: 0, output: 0 },
  estimatedCostUsd: null,
  startedAt: null,
  updatedAt: null,
};

export function getStatus() {
  return { ...state, runtimeSeconds: state.startedAt ? Math.round((Date.now() - Date.parse(state.startedAt)) / 1000) : 0 };
}

export function updateStatus(patch) {
  Object.assign(state, patch, { updatedAt: new Date().toISOString() });
  try {
    const tmp = `${FILE()}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(getStatus(), null, 2));
    fs.renameSync(tmp, FILE());
  } catch {
    process.stderr.write("[status] no se pudo escribir status.json\n");
  }
}

export function noteFile(file) {
  if (file && !state.filesChanged.includes(file)) updateStatus({ filesChanged: [...state.filesChanged, file] });
}

export function noteError(message) {
  updateStatus({ errors: [...state.errors, { ts: new Date().toISOString(), message: String(message).slice(0, 300) }].slice(-20) });
}

export function noteTests(passed, failed) {
  updateStatus({ testsPassed: state.testsPassed + passed, testsFailed: state.testsFailed + failed });
}

export function readStatusFile() {
  try {
    return JSON.parse(fs.readFileSync(FILE(), "utf8"));
  } catch {
    return null;
  }
}

// Reenvia un evento resumido (sin contenido de comandos ni archivos) al
// Access Center local si esta en marcha. Silencioso si no lo esta.
export function emitEvent(type, detail) {
  const port = process.env.ACCESS_CENTER_PORT || 5757;
  const body = JSON.stringify({ type, tool: "jarvis", detail: String(detail ?? "").slice(0, 280) });
  const req = http.request({ host: "127.0.0.1", port, path: "/api/agent-events", method: "POST", timeout: 800, headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } }, (res) => res.resume());
  req.on("error", () => {});
  req.on("timeout", () => req.destroy());
  req.end(body);
}
