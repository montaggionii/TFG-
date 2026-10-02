# Agent Layer de FidelyFood ("Jarvis")

Infraestructura para que un LLM trabaje sobre FidelyFood como ingeniero de software + QA + asistente DevOps, **siempre con permisos controlados**. Vive en [`agent/`](agent/) y está desacoplada del frontend: funciona con Angular/Ionic cerrado.

## Las cinco capas

| Capa | Qué hay | Dónde |
|---|---|---|
| 1. Dónde vive | Tu Mac hoy; preparado para una VPS (entornos separados, `Dockerfile`) | [`agent/config/environments.json`](agent/config/environments.json), [`agent/Dockerfile`](agent/Dockerfile) |
| 2. Cerebro (LLM) | Intercambiable: Anthropic, OpenAI, Gemini. Proveedor y modelo por configuración; claves solo en variables de entorno | [`agent/config/models.json`](agent/config/models.json), [`agent/src/llm/`](agent/src/llm/) |
| 3. Arnés / agente | **Claude Code** (principal) y el **runner propio** (`agent/src/runner`). OpenClaw instalado en el Mac como arnés opcional | `.mcp.json`, [`agent/src/runner/run.mjs`](agent/src/runner/run.mjs) |
| 4. Herramientas / MCP | Servidor MCP `fidelyfood` con 49 herramientas reales y política de permisos | [`agent/src/mcp/server.mjs`](agent/src/mcp/server.mjs), [`agent/src/tools/`](agent/src/tools/) |
| 5. Skills | 12 procedimientos por área, específicos de FidelyFood | [`skills/fidelyfood/`](skills/fidelyfood/) |

```
Tarea / issue / error / instrucción
        │
        ▼
 Claude Code  ──┐                       ┌─ Memoria  (.agent/memory.jsonl)
 Runner multi-LLM ─┤→ MCP "fidelyfood" ─┼─ Tareas   (AGENT_TASKS.md)
 (OpenClaw*)  ──┘   política + auditoría ├─ Skills   (skills/fidelyfood/*)
                          │               └─ Monitor  (access-center /jarvis.html)
        ┌─────────┬───────┴───────┬──────────┬───────────┐
      Código/    Git/GitHub    Terminal/   API REST    MySQL (solo lectura)
      archivos               Maven·npm·Playwright   (backend 8081)
```
\* OpenClaw puede conectar servidores MCP según su documentación; **no está conectado** (ver "Estado de verificación").

## Elección del runtime

Evaluado con datos de esta máquina, no por popularidad:

| Criterio | Claude Code | OpenClaw 2026.4.2 | Codex |
|---|---|---|---|
| Instalado | Sí | Sí (con un agente `main` ya en uso) | No |
| Ejecución de código, filesystem, terminal, Git | Nativo; es su función principal | No verificado para edición de código; orientado a asistente con canales (WhatsApp/Telegram…) | — |
| MCP | Nativo (`.mcp.json`) | Soportado según su documentación | — |
| Hooks / monitor | Hooks ya cableados al access-center | Tiene hooks propios | — |
| Ejecución prolongada / 24-7 | Rutina diaria en la nube ya activa | Gateway con cron y canales: **buen candidato para el "frontal móvil" de Jarvis** | — |
| Seguridad | Permisos propios + la política del MCP | Sandbox y aprobaciones de exec propias | — |

**Decisión**: Claude Code es el runtime principal (ya está integrado con hooks, subagente y rutina en la nube; no se duplica nada). El servidor MCP y la política no dependen del arnés, así que OpenClaw puede reutilizarlos más adelante como canal de entrada por chat (ver [su documentación de MCP](https://docs.openclaw.ai/tools/mcp)); no se ha tocado su configuración porque es tu asistente personal en uso.

## Cómo se usa

### Desde Claude Code (interactivo)
1. Abre Claude Code en la raíz del repo y aprueba el servidor `fidelyfood` de `.mcp.json` cuando lo pida.
2. Pide la tarea en lenguaje natural ("analiza por qué falla el logout, reprodúcelo, corrígelo y documenta") o `ejecuta AGT-001`. Las herramientas aparecen como `mcp__fidelyfood__*`.

### Runner autónomo (cualquier LLM)
```bash
export ANTHROPIC_API_KEY=...        # o OPENAI_API_KEY / GEMINI_API_KEY (solo en tu shell, nunca en el repo)
npm --prefix agent run run -- --task AGT-001                       # ejecuta una tarea de AGENT_TASKS.md
npm --prefix agent run run -- --prompt "Explica cómo se calculan los puntos" --provider openai --model <id>
# límites: --max-steps 40 --max-minutes 30 --max-tokens 800000 --max-cost-usd 5
```
Termina con un resumen, deja la tarea en `REVIEW`, escribe `CHANGELOG_AGENT.md` y `agent/data/runs/<run>.json`. Códigos de salida: 0 completada · 2 presupuesto agotado · 3 esperando aprobación humana · 4 bucle detectado.

### Eventos → tareas
```bash
npm --prefix agent run event -- issue 12            # issue de GitHub → tarea AGT-xxx (texto del issue marcado como dato no confiable)
npm --prefix agent run event -- error backend       # errores del log del backend → tarea de debugging
npm --prefix agent run event -- feature "texto"     # funcionalidad nueva → tarea
# añade --run para lanzar el runner sobre la tarea creada
```

### Aprobaciones humanas
Cuando una herramienta devuelve `approval_required`, una **persona** (en su terminal) ejecuta:
```bash
npm --prefix agent run approve -- list
npm --prefix agent run approve -- approve apr_xxxxxxxxxx     # pide confirmación; exige terminal interactiva
```
La aprobación es de un solo uso, caduca a los 30 min y solo vale para esa acción exacta (huella SHA-256 de herramienta+argumentos). Va firmada con HMAC usando una clave en `~/.fidelyfood-agent/approval.key` (fuera del repo, modo 600).

### Tareas, memoria, documentación, monitor
```bash
npm --prefix agent run task -- list                 # tareas (AGENT_TASKS.md)
npm --prefix agent run task -- done AGT-001         # cierre humano (el agente solo llega a REVIEW)
npm --prefix agent run docs                         # regenera API.md y DATABASE.md desde el código y la BD
npm --prefix agent test                             # tests del Agent Layer
# Monitor: arranca el access-center (node access-center/server.js) → http://localhost:5757/jarvis.html
```

## Modelo de seguridad (mínimo privilegio)

Cada herramienta pasa por una puerta común (`agent/src/tools/registry.mjs`): validar argumentos → política → (aprobación humana firmada) → ejecutar → auditar.

| Clase | Ejemplos |
|---|---|
| **Automático** | Leer/buscar código; git status/diff/log/branch; crear ramas `agent/*`; escribir y commitear en ramas `agent/*`; Maven, npm, Playwright; consultas SQL de solo lectura; logs; `call_api` GET y mutaciones en local |
| **Aprobación humana** | `git push/merge/rebase/reset/clean`, `gh pr create/merge`, `rm`, binarios fuera de la lista segura, rutas fuera del repo, `npx playwright install`, `npm publish`, `node -e`, `execute_database_statement` (DROP/TRUNCATE/ALTER/DELETE además exigen `backup_confirmed`), escribir sobre archivos con cambios humanos sin commitear, mutaciones de API en staging |
| **Prohibido** | Leer `.env`, claves y `~/.ssh`; escribir `.env`, `.git/`, `agent/config/`, `.claude/`, `.mcp.json`; `sudo`/`ssh`; encadenar comandos (`; & \| > $()`); auto-aprobarse; commits fuera de `agent/*`; cualquier escritura (archivos, git, BD, API) en `production` |

Otras protecciones: `run_command` no usa shell (tokeniza y ejecuta un solo programa); las salidas pasan por redacción de secretos (claves `sk-…`, JWT, `Bearer`, valores de variables sensibles); las columnas `password/token/secret` salen enmascaradas; la BD se abre en sesión `READ ONLY`; el texto de issues, logs y respuestas de API se declara **dato no confiable** al modelo (anti prompt-injection); `DONE` solo lo pone una persona.

### Control de costes y bucles
`agent/config/models.json → budgets`: `maxSteps` (60), `maxWallClockMinutes` (45), `maxTotalTokens` (1.5 M), `maxCostUsd` (sin límite por defecto) y detección de bucle (misma llamada ≥3 veces, ≥6 errores consecutivos). El runner registra tokens por ejecución; **el coste en dólares solo se calcula si rellenas `pricePerMTok` de tu proveedor** (no se inventan precios; mientras sea `null` se muestra "desconocido").

### Entornos
`AGENT_ENV=local|staging|production` ([`environments.json`](agent/config/environments.json)). Cada uno tiene sus propias variables (`AGENT_DB_*`, `AGENT_STAGING_*`, `AGENT_PROD_*`) y capacidades; nunca se mezclan credenciales. `production`: solo lectura.

Variables que reconoce el Agent Layer (solo nombres): `AGENT_ENV`, `AGENT_PROVIDER`, `AGENT_MODEL`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `AGENT_DB_{HOST,PORT,USER,PASSWORD,NAME}` (en local, si faltan usa `DB_USERNAME`/`DB_PASSWORD` del `.env`), `AGENT_{CLIENT,RESTAURANT,ADMIN}_{EMAIL,PASSWORD}` (cuentas de prueba para `call_api auth=…`), `AGENT_WORKDIR`, `AGENT_REPO_ROOT`, `AGENT_DATA_DIR`, `AGENT_JAVA_HOME`.

## Catálogo de herramientas (49)

- **Proyecto**: `inspect_project`, `inspect_architecture`, `list_files`, `read_file`, `write_file`, `search_code`, `list_skills`, `read_skill`
- **Git**: `git_status`, `git_diff`, `git_log`, `git_branch`, `git_create_branch`, `git_commit`
- **Terminal**: `run_command`, `run_maven`, `run_npm`
- **Backend/API**: `inspect_api`, `inspect_endpoint`, `call_api`, `inspect_logs`, `service_status`, `service_start`, `service_stop`
- **Base de datos**: `inspect_database`, `inspect_schema`, `query_database`, `explain_query`, `execute_database_statement` (siempre con aprobación)
- **Tests**: `run_unit_tests`, `run_integration_tests`, `run_e2e_tests`, `run_playwright`
- **GitHub**: `github_repo_info`, `github_list_issues`, `github_get_issue`, `github_list_prs`, `github_get_pr`, `github_list_commits`, `github_list_branches`, `github_create_pr` (siempre con aprobación)
- **Tareas y memoria**: `task_list`, `task_get`, `task_create`, `task_update`, `memory_add`, `memory_search`, `memory_recent`
- **Estado**: `agent_status`

## Estado de verificación (qué se ha probado de verdad y qué no)

**Verificado**
- 42 tests automáticos del Agent Layer en verde (política, aprobaciones firmadas, tareas, memoria, redacción, adaptadores LLM con `fetch` simulado, runner con proveedor guionizado y herramientas reales, eventos) y un cliente MCP real hablando por stdio con el servidor.
- Contra la infraestructura real: inventario de 70 endpoints parseado del código; consultas a la MySQL local (esquema, 221 movimientos, enmascarado de contraseñas); `run_unit_tests` del backend (61/61 con JDK 17 autodetectado) y `run_integration_tests` (contexto completo contra la MySQL local, 1/1); GitHub (`gh`) de lectura; `service_start`/`service_stop` de backend y frontend (el frontend sirve la app Angular); la API local responde `/ping`; el dashboard `/jarvis.html` muestra el estado real.
- **Suite E2E completa: 16/16** (login de los 3 roles, cliente, restaurante, seguridad) lanzada por el agente con `run_e2e_tests` tras arrancar backend y frontend con `service_start` y apagarlos con `service_stop`.
- **Imagen Docker** construida en arm64: Node 22, JDK 17, git, `gh` y cliente MySQL (el de Debian es MariaDB), usuario sin privilegios; dentro del contenedor las 49 herramientas cargan, la política se aplica (entorno `staging`) y `git_status`/`git_log` funcionan sobre el repo montado (hizo falta `safe.directory`, ya en la imagen).
- Un runner de extremo a extremo (rama → edición → commit → tarea a `REVIEW` → changelog) con **herramientas reales y un modelo guionizado**.

**No verificado todavía**
- **Ningún proveedor LLM real** (Anthropic/OpenAI/Gemini): no hay claves en esta sesión; los adaptadores solo están probados contra respuestas simuladas con el formato documentado de cada API.
- Que Claude Code cargue `.mcp.json` (hay que reiniciar la sesión y aprobar el servidor); el protocolo sí está probado con el cliente del SDK.
- La parte `frontend` de `run_unit_tests` (Karma), la imagen en una VPS real y la conexión de OpenClaw.

## Limitaciones y riesgos conocidos

- **La política es una capa de control, no un sandbox del sistema operativo.** Un agente que pueda escribir un script y ejecutarlo con `node archivo.mjs` o `./mvnw` ejecuta código arbitrario con tus permisos. Mitigaciones incluidas: bloqueo de `node -e`, rutas protegidas, rama `agent/*` obligatoria, auditoría. Para aislamiento real: ejecutar el agente como otro usuario del SO o en el contenedor, con la clave de aprobación en una cuenta distinta a la del agente.
- `status.json` tiene un único escritor lógico: si Claude Code (MCP) y el runner corren a la vez, el último que escribe gana.
- `inspect_logs` solo ve servicios arrancados con `service_start`.
- `call_api` solo envía JSON (no multipart) y requiere cuentas de prueba en `AGENT_*_EMAIL/PASSWORD`.
- Las suites E2E mutan la BD local de desarrollo (cuentas de cliente desechables, etc.).
- La memoria (`.agent/memory.jsonl`) es texto plano versionado: revisa los PR antes de fusionar.

## Despliegue en VPS (imagen verificada en local; sin probar en una VPS real)

1. Construir la imagen (`docker build -t fidelyfood-agent agent`: Node 22, JDK 17, git, cliente MySQL, `gh`; usuario sin privilegios).
2. Montar el repositorio en `/workspace` (copia en rama `agent/*`), un volumen para `AGENT_DATA_DIR` y, aparte, el volumen con la clave de aprobación que solo monta quien aprueba.
3. `AGENT_ENV=staging` con credenciales de staging; **nunca** poner credenciales de producción en el agente. `production` queda de solo lectura.
4. Monitor y aprobaciones accesibles solo por túnel/VPN (el access-center escucha únicamente en `127.0.0.1`).
