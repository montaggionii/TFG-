# Skill: debugging

## Propósito
Resolver bugs con método: reproducir, analizar, encontrar la causa raíz, corregir, verificar y documentar. Nunca declarar un bug resuelto sin haberlo reproducido y re-verificado.

## Cuándo usarla
Cualquier informe de fallo: error HTTP, pantalla rota, dato incorrecto, caída de producción.

## Herramientas permitidas
`memory_search`, `service_start`/`service_status`, `call_api`, `run_playwright`, `inspect_logs`, `inspect_endpoint`, `query_database`, `search_code`, `read_file`, `write_file`, `run_unit_tests`, `memory_add`.

## Procedimiento
BUG → REPRODUCIR → ANALIZAR LOGS → CAUSA → SOLUCIÓN → IMPLEMENTAR → TEST → VERIFICAR → DOCUMENTAR

1. `memory_search` por síntomas: puede estar ya resuelto o documentado (`.agent/discoveries.md`, `.agent/errors.md`).
2. **Reproducir** con evidencia: petición concreta con `call_api` (status + cuerpo) o spec de Playwright que falle. Anota qué observas.
3. **Logs**: `inspect_logs` con `contains=ERROR`/`Exception`; correlaciona con la hora de la petición.
4. **Causa raíz**: formula una hipótesis, compruébala (leer código, consulta SQL de solo lectura). Distingue el síntoma de la causa.
5. Antes de culpar al código, descarta infraestructura: ¿BD de Aiven apagada? ¿disco efímero de Render? ¿alias de Vercel sin promocionar?
6. Implementa el cambio mínimo y añade un test que **falle sin él**.
7. **Verifica** repitiendo exactamente la reproducción original y el test; revisa que no haya regresiones (suite del área).
8. Documenta: `memory_add` (type=problem/solution) y, si procede, `.agent/errors.md`.

## Validaciones
- La reproducción antes falla y después pasa (misma petición/spec).
- Tests del área en verde.
- Resumen con: síntoma, causa, arreglo, evidencia antes/después.

## Riesgos
- Arreglar el síntoma (p. ej. capturar la excepción) sin tratar la causa.
- Reproducir contra producción: no se hace; local o staging.

## Resultado esperado
Bug corregido con causa explicada, test de regresión, verificación documentada y entrada de memoria.
