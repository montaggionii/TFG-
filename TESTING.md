# Testing — FidelyFood

## Backend (JUnit + Mockito)

62 tests: **61 unitarios** sin base de datos (Mockito puro, en `src/test/java/progresa/springboot_tfg/{service,security,exception}`: `UsuarioServiceTest`, `RestauranteServiceTest`, `PromocionServiceTest`, `CompraServiceTest`, `RecompensaServiceTest`, `LoginRateLimiterTest`, `GlobalExceptionHandlerTest`) y **1 de integración** (`SpringBootTfgApplicationTests.contextLoads`, carga el contexto completo y necesita una MySQL local accesible).

Requiere **JDK 17**: con un JDK por defecto más nuevo (p. ej. 25) Mockito (mocks inline) no puede instrumentar clases y los tests de servicio fallan.

```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
./mvnw test -Dtest='!SpringBootTfgApplicationTests'    # unitarios (sin BD): 61 tests
set -a && source .env && set +a && ./mvnw test          # todo, incluido el de contexto (necesita MySQL)
```

Con el Agent Layer: `run_unit_tests` (scope `backend`; autodetecta JDK 17 y devuelve conteos reales) y `run_integration_tests`.

## Agent Layer (Node)

```bash
npm --prefix agent test      # 42 tests: política, aprobaciones, tareas, memoria, redacción, adaptadores LLM, runner, eventos, servidor MCP
```

## Frontend — E2E con Playwright

Suite real, contra el backend/frontend de **desarrollo ya en marcha** (no levanta servidores propios, para no chocar con los que ya tengas corriendo):

```bash
cd frontend
npx playwright test
```

Requiere: backend en `localhost:8081`, frontend en `localhost:8100`, MySQL conectada, y `APP_SEED_RESTAURANT_PASSWORD` definida en el `.env` de la raíz del proyecto (se lee automáticamente desde `playwright.config.ts`).

### Estructura

| Archivo | Qué prueba |
|---|---|
| `e2e/login.spec.ts` | Login de los 3 roles (ADMIN/RESTAURANTE/CLIENTE) y su redirección correcta |
| `e2e/client-flows.spec.ts` | Cliente: home, mapa (geolocalización mockeada), historial, perfil + logout |
| `e2e/restaurant-flows.spec.ts` | Restaurante: dashboard, promociones, scanner (carga del componente de cámara, sin simular un escaneo QR), flujo completo dashboard → crear promo → mis ofertas → ajustes |
| `e2e/security-restaurant-stats.spec.ts` | Regresión: un cliente no puede ver las stats de un restaurante ajeno |
| `e2e/security-login-rate-limit.spec.ts` | Regresión: bloqueo tras intentos fallidos, sin afectar a otras cuentas |
| `e2e/security-promotion-password-leak.spec.ts` | Regresión: la lista de promociones no expone el hash de contraseña del restaurante |
| `e2e/global-setup.ts` | Crea una cuenta de cliente desechable por ejecución (vía la API pública de registro; nunca credenciales fijas ni persistidas en git) |
| `e2e/helpers/auth.ts` | Login real vía API + inyección de la misma sesión que dejaría un login por UI (evita repetir el formulario en cada test) |

### Variable `E2E_API_URL`

Los tests de seguridad apuntan por defecto a `http://localhost:8081`. Para probar contra otra instancia (p. ej. una build con un arreglo pendiente de fusionar, corriendo en otro puerto):

```bash
E2E_API_URL=http://localhost:8082 npx playwright test security-restaurant-stats.spec.ts
```

### Principios seguidos en esta suite

- **Nunca simula datos**: los logins usan credenciales reales (sembradas o creadas vía la API pública), nunca inventadas ni hardcodeadas salvo el valor por defecto ya público de `AuthController.java` (admin).
- **Nunca simula un resultado que requeriría hardware real**: el test de scanner verifica que el componente de cámara carga, no un escaneo QR (eso requeriría una cámara física).
- **Geolocalización**: mockeada con la API estándar de Playwright (`context.setGeolocation`), no una simulación propia del test.
- **Cuentas de cliente**: desechables, generadas por ejecución, nunca persistidas en el repositorio.

## Requisito del navegador de Playwright

Tras actualizar `@playwright/test` hay que reinstalar el navegador (`npx playwright install chromium`, descarga ~150 MB). Sin él, los tests que abren página fallan con `Executable doesn't exist` (11 de 16 en la última comprobación) mientras que los que solo usan la API (seguridad) pasan. Está registrado como tarea AGT-006.

## Cobertura actual y huecos conocidos

- Backend: 61 tests unitarios de los 5 servicios de negocio principales y de seguridad (rate limiter, manejo de errores); `QrService` y los controllers no tienen test unitario propio (los cubre la capa E2E).
- Frontend: 2 specs unitarios de Karma; la cobertura real de UI está en Playwright.
- E2E sin spec todavía (tarea AGT-003): detalle de restaurante y promociones/recompensas del cliente, registro de compras desde el restaurante, historial de actividad del restaurante y funciones del panel admin (solo hay login).
- Funcionalidad sin implementar y sin test: canje de promociones CANJEAR (`POST /api/canjes`, tarea AGT-002).
- Ver `AGENT_TASKS.md` para el estado de cada tarea.
