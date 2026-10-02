import { spawn, execFileSync } from "node:child_process";
import { redact, truncate } from "./redact.mjs";

let javaHomeCache;

// El proyecto compila con Java 17 (pom.xml). En este Mac el `java` por defecto
// es 25 y rompe Mockito inline; se detecta un JDK 17 instalado y se usa solo
// para los procesos del agente (sin tocar la configuracion del sistema).
export function javaEnv() {
  if (javaHomeCache === undefined) {
    javaHomeCache = null;
    if (!process.env.AGENT_JAVA_HOME) {
      try {
        javaHomeCache = execFileSync("/usr/libexec/java_home", ["-v", "17"], { encoding: "utf8", timeout: 3000 }).trim() || null;
      } catch {
        javaHomeCache = null;
      }
    } else {
      javaHomeCache = process.env.AGENT_JAVA_HOME;
    }
  }
  return javaHomeCache ? { JAVA_HOME: javaHomeCache } : {};
}

export function run(argv, { cwd, env = {}, timeoutMs = 300000, maxChars = 20000, input } = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    const [bin, ...args] = argv;
    const child = spawn(bin, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"],
      detached: true,
    });
    let out = "";
    let timedOut = false;
    const cap = maxChars * 6;
    const onData = (chunk) => {
      if (out.length < cap) out += chunk.toString();
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    if (input) child.stdin.end(input);
    else child.stdin.end();
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        child.kill("SIGKILL");
      }
    }, timeoutMs);
    const finish = (code, signal, spawnError) => {
      clearTimeout(timer);
      const clean = redact(spawnError ? `${out}\n${spawnError.message}` : out);
      const t = truncate(clean, maxChars);
      resolve({ code: code ?? -1, signal, output: t.text, truncated: t.truncated, timedOut, durationMs: Date.now() - started });
    };
    child.on("error", (err) => finish(-1, null, err));
    child.on("close", (code, signal) => finish(code, signal));
  });
}
