# Skill: database

## Propósito
Inspeccionar y razonar sobre la base de datos MySQL (`proyectoTFG` local; Aiven en producción) en apoyo de una tarea concreta, sin riesgo para los datos.

## Cuándo usarla
Cuando una tarea necesite entender datos o esquema: un bug que depende de filas, una consulta lenta, una nueva columna, una inconsistencia puntual.

## Herramientas permitidas
`inspect_database`, `inspect_schema`, `query_database` (solo lectura), `explain_query`. `execute_database_statement` solo con aprobación humana.

## Procedimiento
1. `inspect_database` para ver tablas y volumen; `inspect_schema <tabla>` para columnas, FK e índices.
2. Consulta con `query_database` (una sentencia SELECT/SHOW/EXPLAIN, máx. 200 filas; columnas password/token salen enmascaradas).
3. Rendimiento: `explain_query` y revisa que haya índice por las columnas de filtro (`restaurante_id`, `usuario_id`, `fecha`).
4. Cambios de esquema: **no hay migraciones**; Hibernate (`ddl-auto=update`) crea/ensancha columnas al arrancar. Modifica la entidad, no el SQL a mano.
5. Si realmente hace falta escribir datos: `execute_database_statement` con `reason` claro; para DROP/TRUNCATE/ALTER/DELETE exige `backup_confirmed=true` y aprobación humana.

## Validaciones
- La consulta devuelve lo esperado y respeta el volumen (no `SELECT *` sin `LIMIT` en tablas grandes).
- Tras un cambio de entidad: arrancar el backend y confirmar con `inspect_schema` el tipo de columna resultante.

## Riesgos
- Producción (Aiven free) se **apaga sola por inactividad**: un `UnknownHostException` en Render suele ser eso, no un fallo de código.
- Datos históricos de Mexican Food/Alabroster/Venezuela Food: nunca se sobrescriben para que pase una prueba.
- Nunca copies datos de producción a local ni al repositorio.

## Resultado esperado
Hallazgos respaldados por consultas reales (citando tabla y filtro), sin ninguna escritura no aprobada.
