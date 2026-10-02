import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { WORK_ROOT } from "./paths.mjs";
import { redact } from "./redact.mjs";

export const MEMORY_TYPES = ["decision", "problem", "solution", "convention", "task", "dependency", "change"];

// La memoria vive en el repo (.agent/memory.jsonl): es revisable en un PR y
// viaja con el codigo a una VPS. NO sustituye a la documentacion: la fuente
// de verdad tecnica sigue siendo el repositorio (AGENTS.md, ARCHITECTURE.md...).
export const memoryFile = (root = WORK_ROOT) => path.join(root, ".agent", "memory.jsonl");

export function readMemory(root = WORK_ROOT) {
  try {
    return fs.readFileSync(memoryFile(root), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

export function addMemory({ type, title, content, tags = [], source = "agent" }, root = WORK_ROOT) {
  if (!MEMORY_TYPES.includes(type)) throw new Error(`Tipo invalido (${MEMORY_TYPES.join(", ")})`);
  const cleanTitle = redact(title);
  const cleanContent = redact(content);
  const entry = {
    id: `mem_${crypto.randomBytes(4).toString("hex")}`,
    ts: new Date().toISOString(),
    type,
    title: cleanTitle,
    content: cleanContent,
    tags: tags.map((t) => t.toLowerCase()),
    source,
    redacted: cleanTitle !== title || cleanContent !== content,
  };
  fs.mkdirSync(path.dirname(memoryFile(root)), { recursive: true });
  fs.appendFileSync(memoryFile(root), `${JSON.stringify(entry)}\n`);
  return entry;
}

const tokens = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9_]+/).filter((w) => w.length > 2);

export function searchMemory(query, { type, limit = 8 } = {}, root = WORK_ROOT) {
  const q = new Set(tokens(query));
  const scored = readMemory(root)
    .filter((m) => !type || m.type === type)
    .map((m) => {
      const title = new Set(tokens(m.title));
      const body = tokens(`${m.content} ${m.tags.join(" ")}`);
      let score = 0;
      for (const w of q) {
        if (title.has(w)) score += 3;
        score += body.filter((b) => b === w).length;
        if (m.tags.includes(w)) score += 2;
      }
      return { m, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.m.ts.localeCompare(a.m.ts));
  return scored.slice(0, limit).map((x) => ({ ...x.m, score: x.score }));
}
