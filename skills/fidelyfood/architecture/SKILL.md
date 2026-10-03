# Skill: architecture

## Propósito
Decidir dónde encaja un cambio en la arquitectura existente y evitar introducir estructuras paralelas o abstracciones innecesarias.

## Cuándo usarla
Al planificar una funcionalidad nueva o un cambio que cruza capas (BD ↔ backend ↔ frontend), antes de escribir código.

## Herramientas permitidas
`inspect_project`, `inspect_architecture`, `inspect_api`, `inspect_schema`, `search_code`, `read_file`, `memory_search`, `memory_add`, `task_create`.

## Procedimiento
1. `inspect_architecture` + `ARCHITECTURE.md`: capas reales (Angular/Ionic → API REST Spring → JPA → MySQL), roles y módulos.
2. `memory_search` y `.agent/decisions.md`: no re-decidas lo ya decidido.
3. Ubica el cambio: ¿entidad nueva o columna? ¿servicio existente o nuevo? ¿endpoint en un controller existente? Reutiliza antes de crear.
4. Plan por capas y orden: entidad/DAO → servicio (+tests) → controller/DTO → seguridad (rol) → servicio frontend → componente → E2E → docs.
5. Si afecta a varias partes, divide en tareas (`task_create`) con dependencias y criterios de aceptación medibles.
6. Cambios de arquitectura fundamentales (nuevo servicio, otra BD, cambio de autenticación) → **pedir decisión humana** con las alternativas y su coste.
7. Registra la decisión con `memory_add` (type=decision) y en `ARCHITECTURE.md` si es estructural.

## Validaciones
- El plan nombra los archivos concretos a tocar (existentes) y las pruebas que lo verifican.
- No hay duplicación con código existente (`search_code`).

## Riesgos
- Sobre-ingeniería: tres líneas parecidas son mejor que una abstracción prematura.
- Acoplar el frontend a detalles del backend (formas de entidad) en vez de DTOs.

## Resultado esperado
Un plan breve y concreto (por capas, con archivos y tests) o una pregunta precisa al humano si hay una decisión de arquitectura.
