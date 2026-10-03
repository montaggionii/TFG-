import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, ensureDir } from "./paths.mjs";
import { redact } from "./redact.mjs";

// Traza append-only de cada llamada a herramienta. Los argumentos y errores
// pasan siempre por redact(): nunca se guardan API keys ni contraseñas.
export function auditToolCall(entry) {
  try {
    const dir = ensureDir(path.join(DATA_DIR, "audit"));
    const day = new Date().toISOString().slice(0, 10);
    const { args, ...rest } = entry;
    const safe = {
      ts: new Date().toISOString(),
      ...rest,
      args: args === undefined ? undefined : redact(JSON.stringify(args)).slice(0, 2000),
      error: entry.error ? redact(String(entry.error)).slice(0, 1000) : undefined,
    };
    fs.appendFileSync(path.join(dir, `${day}.jsonl`), `${JSON.stringify(safe)}\n`);
  } catch {
    // La auditoria nunca debe romper la herramienta, pero un fallo aqui se ve en stderr.
    process.stderr.write("[audit] no se pudo escribir la traza\n");
  }
}

export function readRecentAudit(limit = 50) {
  try {
    const dir = path.join(DATA_DIR, "audit");
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl")).sort().reverse();
    const out = [];
    for (const f of files) {
      const lines = fs.readFileSync(path.join(dir, f), "utf8").split("\n").filter(Boolean);
      for (const l of lines.reverse()) {
        try {
          out.push(JSON.parse(l));
        } catch {
          /* linea corrupta: se ignora */
        }
        if (out.length >= limit) return out;
      }
    }
    return out;
  } catch {
    return [];
  }
}
