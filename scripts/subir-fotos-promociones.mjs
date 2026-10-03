#!/usr/bin/env node
// Sube (o vuelve a subir) las fotos de las promociones de un restaurante, cada una acorde a su plato,
// y la portada si falta. Tu contraseña la escribes tú: se lee de la variable FIDELYFOOD_PASSWORD o se
// pide por teclado (sin mostrarla). No se guarda ni se imprime en ningún sitio.
//
//   node scripts/subir-fotos-promociones.mjs --restaurante mexican --api https://fidelyfood-backend.onrender.com
//   node scripts/subir-fotos-promociones.mjs --restaurante alabroster --api https://fidelyfood-backend.onrender.com
//   node scripts/subir-fotos-promociones.mjs --restaurante venezuela --api https://fidelyfood-backend.onrender.com
//
// Opciones:  --dry-run  (solo muestra qué haría)   --forzar  (sustituye tambien las fotos que ya estan guardadas)
//            --sin-portada  (no toca la portada del restaurante)
//            --email x  (si el email del restaurante no es el de scripts/fotos-promociones.json)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { askHidden } from "./lib/prompt.mjs";

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a, i, all) => (a.startsWith("--") ? [[a.slice(2), all[i + 1] && !all[i + 1].startsWith("--") ? all[i + 1] : true]] : [])),
);
const API = String(args.api || "http://localhost:8081").replace(/\/$/, "");
const DRY = Boolean(args["dry-run"]);
const FORCE = Boolean(args.forzar);
const SIN_PORTADA = Boolean(args["sin-portada"]);
const config = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "fotos-promociones.json"), "utf8"));
const key = String(args.restaurante || "");
const set = config.restaurantes[key];
if (!set) {
  console.error(`Indica --restaurante ${Object.keys(config.restaurantes).join(" | ")}`);
  process.exit(1);
}
const email = String(args.email || set.email);
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const isData = (v) => typeof v === "string" && v.startsWith("data:image/");

async function http(method, url, { token, json, form, timeout = 120000 } = {}) {
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json) headers["Content-Type"] = "application/json";
  let res;
  try {
    res = await fetch(`${API}${url}`, { method, headers, body: json ? JSON.stringify(json) : form, signal: AbortSignal.timeout(timeout) });
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

const cacheDir = path.join(os.tmpdir(), "fidelyfood-fotos");
fs.mkdirSync(cacheDir, { recursive: true });
async function descargar(url, nombre) {
  const file = path.join(cacheDir, nombre);
  if (!fs.existsSync(file)) {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(60000) });
    if (!res.ok) throw new Error(`No se pudo descargar la imagen (${res.status}): ${url}`);
    const type = res.headers.get("content-type") || "";
    if (!/^image\/(jpeg|png|webp)/.test(type)) throw new Error(`La descarga no es una imagen (${type}): ${url}`);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  const bytes = fs.readFileSync(file);
  if (bytes.length > 4.5 * 1024 * 1024) throw new Error(`Imagen demasiado grande (${bytes.length} bytes)`);
  const ext = path.extname(nombre).toLowerCase();
  return { bytes, type: ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg", nombre };
}

const unsplash = (id) => `https://images.unsplash.com/photo-${id}?w=900&q=75&fm=jpg&fit=crop`;

console.log(`\nRestaurante: ${key} (${email})  ·  API: ${API}  ·  ${DRY ? "SIMULACION (no se sube nada)" : "SUBIDA REAL"}`);
let password = process.env.FIDELYFOOD_PASSWORD;
if (!password) {
  if (!process.stdin.isTTY) {
    console.error("Define FIDELYFOOD_PASSWORD o ejecuta el script desde una terminal para escribirla.");
    process.exit(1);
  }
  password = (await askHidden(`Contraseña de ${email}: `)).trim();
}

const login = await http("POST", "/api/auth/login-restaurante", { json: { email, password } });
password = undefined;
if (!login.ok || !login.body?.token) {
  console.error(`Login fallido (HTTP ${login.status}). Revisa el email y la contraseña.`);
  process.exit(1);
}
const token = login.body.token;
const restId = login.body.id;
console.log(`Login correcto (restaurante ${restId}: ${login.body.nombre ?? key}).`);

let subidas = 0;
let saltadas = 0;
let errores = 0;

const lista = await http("GET", `/api/promociones/restaurante/${restId}`, { token });
if (!lista.ok || !Array.isArray(lista.body)) {
  console.error(`No se pudieron leer las promociones (HTTP ${lista.status}).`);
  process.exit(1);
}
const porTitulo = new Map(lista.body.map((p) => [norm(p.titulo), p]));
console.log(`Promociones en el servidor: ${lista.body.length}. Fotos previstas: ${set.promociones.length}.\n`);

for (const item of set.promociones) {
  const promo = porTitulo.get(norm(item.titulo));
  if (!promo) {
    console.log(`  ·  "${item.titulo}": no existe en el servidor -> se omite`);
    saltadas++;
    continue;
  }
  if (isData(promo.imagenUrl) && !FORCE) {
    console.log(`  ✓  "${item.titulo}": ya tiene su foto guardada -> se deja como esta`);
    saltadas++;
    continue;
  }
  if (DRY) {
    console.log(`  →  "${item.titulo}": se subiría ${item.muestra} (${unsplash(item.foto).slice(0, 52)}…)`);
    continue;
  }
  try {
    const img = await descargar(unsplash(item.foto), `${item.foto}.jpg`);
    const form = new FormData();
    form.append("titulo", promo.titulo);
    if (promo.descripcion != null) form.append("descripcion", promo.descripcion);
    form.append("puntosOtorgados", String(promo.puntosOtorgados ?? 0));
    form.append("tipo", promo.tipo || "GANAR");
    form.append("activa", String(promo.activa !== false));
    if (promo.fechaInicio) form.append("fechaInicio", String(promo.fechaInicio).slice(0, 10));
    if (promo.fechaFin) form.append("fechaFin", String(promo.fechaFin).slice(0, 10));
    form.append("imagen", new Blob([img.bytes], { type: img.type }), img.nombre);
    const res = await http("POST", `/api/promociones/${promo.id}`, { token, form });
    if (res.ok && isData(res.body?.imagenUrl)) {
      console.log(`  ✓  "${item.titulo}": foto subida (${item.muestra})`);
      subidas++;
    } else {
      console.log(`  ✗  "${item.titulo}": el servidor respondió HTTP ${res.status} y la foto no quedó guardada`);
      errores++;
    }
  } catch (e) {
    console.log(`  ✗  "${item.titulo}": ${e.message}`);
    errores++;
  }
}

if (set.portada && !SIN_PORTADA) {
  const rest = await http("GET", `/api/restaurantes/${restId}`, { token });
  if (rest.ok && isData(rest.body?.foto) && !FORCE) {
    console.log("\n  ✓  Portada: ya está guardada");
  } else if (DRY) {
    console.log("\n  →  Portada: se subiría la imagen que elegiste para este restaurante");
  } else {
    try {
      const img = await descargar(set.portada, `portada-${key}.jpg`);
      const form = new FormData();
      form.append("file", new Blob([img.bytes], { type: img.type }), img.nombre);
      const res = await http("POST", `/api/restaurantes/${restId}/imagen`, { token, form });
      if (res.ok && isData(res.body?.foto)) {
        console.log("\n  ✓  Portada subida");
        subidas++;
      } else {
        console.log(`\n  ✗  Portada: HTTP ${res.status}`);
        errores++;
      }
    } catch (e) {
      console.log(`\n  ✗  Portada: ${e.message}`);
      errores++;
    }
  }
}

if (!DRY) {
  const verif = await http("GET", `/api/promociones/restaurante/${restId}`, { token });
  const conFoto = Array.isArray(verif.body) ? verif.body.filter((p) => isData(p.imagenUrl)).length : "?";
  console.log(`\nVerificación: ${conFoto} de ${Array.isArray(verif.body) ? verif.body.length : "?"} promociones tienen su foto guardada en la base de datos.`);
}
console.log(`Resumen: ${subidas} subidas · ${saltadas} omitidas · ${errores} con error.`);
process.exit(errores ? 1 : 0);
