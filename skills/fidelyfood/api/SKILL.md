# Skill: api

## Propósito
Descubrir, probar y documentar la API REST real de FidelyFood (`/api/**`), con sus roles y contratos.

## Cuándo usarla
Para entender un endpoint, probarlo con un rol concreto, comprobar un contrato o actualizar `API.md`.

## Herramientas permitidas
`inspect_api`, `inspect_endpoint`, `call_api`, `service_status`/`service_start`, `inspect_logs`, `read_file`.

## Procedimiento
1. `inspect_api` (opcionalmente con `filter`) lista método, ruta, rol requerido y `Controller:línea` **parseados del código**; no te fíes de documentación antigua.
2. `inspect_endpoint` muestra la regla de `SecurityConfig` aplicable y el código del método.
3. Para probar: backend en marcha (`service_status`); `call_api` con `auth` = `client` | `restaurant` | `admin`. El login se hace internamente con `AGENT_*_EMAIL/PASSWORD` (cuentas de prueba); el token nunca se devuelve.
4. Contrato: observa el JSON real devuelto; no inventes campos. Los DTOs están en `dto/`.
5. Subidas multipart: promociones usan el campo `imagen`, restaurantes `file` (límite 5 MB, JPG/PNG/WEBP); `call_api` solo envía JSON, para multipart usa Playwright o pide al usuario.
6. Si cambia un contrato, actualiza `API.md` y el frontend que lo consume.

## Validaciones
- Código HTTP y cuerpo coinciden con lo documentado.
- Un rol no autorizado recibe 403 (prueba ambos).
- `API.md` coincide con `inspect_api`.

## Riesgos
- Mutaciones (POST/PUT/PATCH/DELETE): libres en local, con aprobación en staging, prohibidas en production.
- `auth=admin` solo en local.
- No pruebes contra producción con cuentas reales.

## Resultado esperado
Pruebas reproducibles (petición + respuesta), y `API.md` fiel al código.
