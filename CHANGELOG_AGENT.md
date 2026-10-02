# CHANGELOG_AGENT — Registro de ejecuciones del agente

Una entrada por ejecución del runner (las añade `agent/src/runner/run.mjs` automáticamente, la más reciente arriba). La traza detallada por herramienta está en `agent/data/audit/*.jsonl` (no versionada, sin secretos).

## 2026-10-02 · construcción del Agent Layer · completed
- **Qué:** servidor MCP `fidelyfood` (49 herramientas), política de mínimo privilegio con aprobación humana firmada, runner multi-LLM (Anthropic/OpenAI/Gemini) con presupuestos y detección de bucles, sistema de tareas AGT-xxx, memoria persistente, 12 skills, disparadores por eventos, monitor real en el access-center y documentación (`AGENTS.md`, `AGENT_LAYER.md`, `API.md`, `DATABASE.md`, `DEVELOPMENT.md`, `TESTING.md`, `ARCHITECTURE.md`).
- **Rama:** `agent/jarvis-infrastructure` (sin push).
- **Tests:** 42/42 del Agent Layer; backend 61/61 unitarios + 1/1 de integración (JDK 17); E2E Playwright 5/16 (los 11 restantes fallan por falta del navegador de Playwright en esta máquina: tarea AGT-006).
- **Hallazgos durante la construcción:** (1) `npx playwright install` quedaba permitido por la política → ahora exige aprobación; (2) `service_stop` no esperaba al cierre del puerto → ahora espera y fuerza si hace falta; (3) el JDK por defecto (25) rompe Mockito → el agente usa JDK 17 automáticamente.
- **No verificado:** ningún proveedor LLM real (sin claves), carga de `.mcp.json` por Claude Code, `Dockerfile`, conexión de OpenClaw (ver `AGENT_LAYER.md`).
- **Aprobaciones humanas:** ninguna (no se ejecutó ninguna acción que las requiriera).
