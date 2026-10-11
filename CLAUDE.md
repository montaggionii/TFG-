# FidelyFood — repositorio canónico

Este directorio (`~/projects/TFG-repaired-20260917`, remoto `montaggionii/TFG-`) es la ÚNICA versión de FidelyFood.
No crees copias nuevas. Las carpetas `TFG-`, `TFG-clean`, `TFG-agent-worktree`, `TFG-_zero_byte_backup_*`,
`~/Desktop/TFG-`, `FidelyFood_Limpio` y `FidelyFood_stage` son históricas: léelas, no desarrolles en ellas.
Rama de trabajo actual: `consolidacion/fidelyfood-unificado` (desde `origin/main`).

## Componentes
- `src/` Spring Boot (Java 17, Maven, MySQL) · `frontend/` Angular + Ionic + Capacitor
- `agent/` Agent Layer ("Jarvis"): runner, servidor MCP `fidelyfood`, política, aprobaciones
- `access-center/` Express, solo 127.0.0.1:5757: **Oficina de Agentes** (`/oficina.html`) y Harvey (`POST /api/jarvis/run`, Claude Code)
- `skills/fidelyfood/`, `.claude/agents/`, `AGENT_TASKS.md`, `.agent/` (memoria/tareas)

## Arranque y verificación
- Oficina web: `cd access-center && node server.js` → http://localhost:5757/oficina.html
- Tests del Agent Layer: `cd agent && npm test` (100 deben pasar)
- Backend: `./mvnw test` y `./mvnw spring-boot:run`; frontend: `cd frontend && npm test`
- Una tarea solo está hecha si se ejecutó y verificó; no marques DONE sin evidencia.

## Límites
- `~/projects/ai-virtual-office` es OTRA oficina (trading cripto, ~35 agentes). No la modifiques, no mezcles
  memorias, tareas, credenciales ni BD, y Harvey no la coordina.
- No toques la configuración global de Claude Code, no cambies credenciales MySQL, no borres datos,
  no despliegues ni publiques sin orden explícita.
