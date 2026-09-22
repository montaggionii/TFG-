# Estado del agente — FidelyFood / TFG

Última actualización: 2026-09-22 12:40 (por sesión Claude Code, montaggioni29@gmail.com)

## Estado
ACTIVO (sesión live en curso, no hay agente autónomo en segundo plano todavía — ver decisions.md, Fase 7 pendiente de diseño)

## Proyecto
- Nombre: FidelyFood (TFG)
- Ruta canónica: `/Users/montaggioni/projects/TFG-repaired-20260917`
- Repo: https://github.com/montaggionii/TFG- (rama `main`)
- Stack: Spring Boot 3.2.1 (Java 17, MySQL) + Angular 20 / Ionic 8 + Capacitor 8 (Android/iOS) + hosting Firebase

## Durante la última sesión
- ✓ Auditoría comparativa de 8 copias/backups del proyecto (ver discoveries.md) → se confirmó esta carpeta como versión canónica.
- ✓ Commit y PR de ~95 archivos pendientes (panel de administración, migración Canje→MovimientoPuntos, empaquetado móvil) → mergeado en `main` (PR #1).
- ✓ Corregidos 2 secretos reales encontrados en el diff: contraseña MySQL hardcodeada y JWT secret hardcodeado → movidos a variables de entorno.
- ✓ Reparada corrupción de refs de git (`main 2`, `origin/HEAD 2`, residuos de sincronización) que bloqueaba push/fetch.
- ✓ Creada esta estructura `.agent/` de estado persistente.
- ✓ Widget de escritorio (Übersicht) mostrando este estado.
- ⚠ Pendiente: rotar la contraseña MySQL que estuvo expuesta en texto plano en el working tree antes del commit.

## Tests
- Backend: 1 test (smoke test de arranque de contexto), sin cobertura real.
- Frontend: 2 specs Jasmine (app.component, home.page), sin cobertura del panel admin nuevo.
- No se han ejecutado builds/tests todavía en esta sesión (Fase 4 de validación real: PENDIENTE).

## Build
NO VALIDADO TODAVÍA — pendiente ejecutar `mvn clean install` y `npm run build` / `ng build` y reportar resultado real (Fase 4).

## Siguiente tarea recomendada
Ejecutar Fase 4 (validación real: dependencias, build backend/frontend, arranque, conexión BD, tests) y registrar resultados aquí.

## Uso (Anthropic Claude Code — plan Pro), snapshot de esta sesión
- Límite 5h: 28% usado, resetea en ~4h 7m (as of 2026-09-22 12:40)
- Límite semanal (todos los modelos): 22% usado, resetea en ~1d 5h
- Contexto de esta sesión: 179,869 / 1,000,000 tokens (18%)
- NO DISPONIBLE: coste económico exacto, "créditos" como unidad separada de tokens/porcentaje de plan — la plataforma no expone esas cifras vía API/MCP, solo porcentajes de las ventanas de límite y tokens de contexto de sesión.

Este bloque es una FOTO FIJA del momento de la última sesión con Claude Code, no un valor en vivo — el widget de escritorio lo lee de aquí, no consulta la API de Anthropic de forma independiente (ver decisions.md).
