import path from "node:path";
import { z } from "zod";
import { defineTool } from "./registry.mjs";
import { execClassified, formatRun } from "./terminal.mjs";
import { portOpen } from "./services.mjs";
import { resolveDb, loadDotEnvKeys } from "../lib/env.mjs";
import { noteTests, emitEvent } from "../lib/status.mjs";

function summarizeMaven(output) {
  const lines = output.split("\n");
  const total = [...lines].reverse().find((l) => /^\[(INFO|WARNING|ERROR)\] Tests run: \d+, Failures: \d+, Errors: \d+, Skipped: \d+\s*$/.test(l));
  const m = total && total.match(/Tests run: (\d+), Failures: (\d+), Errors: (\d+), Skipped: (\d+)/);
  const failing = lines.filter((l) => /^\[ERROR\]\s+\S+\.\S+:?\d*\s+»|^\[ERROR\]\s+\S+Test\.\S+/.test(l)).slice(0, 15);
  const built = /BUILD SUCCESS/.test(output) ? "SUCCESS" : /BUILD FAILURE/.test(output) ? "FAILURE" : "UNKNOWN";
  if (!m) return { build: built, parsed: false, failing };
  const [, run, fail, err, skip] = m.map(Number);
  return { build: built, parsed: true, run, passed: run - fail - err - skip, failures: fail, errors: err, skipped: skip, failing };
}

function summarizePlaywright(output) {
  const n = (re) => Number((output.match(re) || [])[1] || 0);
  return { passed: n(/(\d+) passed/), failed: n(/(\d+) failed/), flaky: n(/(\d+) flaky/), skipped: n(/(\d+) skipped/), didNotRun: n(/(\d+) did not run/) };
}

function report(name, summary, run) {
  const failed = (summary.failures ?? 0) + (summary.errors ?? 0) + (summary.failed ?? 0);
  noteTests(summary.passed ?? 0, failed);
  emitEvent(failed || run.code !== 0 ? "TEST_FAILED" : "TEST_PASSED", `${name}: ${summary.passed ?? 0} ok, ${failed} fallos`);
  const hints = [];
  if (/Executable doesn't exist|npx playwright install/.test(run.output)) {
    hints.push("Falta el navegador de Playwright en esta maquina (no es un fallo de la app): una persona debe ejecutar `npx playwright install chromium` (descarga ~150 MB) y repetir. Los tests que solo usan la API no lo necesitan.");
  }
  return { suite: name, exitCode: run.code, timedOut: run.timedOut, durationMs: run.durationMs, summary, ...(hints.length ? { hints } : {}), tail: run.output.split("\n").slice(-40).join("\n") };
}

defineTool({
  name: "run_unit_tests",
  description:
    "Tests unitarios. backend: JUnit/Mockito sin BD (excluye el test de contexto) con JDK 17; frontend: Karma/Jasmine; agent: tests del propio Agent Layer. Devuelve conteos reales parseados + cola de la salida.",
  risk: "exec",
  inputSchema: z.object({ scope: z.enum(["backend", "frontend", "agent"]).default("backend"), test_class: z.string().regex(/^[\w.*#]+$/).optional().describe("Solo backend: clase o metodo (p.ej. PromocionServiceTest)") }),
  handler: async ({ scope, test_class }, ctx) => {
    if (scope === "backend") {
      const filter = test_class ?? "!SpringBootTfgApplicationTests";
      const r = await execClassified(ctx, "run_unit_tests", ["./mvnw", "-B", "test", `-Dtest=${filter}`, "-Dsurefire.failIfNoSpecifiedTests=false"], { cwd: ctx.workRoot, timeoutMs: 480000, maxChars: 200000, auditArgs: { scope, test_class } });
      return report("backend-unit", summarizeMaven(r.output), r);
    }
    if (scope === "frontend") {
      const r = await execClassified(ctx, "run_unit_tests", ["npm", "run", "test", "--", "--watch=false", "--browsers=ChromeHeadless"], { cwd: path.join(ctx.workRoot, "frontend"), timeoutMs: 480000, maxChars: 100000, auditArgs: { scope } });
      const n = (re) => Number((r.output.match(re) || [])[1] || 0);
      return report("frontend-unit", { passed: n(/(\d+) of \d+ SUCCESS|Executed (\d+) of/) , failed: n(/(\d+) FAILED/) }, r);
    }
    const r = await execClassified(ctx, "run_unit_tests", ["node", "--test", "test/*.test.mjs"], { cwd: path.join(ctx.workRoot, "agent"), timeoutMs: 180000, maxChars: 100000, auditArgs: { scope } });
    const n = (re) => Number((r.output.match(re) || [])[1] || 0);
    return report("agent-unit", { passed: n(/# pass (\d+)/), failed: n(/# fail (\d+)/) }, r);
  },
});

defineTool({
  name: "run_integration_tests",
  description: "Test de integracion del backend (carga el contexto Spring completo contra la BD del entorno: necesita MySQL accesible y las variables AGENT_DB_* o DB_* del .env).",
  risk: "exec",
  inputSchema: z.object({}),
  handler: async (_a, ctx) => {
    const db = resolveDb(ctx.profile);
    const env = { DB_URL: `jdbc:mysql://${db.host}:${db.port}/${db.name}?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true`, DB_USERNAME: db.user, DB_PASSWORD: db.password, ...loadDotEnvKeys(["APP_JWT_SECRET"]) };
    const r = await execClassified(ctx, "run_integration_tests", ["./mvnw", "-B", "test", "-Dtest=SpringBootTfgApplicationTests"], { cwd: ctx.workRoot, env, timeoutMs: 480000, maxChars: 200000, auditArgs: {} });
    return report("backend-integration", summarizeMaven(r.output), r);
  },
});

const SUITES = { login: "e2e/login.spec.ts", client: "e2e/client-flows.spec.ts", restaurant: "e2e/restaurant-flows.spec.ts", security: "e2e/security-", all: "" };

async function playwright(ctx, toolName, specs, grep, args) {
  const profile = ctx.profile;
  const feUrl = new URL(profile.frontendUrl ?? "http://localhost:8100");
  const apiUrl = new URL(profile.apiBaseUrl ?? "http://localhost:8081");
  const down = [];
  if (!(await portOpen(Number(apiUrl.port) || 80, apiUrl.hostname))) down.push(`backend (${apiUrl.host})`);
  if (!(await portOpen(Number(feUrl.port) || 80, feUrl.hostname))) down.push(`frontend (${feUrl.host})`);
  if (down.length) throw new Error(`Los E2E necesitan servicios en marcha y no responden: ${down.join(", ")}. Arrancalos con service_start (o usa los del usuario) y repite.`);
  const argv = ["npx", "playwright", "test", ...specs, "--reporter=list", ...(grep ? ["--grep", grep] : []), ...args];
  const r = await execClassified(ctx, toolName, argv, { cwd: path.join(ctx.workRoot, "frontend"), timeoutMs: 580000, maxChars: 100000, env: { E2E_API_URL: apiUrl.origin }, auditArgs: { specs, grep } });
  return report("e2e", summarizePlaywright(r.output), r);
}

defineTool({
  name: "run_e2e_tests",
  description: "Suites E2E reales de Playwright (login, client, restaurant, security, all) contra backend+frontend de desarrollo YA en marcha. No levanta ni mata servidores del usuario.",
  risk: "exec",
  inputSchema: z.object({ suite: z.enum(["login", "client", "restaurant", "security", "all"]).default("all") }),
  handler: async ({ suite }, ctx) => playwright(ctx, "run_e2e_tests", SUITES[suite] ? [SUITES[suite]] : [], undefined, []),
});

defineTool({
  name: "run_playwright",
  description: "Ejecuta Playwright con spec(s) y/o --grep concretos (para reproducir un bug puntual con trazas y capturas en fallo).",
  risk: "exec",
  inputSchema: z.object({ specs: z.array(z.string().regex(/^e2e\/[\w./-]+\.spec\.ts$/)).default([]), grep: z.string().max(200).optional() }),
  handler: async ({ specs, grep }, ctx) => playwright(ctx, "run_playwright", specs, grep, []),
});
