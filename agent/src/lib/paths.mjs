import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const here = import.meta.dirname;

export const AGENT_ROOT = path.resolve(here, "..", "..");
export const REPO_ROOT = process.env.AGENT_REPO_ROOT
  ? path.resolve(process.env.AGENT_REPO_ROOT)
  : path.resolve(AGENT_ROOT, "..");

// Directorio donde el agente lee/escribe codigo. Por defecto el propio repo;
// AGENT_WORKDIR permite apuntar a un git worktree dedicado.
export const WORK_ROOT = process.env.AGENT_WORKDIR ? path.resolve(process.env.AGENT_WORKDIR) : REPO_ROOT;

export const DATA_DIR = process.env.AGENT_DATA_DIR
  ? path.resolve(process.env.AGENT_DATA_DIR)
  : path.join(AGENT_ROOT, "data");

export const APPROVAL_KEY_FILE = process.env.AGENT_APPROVAL_KEY_FILE
  ? path.resolve(process.env.AGENT_APPROVAL_KEY_FILE)
  : path.join(os.homedir(), ".fidelyfood-agent", "approval.key");

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

export function relFromRoot(abs, root = WORK_ROOT) {
  return path.relative(root, abs).split(path.sep).join("/");
}

export function isInside(child, parent) {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}
