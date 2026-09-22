# Agentes de IA trabajando en este repo

El estado técnico persistente del proyecto vive en [`.agent/`](.agent/):

- `.agent/state.md` / `.agent/state.json` — estado actual, última sesión, build/tests, uso.
- `.agent/tasks.md` — pendientes priorizados.
- `.agent/decisions.md` — decisiones de arquitectura y por qué.
- `.agent/discoveries.md` — hallazgos de auditorías (copias del proyecto, datos históricos, etc.).
- `.agent/errors.md` — errores encontrados y su resolución.

El registro cronológico de sesiones de trabajo autónomo está en [`.agent-progress.md`](.agent-progress.md).

Antes de empezar cualquier tarea, lee esos archivos para no re-descubrir el proyecto desde cero.

## Reglas para trabajo autónomo

- No ejecutar `DROP DATABASE`, `TRUNCATE`, `DELETE` masivo ni `ALTER` destructivo sin backup previo y confirmación explícita del usuario.
- No modificar credenciales/secretos de producción sin autorización.
- No sobrescribir datos históricos para hacer pasar una prueba.
- Hacer commits pequeños y lógicos, no mezclar varios cambios no relacionados.
