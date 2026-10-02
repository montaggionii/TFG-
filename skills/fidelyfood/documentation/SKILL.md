# Skill: documentation

## Propósito
Mantener la documentación técnica fiel al código para que el agente (y las personas) trabajen sin redescubrir el proyecto.

## Cuándo usarla
Al terminar cualquier tarea que cambie comportamiento, API, esquema, comandos o decisiones.

## Herramientas permitidas
`read_file`, `write_file`, `search_code`, `inspect_api`, `inspect_schema`, `memory_add`, `task_update`.

## Procedimiento
1. Identifica qué documento queda desfasado: `API.md` (endpoints), `DATABASE.md` (tablas/relaciones), `ARCHITECTURE.md`, `DEVELOPMENT.md` (arrancar/compilar), `TESTING.md`, `SECURITY.md`, `DEPLOYMENT.md`, `AGENTS.md`.
2. Actualiza **desde el código**, no de memoria: `inspect_api` para endpoints, `inspect_schema` para tablas.
3. Escribe para quien llega sin contexto: qué es, por qué, cómo se usa, cómo se verifica. Frases completas, sin jerga de sesión.
4. Decisiones importantes y causas de bugs: `memory_add` (decision/problem/solution). La memoria **no sustituye** a la documentación: la fuente de verdad es el repositorio.
5. Cierra la tarea con `task_update` (REVIEW) dejando en `Resultado` qué se hizo y cómo se verificó.

## Validaciones
- Cada comando documentado se ha ejecutado de verdad.
- Los endpoints/tablas citados existen (`inspect_api`/`inspect_schema`).
- Sin secretos ni valores reales de credenciales (solo nombres de variables).

## Riesgos
- Documentación aspiracional ("debería"): solo se documenta lo que existe y se ha verificado.
- Duplicar informes de auditoría ya hechos: enlaza a `SECURITY.md`/`.agent/discoveries.md`.

## Resultado esperado
Documentos al día, concisos y verificables, y `CHANGELOG_AGENT.md` con la entrada de la ejecución.
