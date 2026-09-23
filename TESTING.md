# Testing — FidelyFood

## Backend (JUnit)

Un único test de contexto (`src/test/java/progresa/springboot_tfg/SpringBootTfgApplicationTests.java`, método `contextLoads`). Necesita una MySQL local accesible y las credenciales exportadas en el shell (no se leen automáticamente de `.env`):

```bash
set -a && source .env && set +a
./mvnw test
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
| `e2e/restaurant-flows.spec.ts` | Restaurante: dashboard, promociones, scanner (carga del componente de cámara, sin simular un escaneo QR) |
| `e2e/security-restaurant-stats.spec.ts` | Regresión: un cliente no puede ver las stats de un restaurante ajeno |
| `e2e/security-login-rate-limit.spec.ts` | Regresión: bloqueo tras intentos fallidos, sin afectar a otras cuentas |
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

## Cobertura actual y huecos conocidos

- Sin tests unitarios de servicios/controladores del backend más allá del arranque de contexto — toda la cobertura real de lógica de negocio está en la capa E2E.
- Pendiente (backlog, ver `AGENT_TASKS.md`): más cobertura E2E de administrador, y de flujos de canje de recompensas/promociones de principio a fin.
