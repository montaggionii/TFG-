import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { APPROVAL_KEY_FILE } from "./paths.mjs";

// Codigo de desbloqueo del Centro de Aprobaciones web (Oficina de Agentes).
//
// Lo genera un humano desde una terminal interactiva (`approve -- ui-code`), igual
// que las aprobaciones por CLI, y lo teclea en la Oficina. El servidor del
// access-center solo guarda/lee el HASH, en un archivo fuera del repo y con modo
// 600 junto a approval.key. Es de un solo uso, caduca y se invalida tras
// MAX_FAILED_ATTEMPTS fallos. No es una contrasena reutilizable ni vive en ningun
// archivo servido al navegador.

export const UNLOCK_TTL_MS = 5 * 60 * 1000;
export const MAX_FAILED_ATTEMPTS = 5;
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sin I, L, O, 0, 1
const CODE_LENGTH = 16; // ~79 bits de entropia

export const unlockFile = () => path.join(path.dirname(APPROVAL_KEY_FILE), "ui-unlock.json");

export function normalizeCode(code) {
  return String(code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

const hashCode = (code) => crypto.createHash("sha256").update(`fidelyfood-ui-unlock|${normalizeCode(code)}`).digest("hex");

function readState() {
  try {
    return JSON.parse(fs.readFileSync(unlockFile(), "utf8"));
  } catch {
    return null;
  }
}

function writeState(state) {
  const file = unlockFile();
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

export function burnUnlockCode() {
  fs.rmSync(unlockFile(), { force: true });
}

// Solo lo llama el CLI humano. Devuelve el codigo en claro UNA vez; en disco solo queda su hash.
export function createUnlockCode(now = Date.now()) {
  let raw = "";
  for (let i = 0; i < CODE_LENGTH; i++) raw += ALPHABET[crypto.randomInt(ALPHABET.length)];
  writeState({ v: 1, hash: hashCode(raw), createdAt: new Date(now).toISOString(), expiresAt: new Date(now + UNLOCK_TTL_MS).toISOString(), failed: 0 });
  return { code: raw.match(/.{4}/g).join("-"), expiresAt: new Date(now + UNLOCK_TTL_MS).toISOString() };
}

// Verifica y CONSUME el codigo. Mismo resultado "invalid" si no existe, caduco o no coincide
// (no da pistas); "locked_out" cuando este fallo agota los intentos y el codigo se invalida.
export function consumeUnlockCode(code, now = Date.now()) {
  const state = readState();
  if (!state || state.v !== 1 || typeof state.hash !== "string") return { ok: false, reason: "invalid" };
  if (!(Date.parse(state.expiresAt) > now)) {
    burnUnlockCode();
    return { ok: false, reason: "invalid" };
  }
  const given = Buffer.from(hashCode(code), "hex");
  const expected = Buffer.from(state.hash, "hex");
  if (given.length === expected.length && crypto.timingSafeEqual(given, expected)) {
    burnUnlockCode(); // un solo uso
    return { ok: true };
  }
  const failed = (state.failed ?? 0) + 1;
  if (failed >= MAX_FAILED_ATTEMPTS) {
    burnUnlockCode();
    return { ok: false, reason: "locked_out" };
  }
  writeState({ ...state, failed });
  return { ok: false, reason: "invalid" };
}
