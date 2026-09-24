# Tareas — FidelyFood / TFG

## Hecho
- [x] Auditoría de todas las copias del proyecto y elección de base canónica.
- [x] Consolidación: commit + PR + merge de trabajo pendiente (panel admin, migración de puntos, empaquetado móvil).
- [x] Corrección de secretos hardcodeados (DB password, JWT secret).
- [x] Reparación de corrupción de refs de git (residuos de sincronización).
- [x] Estado persistente (`.agent/`) y widget de escritorio.
- [x] **Validación real (Fase 4)** — 2026-09-23: `mvn clean package` → BUILD SUCCESS (backend), `ng build --configuration production` → OK (frontend, solo warnings de Sass/CSS, sin errores). Backend, frontend y MySQL ya estaban en marcha; login end-to-end de los 3 roles (ADMIN/RESTAURANTE/CLIENTE) verificado con tests reales de Playwright (FID-002/FID-003, 7/7 passed), con consultas reales a MySQL durante la ejecución. El test JUnit existente (`contextLoads`) también pasa. Detalle en `.agent/state.json`.
- [x] Monitor en vivo del agente (hooks reales de Claude Code + widget de escritorio con feed de actividad, métricas y detección de conflictos) — ver `AGENT_TASKS.md`.
- [x] **Backlog FID-001 a FID-012 completo** — 2026-09-24: rate-limiting de login, vulnerabilidad real de autorización en stats de restaurante corregida, suite E2E completa (14 tests: login × 3 roles, cliente, restaurante, 2 de seguridad), documentación real (`ARCHITECTURE.md`, `SECURITY.md`, `TESTING.md`, `DEPLOYMENT.md`), dependencias con vulnerabilidades corregidas (`npm audit fix` + actualización de Angular a 20.3.32, cierra 3 CVEs de XSS). Detalle completo en `AGENT_TASKS.md`.
- [x] Subagente de QA/seguridad específico del proyecto (`.claude/agents/fidelyfood-qa-security.md`).
- [x] **Despliegue real gratuito a producción** — 2026-09-24: backend en Render (`https://fidelyfood-backend.onrender.com`, Docker + MySQL en Aiven) y frontend en Vercel (`https://tfg-glf5.vercel.app`). Corregido en el proceso: `pom.xml` sin `spring-boot-maven-plugin` (jar no ejecutable, PR #23), variables de entorno del blueprint mal rellenadas, CORS configurado con el dominio real de Vercel (PR #24). Verificado con peticiones reales: `/ping` → 200, preflight CORS → 200, login con credenciales falsas → 401 real (confirma conexión viva a MySQL). Detalle en `.agent/state.json`.

## Decidido, sin acción pendiente
- **Rotar la contraseña de MySQL**: el usuario decidió mantener la contraseña actual. No se toca.
- **Limpieza de copias antiguas**: el usuario decidió dejarlas tal cual — `~/projects/TFG-`, `~/Desktop/FidelyFood_Limpio`, `~/Desktop/TFG-` se quedan donde están, sin tocar. No se vuelve a proponer su eliminación.

## Pendiente (por prioridad)
1. **Agente autónomo (Fase 7)**: la base de estado persistente, el monitor y el subagente ya existen; falta la programación recurrente en sí. Requiere que el usuario ejecute `/schedule` él mismo (el intento de configurarlo automáticamente fue bloqueado por el clasificador de seguridad del entorno: crear una tarea programada implica guardar un token de sesión para poder ejecutarse sin supervisión, tratado igual que una escritura de credenciales).
2. **Tests unitarios del backend**: sigue sin cobertura más allá del arranque de contexto (`contextLoads`) — toda la cobertura real de lógica de negocio vive en la suite E2E.
3. **Dominio propio (opcional)**: añadir un dominio personalizado en Vercel/Render si se desea, en vez de los subdominios gratuitos actuales.
4. **Restringir la API key de Google Maps** por HTTP referrer al dominio real de producción en Google Cloud Console (ver `SECURITY.md`, punto 9) — acción manual del usuario, no es cambio de código.

## Reglas para trabajo autónomo (cuando exista)
NO debe: eliminar información importante, borrar partes grandes del proyecto, modificar credenciales/secretos, desplegar a producción, hacer cambios de arquitectura fundamentales — sin pedir autorización explícita primero.
