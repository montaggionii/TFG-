# Tareas — FidelyFood / TFG

## Hecho
- [x] Auditoría de todas las copias del proyecto y elección de base canónica.
- [x] Consolidación: commit + PR + merge de trabajo pendiente (panel admin, migración de puntos, empaquetado móvil).
- [x] Corrección de secretos hardcodeados (DB password, JWT secret).
- [x] Reparación de corrupción de refs de git (residuos de sincronización).
- [x] Estado persistente (`.agent/`) y widget de escritorio.
- [x] **Validación real (Fase 4)** — 2026-09-23: `mvn clean package` → BUILD SUCCESS (backend), `ng build --configuration production` → OK (frontend, solo warnings de Sass/CSS, sin errores). Backend, frontend y MySQL ya estaban en marcha; login end-to-end de los 3 roles (ADMIN/RESTAURANTE/CLIENTE) verificado con tests reales de Playwright (FID-002/FID-003, 7/7 passed), con consultas reales a MySQL durante la ejecución. El test JUnit existente (`contextLoads`) también pasa. Detalle en `.agent/state.json`.
- [x] Monitor en vivo del agente (hooks reales de Claude Code + widget de escritorio con feed de actividad, métricas y detección de conflictos) — ver `AGENT_TASKS.md`.

## Pendiente (por prioridad)
1. **Rotar la contraseña de MySQL** que estuvo en texto plano en el working tree antes del commit (usuario `fidelyfood_app` — cámbiala en el servidor MySQL y en tu `.env` local; el valor expuesto no se repite aquí a propósito).
2. **Tests**: cobertura E2E ampliándose (ver `AGENT_TASKS.md` — FID-004 en curso: restaurante); sigue sin tests unitarios del backend más allá del arranque de contexto.
3. **Agente autónomo (Fase 7)**: diseñar cómo se ejecuta trabajo en segundo plano de verdad (sesión cloud / tarea programada) — la base de estado persistente y el monitor ya existen, falta la programación recurrente.
4. **Limpieza de copias antiguas**: confirmar si ya moviste a la Papelera las 7 carpetas obsoletas que se identificaron en la auditoría.

## Reglas para trabajo autónomo (cuando exista)
NO debe: eliminar información importante, borrar partes grandes del proyecto, modificar credenciales/secretos, desplegar a producción, hacer cambios de arquitectura fundamentales — sin pedir autorización explícita primero.
