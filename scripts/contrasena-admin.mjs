#!/usr/bin/env node
// Cambia la contraseña de administrador de PRODUCCIÓN sin que pase por ningún chat ni por la pantalla.
// La contraseña vive en Render (variable FIDELYFOOD_ADMIN_PASSWORD) y la lee el backend al arrancar.
//
//   1) node scripts/contrasena-admin.mjs preparar
//        genera una contraseña nueva, la copia al PORTAPAPELES y la deja en el widget como «pendiente».
//        Luego: Render → fidelyfood-backend → Environment → FIDELYFOOD_ADMIN_PASSWORD → pegar → Save → Manual Deploy.
//   2) node scripts/contrasena-admin.mjs confirmar --api https://fidelyfood-backend.onrender.com
//        comprueba con un login real que la nueva funciona y entonces la pasa a «activa» en el widget.
//
// Opciones: --widget <ruta del index.jsx>   --no-clipboard
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

const [cmd, ...rest] = process.argv.slice(2);
const args = Object.fromEntries(rest.flatMap((a, i) => (a.startsWith("--") ? [[a.slice(2), rest[i + 1] && !rest[i + 1].startsWith("--") ? rest[i + 1] : true]] : [])));
const WIDGET = String(args.widget || path.join(os.homedir(), "Library/Application Support/Übersicht/widgets/fidelyfood-credentials/index.jsx"));
const API = String(args.api || "").replace(/\/$/, "");
const ADMIN_EMAIL = "admin@fidelyfood.local";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const generar = (n = 24) => Array.from({ length: n }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join("");

if (!["preparar", "confirmar"].includes(cmd)) {
  console.error("Uso: contrasena-admin.mjs preparar | confirmar --api <url-del-backend>");
  process.exit(1);
}
if (!fs.existsSync(WIDGET)) {
  console.error(`No encuentro el widget en ${WIDGET} (usa --widget).`);
  process.exit(1);
}
let widget = fs.readFileSync(WIDGET, "utf8");
const campo = (nombre) => new RegExp(`(${nombre}:\\s*)"(?:[^"\\\\]|\\\\.)*"`);
const leer = (nombre) => {
  const m = widget.match(new RegExp(`${nombre}:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
  return m ? JSON.parse(`"${m[1]}"`) : null;
};
const escribir = (nombre, valor) => {
  if (!campo(nombre).test(widget)) throw new Error(`No encuentro el campo ${nombre} en el widget.`);
  widget = widget.replace(campo(nombre), (_, pre) => `${pre}${JSON.stringify(valor)}`);
};
const guardar = () => {
  fs.writeFileSync(`${WIDGET}.bak`, fs.readFileSync(WIDGET));
  fs.writeFileSync(WIDGET, widget);
};

if (cmd === "preparar") {
  const nueva = generar();
  escribir("pendingPassword", nueva);
  escribir("pendingNote", "Contraseña NUEVA pendiente: pégala en Render → Environment → FIDELYFOOD_ADMIN_PASSWORD, guarda, haz Manual Deploy y ejecuta «node scripts/contrasena-admin.mjs confirmar --api <backend>».");
  guardar();
  let copiada = false;
  if (!args["no-clipboard"] && process.platform === "darwin") {
    copiada = spawnSync("pbcopy", { input: nueva }).status === 0;
  }
  console.log(`Contraseña de administrador nueva generada (${nueva.length} caracteres) y guardada como PENDIENTE en el widget.`);
  console.log(copiada ? "Está en tu PORTAPAPELES: pégala ahora en Render (Environment → FIDELYFOOD_ADMIN_PASSWORD). Después copia cualquier otra cosa para borrarla del portapapeles." : "Cópiala desde el widget (ojo de la fila PENDIENTE) para pegarla en Render.");
  console.log("Cuando Render termine el Manual Deploy: node scripts/contrasena-admin.mjs confirmar --api https://fidelyfood-backend.onrender.com");
  process.exit(0);
}

// confirmar
if (!API) {
  console.error("Indica --api <url del backend>.");
  process.exit(1);
}
const pendiente = leer("pendingPassword");
if (!pendiente) {
  console.error("No hay ninguna contraseña pendiente en el widget. Ejecuta primero «preparar».");
  process.exit(1);
}
let res;
try {
  res = await fetch(`${API}/api/auth/login-admin`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: ADMIN_EMAIL, password: pendiente }), signal: AbortSignal.timeout(120000) });
} catch (e) {
  console.error(`No se pudo conectar con ${API} (${e.cause?.code || e.message}). Si Render estaba dormido, espera 1 minuto y repite.`);
  process.exit(1);
}
if (!res.ok) {
  console.error(`La contraseña pendiente todavía NO funciona en producción (HTTP ${res.status}). ¿Guardaste la variable en Render y terminó el Manual Deploy? La actual sigue siendo la de la fila «ACTIVA».`);
  process.exit(1);
}
escribir("activePassword", pendiente);
escribir("pendingPassword", "");
escribir("pendingNote", "");
guardar();
console.log("✓ La contraseña nueva funciona en producción (login real) y ya es la ACTIVA en el widget. Ya no hay ninguna pendiente.");
