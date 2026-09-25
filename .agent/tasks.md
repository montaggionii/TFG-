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
- [x] **Fix post-despliegue: 500 en vez de 404** — 2026-09-24: `GET /` (y cualquier ruta sin recurso) devolvía `500 Internal Server Error` en vez de `404`, detectado al visitar el backend directamente en el navegador. Causa: `NoResourceFoundException` capturada por el manejador genérico de excepciones. Corregido con un manejador específico + test unitario nuevo (`GlobalExceptionHandlerTest`, no requiere base de datos). PR #25, verificado en producción tras el deploy.
- [x] **Cambio de contraseña de admin de producción** — 2026-09-24: se detectó que el login de admin usa una contraseña por defecto (`admin123`) hardcodeada como fallback en `AuthController.java`, sin sobreescribir en producción — cualquiera que viera el repo podía entrar como admin. El usuario eligió una contraseña nueva, guardada en Render como variable de entorno `FIDELYFOOD_ADMIN_PASSWORD` (nunca en el repo). Pendiente de que el backend se reinicie para que se aplique (ver sección de producción en `.agent/state.json`).
- [x] **URLs de acceso documentadas**: Cliente/Restaurante → `https://tfg-glf5.vercel.app`; Admin → `https://tfg-glf5.vercel.app/admin/login` (login dedicado, ya existía en el frontend). Añadidas también al widget de escritorio `fidelyfood-credentials`.

## Decidido, sin acción pendiente
- **Rotar la contraseña de MySQL**: el usuario decidió mantener la contraseña actual. No se toca.
- **Limpieza de copias antiguas**: el usuario decidió dejarlas tal cual — `~/projects/TFG-`, `~/Desktop/FidelyFood_Limpio`, `~/Desktop/TFG-` se quedan donde están, sin tocar. No se vuelve a proponer su eliminación.

## Decidido, sin acción pendiente (cont.)
- **Dominio propio**: el usuario decidió quedarse con los subdominios gratuitos de Render/Vercel — un dominio propio real siempre tiene coste de registro, no hay forma 100% gratis de conseguir uno.
- **Restringir la API key de Google Maps por dominio**: el usuario decidió no hacerlo por ahora.

## Hecho (cont.)
- [x] **Tests unitarios del backend (FID-013)** — 2026-09-25: `UsuarioServiceTest` y `RestauranteServiceTest` (26 tests, Mockito puro, sin BD) cubriendo login (FID-001: mismo error ante email inexistente y password incorrecta) y `requireOwner` (FID-005: acceso denegado a datos de otro usuario/restaurante, incluida regresión directa de `obtenerStats`/`obtenerStatsAvanzadas`). Detalle en `AGENT_TASKS.md`.
- [x] **Cobertura unitaria de `LoginRateLimiter` (FID-014)** — 2026-09-25: identificado de forma independiente por otra ejecución paralela de la misma rutina, que llegó a la misma conclusión (falta de tests unitarios de backend) por el mismo camino; sin solapamiento de archivos con FID-013. 7 tests unitarios puros (sin Spring, sin BD) de la ventana deslizante de rate-limiting (FID-001): límite de 8 fallos, reseteo por login correcto, independencia entre claves IP+email, expiración de la ventana de 10 minutos. Cambio de producción mínimo (reloj inyectable vía `Supplier<Instant>`, comportamiento real sin cambios). Detalle en `AGENT_TASKS.md`.

## Pendiente (por prioridad)
1. Sin tareas pendientes razonables detectadas en esta sesión (2026-09-25) más allá de lo ya recogido en "Hecho". Ver `AGENT_TASKS.md` para el detalle de cada cierre.

## Agente autónomo (Fase 7) — ACTIVADO
2026-09-24: rutina en la nube "FidelyFood - Backlog técnico diario" creada vía `/schedule` (routine `trig_014dcQmXWEEMPUshiQqN5XVU`), diaria a las 09:00 hora de Zurich (07:00 UTC). Corre en un sandbox aislado en la nube (no en el worktree local), trabaja siempre en su propia rama `agent/fidelyfood-autonomous` sobre `montaggionii/TFG-`, sigue las reglas de `.claude/agents/fidelyfood-qa-security.md`, y tiene prohibido explícitamente fusionar a `main` por sí sola — solo deja Pull Requests listos para revisión humana. Panel: https://claude.ai/code/routines/trig_014dcQmXWEEMPUshiQqN5XVU

## Reglas para trabajo autónomo (cuando exista)
NO debe: eliminar información importante, borrar partes grandes del proyecto, modificar credenciales/secretos, desplegar a producción, hacer cambios de arquitectura fundamentales — sin pedir autorización explícita primero.
