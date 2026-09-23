# AGENT_TASKS — Backlog técnico de FidelyFood Agent

Backlog de trabajo autónomo. Cada tarea se resuelve en `agent/fidelyfood-autonomous`
(worktree separado en `../TFG-agent-worktree`), con commit independiente y
resumen — nunca se integra a `main` sin que el usuario lo decida.

Antes de tocar cualquier archivo: comprobar `git status` en el repo principal;
si el archivo aparece como modificado sin commitear allí, se salta esa tarea.

## P0 — Seguridad / bloqueante

- **FID-001** · SECURITY · Auditar rate-limiting ausente en `/api/auth/**` (login) — ya detectado en la Fase 15 preliminar, pendiente de decidir mecanismo (bucket4j vs. filtro propio).

## P1 — Alta prioridad

- **FID-002** · TEST · Crear `playwright.config.ts` (no existe todavía) y suite E2E mínima: login de los 3 roles (ADMIN, RESTAURANT, USER).
- **FID-003** · TEST · Tests E2E de cliente: home, mapa/geolocalización, historial, perfil, logout.
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
