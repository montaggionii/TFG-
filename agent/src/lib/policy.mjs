import path from "node:path";
import { AGENT_ROOT, WORK_ROOT, REPO_ROOT, readJson, isInside, relFromRoot } from "./paths.mjs";

export const policy = readJson(path.join(AGENT_ROOT, "config", "policy.json"), null);
if (!policy) throw new Error("No se pudo leer agent/config/policy.json");

const re = (list) => list.map((s) => new RegExp(s));
const protectedRead = re(policy.protectedReadPaths);
const protectedWrite = re(policy.protectedWritePaths);

export class PolicyDenied extends Error {
  constructor(reason) {
    super(reason);
    this.name = "PolicyDenied";
  }
}

export const allow = (reason = "permitido") => ({ decision: "allow", reason });
export const needApproval = (reason) => ({ decision: "approval", reason });
export const deny = (reason) => ({ decision: "deny", reason });

// ---------------------------------------------------------------- rutas ----

// Resuelve una ruta del modelo dentro de WORK_ROOT. Lanza si escapa del repo.
export function resolveInRepo(p, root = WORK_ROOT) {
  const abs = path.resolve(root, p);
  if (!isInside(abs, root)) throw new PolicyDenied(`Ruta fuera del repositorio: ${p}`);
  return abs;
}

export function checkReadPath(rel) {
  if (protectedRead.some((r) => r.test(rel))) return deny(`Lectura bloqueada (ruta con secretos): ${rel}`);
  return allow();
}

export function checkWritePath(rel) {
  if (protectedWrite.some((r) => r.test(rel))) return deny(`Escritura bloqueada (ruta protegida): ${rel}`);
  return allow();
}

// -------------------------------------------------------------- comandos ---

// Tokeniza sin shell. Rechaza operadores (;, &, |, <, >, `, $(, saltos de linea)
// fuera de comillas: cada llamada ejecuta UN solo programa con argv explicito.
export function tokenize(command) {
  const tokens = [];
  let cur = "";
  let has = false;
  let quote = null;
  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    if (quote) {
      if (c === quote) quote = null;
      else if (c === "\\" && quote === '"' && i + 1 < command.length) cur += command[++i];
      else cur += c;
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      has = true;
    } else if (c === "\\" && i + 1 < command.length) {
      cur += command[++i];
      has = true;
    } else if (/\s/.test(c)) {
      if (c === "\n" || c === "\r") throw new PolicyDenied("Saltos de linea no permitidos en run_command");
      if (has) {
        tokens.push(cur);
        cur = "";
        has = false;
      }
    } else if (";&|<>`".includes(c) || (c === "$" && command[i + 1] === "(")) {
      throw new PolicyDenied(`Operador de shell no permitido (${c}): ejecuta un solo programa por llamada`);
    } else {
      cur += c;
      has = true;
    }
  }
  if (quote) throw new PolicyDenied("Comillas sin cerrar");
  if (has) tokens.push(cur);
  return tokens;
}

const SECRET_ARG = [/(^|\/)\.env($|\.(?!example$))/, /(^|\/)\.ssh(\/|$)/, /(^|\/)\.aws(\/|$)/, /\.fidelyfood-agent/, /id_(rsa|ed25519)/, /\.(pem|key|p12|jks)$/];

function pathArgCheck(argv, cwd) {
  for (const a of argv.slice(1)) {
    if (a.startsWith("-") && !a.includes("/")) continue;
    if (SECRET_ARG.some((r) => r.test(a))) return deny(`El argumento apunta a un archivo de secretos: ${a}`);
    if (/^(~|\/|\.\.)/.test(a) || a.includes("../")) {
      const abs = path.resolve(cwd, a.replace(/^~/, process.env.HOME || "~"));
      if (!isInside(abs, REPO_ROOT) && !isInside(abs, WORK_ROOT)) {
        return needApproval(`El argumento referencia una ruta fuera del repositorio: ${a}`);
      }
    }
  }
  return null;
}

function hasFlag(args, flags) {
  return args.some((a) => flags.includes(a) || flags.some((f) => f.length > 2 && a.startsWith(`${f}=`)));
}

function classifyGit(args) {
  const cfg = policy.commands.git;
  const sub = args.find((a) => !a.startsWith("-"));
  if (!sub) return allow();
  if (hasFlag(args, cfg.approvalFlags)) return needApproval(`git ${sub} con flag destructivo/forzado`);
  if (sub === "branch") {
    const rest = args.slice(args.indexOf("branch") + 1);
    const flags = rest.filter((a) => a.startsWith("-"));
    const positional = rest.filter((a) => !a.startsWith("-"));
    const listing = flags.some((f) => ["--list", "--contains", "--merged", "--no-merged"].includes(f));
    const readOnly = rest.length === 0 || (flags.length > 0 && flags.every((f) => cfg.autoBranchFlagsOnly.includes(f)) && (positional.length === 0 || listing));
    return readOnly ? allow("git branch (solo lectura)") : needApproval("git branch que modifica ramas: usa git_create_branch o pide aprobacion");
  }
  if (sub === "checkout") {
    const rest = args.slice(args.indexOf("checkout") + 1);
    return rest.includes("-b") || rest.includes("-B") ? allow("crear rama") : needApproval("git checkout puede descartar cambios: usa git switch -c o pide aprobacion");
  }
  if (sub === "switch") return args.includes("-c") || args.includes("-C") ? allow("crear rama") : allow("cambiar de rama");
  if (sub === "stash") {
    const op = args[args.indexOf("stash") + 1];
    return !op || ["list", "show", "push"].includes(op) ? allow() : needApproval(`git stash ${op}`);
  }
  if (sub === "worktree") {
    const op = args[args.indexOf("worktree") + 1];
    return ["list", "add"].includes(op) ? allow() : needApproval(`git worktree ${op}`);
  }
  if (sub === "remote") return args.includes("add") || args.includes("remove") || args.includes("set-url") ? needApproval("git remote modifica remotos") : allow();
  if (cfg.approval.includes(sub)) return needApproval(`git ${sub} requiere aprobacion`);
  if (cfg.auto.includes(sub)) return allow();
  return needApproval(`Subcomando git no clasificado: ${sub}`);
}

function classifyNpm(args) {
  const cfg = policy.commands.npm;
  const sub = args.find((a) => !a.startsWith("-"));
  if (hasFlag(args, cfg.approvalFlags)) return needApproval("npm con alcance global/forzado");
  if (!sub) return allow();
  if (cfg.approval.includes(sub)) return needApproval(`npm ${sub} requiere aprobacion`);
  if (cfg.auto.includes(sub)) return allow();
  return needApproval(`Subcomando npm no clasificado: ${sub}`);
}

function classifyNpx(args) {
  const positional = args.filter((a) => !a.startsWith("-"));
  const [pkg, sub] = positional;
  if (!pkg || !policy.commands.npx.autoPackages.includes(pkg)) return needApproval(`npx ${pkg ?? ""}: paquete no incluido en la lista segura`);
  if (pkg === "playwright" && ["install", "install-deps", "uninstall"].includes(sub)) return needApproval(`npx playwright ${sub} descarga/instala binarios (navegadores) de internet`);
  if (pkg === "ng" && ["new", "add", "update", "generate", "g"].includes(sub)) return needApproval(`npx ng ${sub} modifica el proyecto o sus dependencias`);
  return allow();
}

function classifyMvn(args) {
  const cfg = policy.commands.mvn;
  const goals = args.filter((a) => !a.startsWith("-"));
  for (const g of goals) {
    if (cfg.approval.some((x) => g === x || g.endsWith(`:${x}`))) return needApproval(`mvn ${g} requiere aprobacion`);
  }
  if (goals.length && goals.every((g) => cfg.auto.includes(g))) return allow();
  return goals.length ? needApproval(`Objetivo mvn no clasificado: ${goals.join(" ")}`) : allow();
}

function classifyGh(args) {
  const cfg = policy.commands.gh;
  const joined = args.filter((a) => !a.startsWith("-")).slice(0, 2).join(" ");
  if (cfg.approval.some((p) => joined === p || joined.startsWith(`${p} `) || args[0] === p)) return needApproval(`gh ${joined} escribe en GitHub`);
  if (args[0] === "api") {
    const mi = args.findIndex((a) => a === "-X" || a === "--method");
    const method = (mi >= 0 ? args[mi + 1] : args.some((a) => a === "-f" || a === "-F" || a === "--field" || a === "--raw-field" || a === "--input") ? "POST" : "GET").toUpperCase();
    return cfg.apiApprovalMethods.includes(method) ? needApproval(`gh api ${method}`) : allow();
  }
  return cfg.autoPrefixes.some((p) => joined === p || joined.startsWith(`${p} `)) ? allow() : needApproval(`gh ${joined}: no clasificado`);
}

export function classifyArgv(argv, cwd = WORK_ROOT) {
  if (!argv.length) return deny("Comando vacio");
  const bin = argv[0];
  const base = path.basename(bin);
  const cmds = policy.commands;
  if (cmds.deniedBinaries.includes(base)) return deny(`Binario prohibido: ${base}`);

  const paths = pathArgCheck(argv, cwd);
  if (paths && paths.decision === "deny") return paths;

  const text = argv.join(" ");
  if (/agent\/src\/cli|\brun\s+approve\b|approve\.mjs|approvals?\.jsonl/.test(text)) {
    return deny("Las aprobaciones solo las concede una persona desde su propia terminal");
  }
  const args = argv.slice(1);
  let verdict;
  if (!cmds.autoBinaries.includes(bin) && !cmds.autoBinaries.includes(base)) {
    verdict = needApproval(`Binario no incluido en la lista segura: ${bin}`);
  } else if (base === "git") verdict = classifyGit(args);
  else if (base === "npm") verdict = classifyNpm(args);
  else if (base === "npx") verdict = classifyNpx(args);
  else if (base === "mvn" || base === "mvnw") verdict = classifyMvn(args);
  else if (base === "gh") verdict = classifyGh(args);
  else if (base === "node") {
    verdict = hasFlag(args, cmds.node.approvalFlags) ? needApproval("node con codigo inline (-e/-p)") : allow();
  } else if (base === "find") {
    verdict = args.some((a) => ["-delete", "-exec", "-execdir", "-ok"].includes(a)) ? needApproval("find con accion destructiva/ejecucion") : allow();
  } else verdict = allow();

  if (verdict.decision === "allow") {
    for (const p of cmds.approvalPatterns) {
      if (new RegExp(p, "i").test(text)) return needApproval(`El comando coincide con un patron sensible: ${p}`);
    }
    if (paths) return paths;
  }
  return verdict;
}

// ------------------------------------------------------------------ SQL ----

function stripSqlComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|\s)--[^\n]*/g, " ").replace(/(^|\s)#[^\n]*/g, " ").trim();
}

export function classifySql(sql) {
  const clean = stripSqlComments(sql).replace(/;+\s*$/, "").trim();
  if (!clean) return { ...deny("SQL vacio"), kind: "invalid" };
  if (clean.includes(";")) return { ...deny("Solo se permite una sentencia SQL por llamada"), kind: "invalid" };
  const cfg = policy.sql;
  const lower = clean.toLowerCase();
  if (new RegExp(cfg.readOnlyStart, "i").test(clean)) {
    for (const f of cfg.forbiddenInReadOnly) {
      if (new RegExp(f, "i").test(lower)) return { ...deny(`Construccion no permitida en consulta de solo lectura: ${f}`), kind: "invalid" };
    }
    if (/\b(insert|update|delete|drop|truncate|alter|create|grant|revoke|rename|replace)\b/i.test(lower.replace(/'[^']*'/g, "''")) && !/^explain/i.test(clean)) {
      return { ...needApproval("La consulta contiene palabras de escritura/DDL: se trata como modificacion"), kind: "write" };
    }
    return { ...allow("consulta de solo lectura"), kind: "read", sql: clean };
  }
  const destructive = cfg.alwaysApproval.some((p) => new RegExp(p, "i").test(lower));
  return { ...needApproval(destructive ? "Sentencia que modifica datos o esquema" : "Sentencia SQL no es de solo lectura"), kind: "write", sql: clean };
}

// ------------------------------------------------------------- entorno -----

export function requireCapability(profile, key) {
  const v = profile.cfg[key];
  if (v === false) return deny(`El entorno "${profile.name}" no permite ${key}`);
  if (v === "approval") return needApproval(`El entorno "${profile.name}" exige aprobacion para ${key}`);
  return allow();
}

export { relFromRoot };
