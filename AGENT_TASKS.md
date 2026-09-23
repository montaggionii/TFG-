# AGENT_TASKS — Backlog técnico de FidelyFood Agent

Backlog de trabajo autónomo. Cada tarea se resuelve en `agent/fidelyfood-autonomous`
(worktree separado en `../TFG-agent-worktree`), con commit independiente y
resumen — nunca se integra a `main` sin que el usuario lo decida.

Antes de tocar cualquier archivo: comprobar `git status` en el repo principal;
si el archivo aparece como modificado sin commitear allí, se salta esa tarea.

## P0 — Seguridad / bloqueante

- **FID-001** · SECURITY · Auditar rate-limiting ausente en `/api/auth/**` (login) — ya detectado en la Fase 15 preliminar, pendiente de decidir mecanismo (bucket4j vs. filtro propio).

## P1 — Alta prioridad

- ~~**FID-002** · TEST · Crear `playwright.config.ts` y suite E2E mínima: login de los 3 roles.~~ **COMPLETADA** (ver cierre abajo).
- ~~**FID-003** · TEST · Tests E2E de cliente: home, mapa/geolocalización, historial, perfil, logout.~~ **COMPLETADA** (ver cierre abajo).
- **FID-004** · TEST · Tests E2E de restaurante: dashboard, promociones, scanner.
- **FID-005** · SECURITY · Revisión completa de endpoints REST (roles correctos por método/ruta) — checklist contra `SecurityConfig.java`.

## P2 — Media prioridad

- **FID-006** · DOCS · Crear `ARCHITECTURE.md` con el diagrama real backend/frontend/BD/hooks/widget.
- **FID-007** · DOCS · Crear `SECURITY.md` con el informe RIESGO/UBICACIÓN/PROBLEMA/IMPACTO/SOLUCIÓN (Fase 15 completa).
- **FID-008** · DOCS · Crear `TESTING.md` documentando cómo correr la suite E2E una vez exista.
- **FID-009** · QA · Revisar responsive/UX en las vistas de cliente (mapa, home) en viewport móvil.

## P3 — Baja prioridad / mantenimiento

- **FID-010** · MAINTENANCE · Revisar dependencias desactualizadas (`npm outdated`, `mvn versions:display-dependency-updates`).
- **FID-011** · DOCS · Actualizar `DEPLOYMENT.md` con el estado real de Railway/Vercel según avance el despliegue.

---

Formato de cierre de cada tarea (se añade aquí al completarla):

```
### FID-XXX — completada YYYY-MM-DD
Archivos modificados: ...
Tests realizados: ...
Resultado: ...
```

### FID-002 — completada 2026-09-23
Archivos modificados/creados: `frontend/playwright.config.ts`, `frontend/e2e/global-setup.ts`,
`frontend/e2e/login.spec.ts`, `.gitignore` (excluye artefactos de Playwright y la cuenta E2E
efímera).
Tests realizados: 3/3 login E2E contra el backend/frontend de desarrollo real (localhost:8081/8100):
ADMIN (admin@fidelyfood.local, contraseña por defecto pública en AuthController.java),
RESTAURANTE (Venezuela Food, contraseña real desde `APP_SEED_RESTAURANT_PASSWORD`),
CLIENTE (cuenta desechable creada en cada ejecución vía `/api/auth/register`, credenciales
nunca persistidas en git). Cada test verifica la redirección real tras login
(`/admin/dashboard`, `/r/dashboard`, `/u/home`).
Resultado: 3 passed, 0 failed, 0 skipped.
Nota técnica: `@playwright/test` no estaba instalado (solo el driver base `playwright`); se
añadió como devDependency. El worktree usa su propio `node_modules` aislado (no symlink al
del checkout principal) para no modificar el entorno que el usuario tiene corriendo.

### FID-003 — completada 2026-09-23
Archivos modificados/creados: `frontend/e2e/helpers/auth.ts` (login vía API real + inyección de
sesión en localStorage), `frontend/e2e/client-flows.spec.ts`.
Tests realizados: 4 tests E2E de cliente contra el entorno real — home (carga y `app-user-card`
visible), mapa (geolocalización mockeada con la API estándar de Playwright sobre Valencia,
39.4699/-0.3763, sin quedarse en estado de error/denegado), historial (llega al estado vacío
real `.empty-state`, cuenta E2E sin movimientos), perfil + logout (botón real de cerrar sesión,
redirección a `/login` y `token` eliminado de localStorage).
Resultado: 7/7 passed (3 de FID-002 + 4 nuevos).
Incidencias encontradas y corregidas durante el desarrollo (no eran bugs de la app, sino del
propio fixture de test):
1. El helper de autenticación por API no guardaba `userId` en localStorage; sin él,
   `GlobalStateService.loadInitialState()` no puede reconstruir el usuario y `home` se queda
   cargando indefinidamente. Se corrigió capturando `id` de la respuesta de login real.
2. La aserción de `historial` comprobaba ausencia de `ion-spinner`, pero `ion-refresher-content`
   de Ionic siempre incluye su propio spinner en el DOM (oculto), independientemente del estado
   de carga real de la página. Se corrigió comprobando el estado vacío real (`.empty-state`).
