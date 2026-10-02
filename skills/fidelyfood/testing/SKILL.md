# Skill: testing

## Propósito
Escribir y ejecutar las pruebas correctas para un cambio: unitarias del backend, integración, E2E de Playwright y verificación de regresiones.

## Cuándo usarla
Siempre que se modifique código, y al crear tests nuevos para un bug o funcionalidad.

## Herramientas permitidas
`run_unit_tests`, `run_integration_tests`, `run_e2e_tests`, `run_playwright`, `service_status`/`service_start`, `read_file`/`write_file`, `inspect_logs`.

## Procedimiento
1. Elige el nivel mínimo que prueba el cambio: servicio → test unitario Mockito (`src/test/java/.../service/*Test.java`, sin BD); flujo de usuario → Playwright (`frontend/e2e/*.spec.ts`).
2. Unitarios backend: `run_unit_tests` scope=backend (excluye el test de contexto; usa JDK 17 automáticamente). El de contexto (`run_integration_tests`) necesita MySQL accesible.
3. E2E: necesitan backend (8081) y frontend (8100) **ya en marcha**. `service_status` primero; si no están, `service_start`. No mates servicios que no arrancó el agente.
4. Autenticación en E2E: usa `apiLoginClient`/`apiLoginRestaurant` de `frontend/e2e/helpers/auth.ts`; las contraseñas vienen del entorno, nunca hardcodeadas.
5. Un test nuevo debe **fallar sin el arreglo**; comprobarlo es parte de la tarea.
6. Si un test falla: lee la salida, `inspect_logs`, corrige la causa (no el test para que pase) y repite.

## Validaciones
- Conteos reales devueltos por la herramienta (passed/failed), no resúmenes de memoria.
- Sin tests flaky: si uno es intermitente, se investiga, no se reintenta hasta que pase.
- No se borran ni debilitan tests existentes para que el build pase.

## Riesgos
- E2E contra servicios del usuario pueden mutar datos de la BD local de desarrollo: usa cuentas de prueba y no ejecutes flujos destructivos.
- `contextLoads` falla sin MySQL: es un fallo de entorno, no de código.

## Resultado esperado
Cambio cubierto por tests que pasan, evidencia (conteos y salida relevante) en el resumen, y los tests nuevos documentados en `TESTING.md` si añaden una suite.
