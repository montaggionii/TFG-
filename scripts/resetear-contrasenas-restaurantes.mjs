#!/usr/bin/env node
// Restablece la contraseña de los restaurantes de PRODUCCIÓN cuando nadie la recuerda, y deja el widget del
// escritorio (Übersicht) con las contraseñas nuevas. Lo ejecuta una PERSONA: la contraseña de administrador
// se escribe aquí (prompt oculto) o se lee de FIDELYFOOD_ADMIN_PASSWORD; las contraseñas nuevas se generan
// al azar, NUNCA se imprimen y solo se escriben en el widget (y en un archivo temporal 600 por seguridad).
//
//   node scripts/resetear-contrasenas-restaurantes.mjs --api https://fidelyfood-backend.onrender.com --dry-run
//   node scripts/resetear-contrasenas-restaurantes.mjs --api https://fidelyfood-backend.onrender.com
//
// Opciones: --dry-run (no cambia nada)  --emails a@x,b@y (por defecto los 3 restaurantes reales)
//           --admin-email x  --widget <ruta del index.jsx>
// Requiere que el backend desplegado incluya POST /api/admin/businesses/{id}/password.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { askHidden } from "./lib/prompt.mjs";

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a, i, all) => (a.startsWith("--") ? [[a.slice(2), all[i + 1] && !all[i + 1].startsWith("--") ? all[i + 1] : true]] : [])),
);
const API = String(args.api || "http://localhost:8081").replace(/\/$/, "");
const DRY = Boolean(args["dry-run"]);
const ADMIN_EMAIL = String(args["admin-email"] || "admin@fidelyfood.local");
const EMAILS = String(args.emails || "alabroster@test.com,venezuelafood@gmail.com,mexicanfood@fidelyfood.local").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
const WIDGET = String(args.widget || path.join(os.homedir(), "Library/Application Support/Übersicht/widgets/fidelyfood-credentials/index.jsx"));
const PENDING = path.join(os.homedir(), ".fidelyfood-passwords-pendientes.json");

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const generar = (n = 20) => Array.from({ length: n }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join("");

async function http(method, url, { token, json } = {}) {
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json) headers["Content-Type"] = "application/json";
  let res;
  try {
    res = await fetch(`${API}${url}`, { method, headers, body: json ? JSON.stringify(json) : undefined, signal: AbortSignal.timeout(120000) });
  } catch (e) {
    throw new Error(`No se pudo conectar con ${API} (${e.cause?.code || e.message}). Si es Render gratuito puede estar despertando: espera 1 minuto y repite.`);
  }
  const text = await res.text();
  let body = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* no JSON */
  }
  return { status: res.status, ok: res.ok, body };
}

console.log(`\nAPI: ${API}  ·  ${DRY ? "SIMULACIÓN (no se cambia nada)" : "CAMBIO REAL de contraseñas"}  ·  restaurantes: ${EMAILS.length}`);
if (!DRY && !fs.existsSync(WIDGET)) {
  console.error(`No encuentro el widget en ${WIDGET}. Indica la ruta con --widget.`);
  process.exit(1);
}

// Hasta 3 intentos de contraseña de administrador (el widget guarda dos: la «activa» y la «pendiente»).
let adminPassword = process.env.FIDELYFOOD_ADMIN_PASSWORD;
if (!adminPassword && !process.stdin.isTTY) {
  console.error("Define FIDELYFOOD_ADMIN_PASSWORD o ejecuta el script desde una terminal para escribirla.");
  process.exit(1);
}
let login;
const INTENTOS = adminPassword ? 1 : 3;
for (let intento = 1; intento <= INTENTOS; intento++) {
  if (!adminPassword) adminPassword = (await askHidden(`Contraseña de administrador (${ADMIN_EMAIL}) [intento ${intento}/${INTENTOS}]: `)).trim();
  login = await http("POST", "/api/auth/login-admin", { json: { email: ADMIN_EMAIL, password: adminPassword } });
  adminPassword = undefined;
  if (login.ok && login.body?.token) break;
  console.error(`Login de administrador fallido (HTTP ${login.status}).${intento < INTENTOS ? " Prueba con otra contraseña." : ""}`);
}
if (!login.ok || !login.body?.token) {
  console.error(
    "\nNinguna contraseña de administrador valió. La buena es el valor de FIDELYFOOD_ADMIN_PASSWORD en Render → fidelyfood-backend → Environment (pulsa el ojo para verla); " +
      "si no hay ninguna definida, el backend usa la de por defecto del código.",
  );
  process.exit(1);
}
const token = login.body.token;
console.log("Login de administrador correcto.");

const lista = await http("GET", "/api/admin/businesses", { token });
const negocios = lista.body?.content ?? lista.body?.items;
if (!lista.ok || !Array.isArray(negocios)) {
  console.error(`No se pudo leer la lista de negocios (HTTP ${lista.status}).`);
  process.exit(1);
}
const porEmail = new Map(negocios.map((n) => [String(n.email).toLowerCase(), n]));

const plan = EMAILS.map((email) => ({ email, negocio: porEmail.get(email) }));
for (const p of plan) console.log(`  ${p.negocio ? "→" : "·"} ${p.email}: ${p.negocio ? `${p.negocio.nombre} (id ${p.negocio.id})` : "no existe en producción -> se omite"}`);
if (DRY) {
  const probe = await http("POST", "/api/admin/businesses/0/password", { token, json: { password: "x" } });
  console.log(probe.status === 404 && /Negocio no encontrado/i.test(JSON.stringify(probe.body)) ? "\nEl backend desplegado SÍ incluye el endpoint de reseteo." : `\n⚠ El endpoint de reseteo no parece desplegado todavía (HTTP ${probe.status}). Haz el Manual Deploy en Render antes de ejecutar de verdad.`);
  process.exit(0);
}

const nuevas = Object.fromEntries(plan.filter((p) => p.negocio).map((p) => [p.email, generar()]));
fs.writeFileSync(PENDING, JSON.stringify(nuevas, null, 2), { mode: 0o600 });

let widget = fs.readFileSync(WIDGET, "utf8");
fs.writeFileSync(`${WIDGET}.bak`, widget);
let ok = 0;
let fallos = 0;
for (const { email, negocio } of plan) {
  if (!negocio) continue;
  const password = nuevas[email];
  const cambio = await http("POST", `/api/admin/businesses/${negocio.id}/password`, { token, json: { password } });
  if (!cambio.ok) {
    console.log(`  ✗ ${negocio.nombre}: el servidor respondió HTTP ${cambio.status}${cambio.status === 404 || cambio.status === 405 ? " (¿backend sin desplegar?)" : ""}`);
    fallos++;
    continue;
  }
  const prueba = await http("POST", "/api/auth/login-restaurante", { json: { email, password } });
  if (!prueba.ok || !prueba.body?.token) {
    console.log(`  ✗ ${negocio.nombre}: contraseña cambiada pero el login de comprobación falló (HTTP ${prueba.status}). Se conserva ${PENDING}`);
    fallos++;
    continue;
  }
  const re = new RegExp(`(email:\\s*"${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\s*,\\s*password:\\s*)"[^"]*"`);
  if (!re.test(widget)) {
    console.log(`  ✗ ${negocio.nombre}: cambiada y verificada, pero no encontré su línea en el widget. Se conserva ${PENDING}`);
    fallos++;
    continue;
  }
  widget = widget.replace(re, (_, pre) => `${pre}${JSON.stringify(password)}`);
  fs.writeFileSync(WIDGET, widget);
  console.log(`  ✓ ${negocio.nombre}: contraseña nueva, verificada con login real y guardada en el widget`);
  ok++;
}

const fecha = new Date().toISOString().slice(0, 16).replace("T", " ");
widget = widget.replace(/Actualizado\n\/\/ a mano el [^\n]*\n(?=const PROD_RESTAURANTS)/, `Última actualización: contraseñas restablecidas con\n// scripts/resetear-contrasenas-restaurantes.mjs el ${fecha} UTC.\n`);
fs.writeFileSync(WIDGET, widget);

if (fallos === 0) {
  fs.rmSync(PENDING, { force: true });
  console.log(`\nListo: ${ok} contraseñas nuevas, todas verificadas y guardadas en el widget (copia anterior: ${WIDGET}.bak).`);
} else {
  console.log(`\n${ok} correctas y ${fallos} con problema. Las contraseñas generadas siguen en ${PENDING} (permisos 600) hasta que lo resuelvas.`);
  process.exit(1);
}
