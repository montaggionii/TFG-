import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT, AGENT_ROOT, readJson } from "./paths.mjs";

// Lee SOLO las claves pedidas del .env del proyecto. Se usa en codigo de
// confianza (conexion a la BD local, redaccion de logs); el contenido del
// .env nunca se devuelve al modelo ni se escribe en logs.
export function loadDotEnvKeys(keys) {
  const out = {};
  try {
    const raw = fs.readFileSync(path.join(REPO_ROOT, ".env"), "utf8");
    for (const key of keys) {
      const m = raw.match(new RegExp(`^${key}=(.*)$`, "m"));
      if (m) out[key] = m[1].trim().replace(/^['"]|['"]$/g, "");
    }
  } catch {
    /* sin .env: se usan solo variables de proceso */
  }
  return out;
}

export function currentEnvName() {
  const name = (process.env.AGENT_ENV || "local").toLowerCase();
  if (!["local", "staging", "production"].includes(name)) {
    throw new Error(`AGENT_ENV invalido: "${name}" (usa local, staging o production)`);
  }
  return name;
}

export function loadProfile() {
  const all = readJson(path.join(AGENT_ROOT, "config", "environments.json"), null);
  if (!all) throw new Error("No se pudo leer agent/config/environments.json");
  const name = currentEnvName();
  const cfg = all[name];
  const pick = (direct, varName) => direct ?? (varName ? process.env[varName] : undefined);
  return {
    name,
    cfg,
    apiBaseUrl: pick(cfg.apiBaseUrl, cfg.apiBaseUrlVar),
    frontendUrl: pick(cfg.frontendUrl, cfg.frontendUrlVar),
  };
}

// Devuelve parametros de conexion MySQL del entorno activo. Lanza un error
// que nombra las variables que faltan (nunca sus valores).
export function resolveDb(profile) {
  const db = profile.cfg.db;
  if (!db) throw new Error(`El entorno ${profile.name} no tiene base de datos configurada`);
  const fallback = db.fallbackFromDotEnv ? loadDotEnvKeys(Object.values(db.fallbackFromDotEnv)) : {};
  const host = process.env[db.hostVar] || db.defaults?.host;
  const port = process.env[db.portVar] || db.defaults?.port || "3306";
  const user = process.env[db.userVar] || (db.fallbackFromDotEnv ? process.env[db.fallbackFromDotEnv.user] || fallback[db.fallbackFromDotEnv.user] : undefined);
  const password = process.env[db.passwordVar] ?? (db.fallbackFromDotEnv ? process.env[db.fallbackFromDotEnv.password] ?? fallback[db.fallbackFromDotEnv.password] : undefined);
  const name = process.env[db.nameVar] || db.defaults?.name;
  const missing = [];
  if (!host) missing.push(db.hostVar);
  if (!user) missing.push(db.userVar);
  if (password === undefined) missing.push(db.passwordVar);
  if (!name) missing.push(db.nameVar);
  if (missing.length) throw new Error(`Faltan variables de entorno para la BD (${profile.name}): ${missing.join(", ")}`);
  return { host, port, user, password, name };
}
