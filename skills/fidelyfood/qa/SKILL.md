# Skill: qa

## Propósito
Probar flujos reales de extremo a extremo (backend + frontend + BD) con Playwright, y reportar con evidencia lo que funciona y lo que no.

## Cuándo usarla
Para verificar una funcionalidad o un arreglo desde la perspectiva del usuario, o antes de dejar una tarea en REVIEW.

## Herramientas permitidas
`service_status`, `service_start`, `run_e2e_tests`, `run_playwright`, `call_api`, `inspect_logs`, `query_database` (solo lectura), `read_file`/`write_file` (specs).

## Procedimiento
1. Servicios: `service_status`. Si no están, `service_start` backend (8081) y frontend (8100). Si ya hay algo escuchando, es del usuario: úsalo, no lo reinicies.
2. Flujos **cubiertos hoy** por specs reales (no inventes otros):
   - Login de los 3 roles (`login.spec.ts`): ADMIN → `/admin/dashboard`, RESTAURANTE → `/r/dashboard`, CLIENTE → `/u/home`.
   - CLIENTE (`client-flows.spec.ts`): home con tarjeta de usuario, mapa (geolocalización mockeada), historial/balance de puntos, perfil + logout.
   - RESTAURANTE (`restaurant-flows.spec.ts`): Centro de Mando, listado de promociones, scanner (cámara), flujo completo dashboard → crear promo → mis ofertas → ajustes.
   - Seguridad (`security-*.spec.ts`): rate-limit de login, no filtrar el hash de contraseña en promociones, aislamiento de stats entre restaurantes.
   - **Huecos conocidos** (sin spec todavía; si una tarea los toca, crea el spec): detalle de restaurante y promociones/recompensas del cliente, registro de compras/puntos desde el restaurante, historial de actividad del restaurante y funciones del panel de administración (solo hay login).
3. `run_e2e_tests` por suite o `run_playwright` con `specs`/`grep` para un caso. En fallo hay trazas/capturas (`frontend/test-results`).
4. Un fallo: reproduce (`run_playwright` solo ese caso), `inspect_logs`, causa, arreglo, repetición, y documenta.
5. Para un flujo nuevo, escribe un spec en `frontend/e2e/` reutilizando `helpers/auth.ts`; debe fallar sin el cambio.

## Validaciones
- Conteos reales passed/failed por suite.
- Capturas/trazas revisadas si algo falla.
- Sin datos de producción ni cuentas reales.

## Riesgos
- Las suites mutan la BD local de desarrollo (puntos, promociones de prueba): usa cuentas de QA y no ejecutes flujos destructivos.
- Dependen de `APP_SEED_RESTAURANT_PASSWORD` y de las cuentas de prueba existentes en la BD local.

## Resultado esperado
Informe con flujos probados, resultado por flujo, evidencia de fallos y su estado tras el arreglo.
