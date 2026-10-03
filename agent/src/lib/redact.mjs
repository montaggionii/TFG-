import { loadDotEnvKeys } from "./env.mjs";

const SECRET_NAME = /(KEY|SECRET|PASSWORD|PASSWD|TOKEN|CREDENTIAL)/i;

const PATTERNS = [
  /sk-[A-Za-z0-9_-]{16,}/g,
  /AIza[0-9A-Za-z_-]{20,}/g,
  /gh[pousr]_[A-Za-z0-9]{20,}/g,
  /AVNS_[A-Za-z0-9_-]{8,}/g,
  /Bearer\s+[A-Za-z0-9._~+/-]{20,}=*/g,
  /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
  /(jdbc:mysql:\/\/[^\s"']*[?&]password=)[^&\s"']+/gi,
];

function secretValues() {
  const values = new Set();
  for (const [name, value] of Object.entries(process.env)) {
    if (value && value.length >= 6 && SECRET_NAME.test(name)) values.add(value);
  }
  for (const value of Object.values(loadDotEnvKeys(["DB_PASSWORD", "APP_JWT_SECRET", "APP_SEED_RESTAURANT_PASSWORD"]))) {
    if (value && value.length >= 6) values.add(value);
  }
  return [...values].sort((a, b) => b.length - a.length);
}

export function redact(input) {
  if (input == null) return input;
  let text = typeof input === "string" ? input : JSON.stringify(input);
  for (const value of secretValues()) text = text.split(value).join("[REDACTED]");
  for (const pattern of PATTERNS) {
    text = text.replace(pattern, (m, prefix) => (prefix ? `${prefix}[REDACTED]` : "[REDACTED]"));
  }
  return text;
}

export function truncate(text, max) {
  if (text.length <= max) return { text, truncated: false };
  const head = Math.floor(max * 0.6);
  const tail = max - head;
  return {
    text: `${text.slice(0, head)}\n...[${text.length - max} caracteres omitidos]...\n${text.slice(-tail)}`,
    truncated: true,
  };
}
