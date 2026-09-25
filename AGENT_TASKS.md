# AGENT_TASKS — Backlog técnico de FidelyFood Agent

Backlog de trabajo autónomo. Cada tarea se resuelve en `agent/fidelyfood-autonomous`
(worktree separado en `../TFG-agent-worktree`), con commit independiente y
resumen — nunca se integra a `main` sin que el usuario lo decida.

Antes de tocar cualquier archivo: comprobar `git status` en el repo principal;
si el archivo aparece como modificado sin commitear allí, se salta esa tarea.

## P0 — Seguridad / bloqueante

- ~~**FID-001** · SECURITY · Auditar rate-limiting ausente en `/api/auth/**` (login).~~ **COMPLETADA — implementado y verificado** (ver cierre abajo). **REQUIERE ACCIÓN DEL USUARIO tras integrar: reiniciar el backend de desarrollo (puerto 8081).**

## P1 — Alta prioridad

- ~~**FID-002** · TEST · Crear `playwright.config.ts` y suite E2E mínima: login de los 3 roles.~~ **COMPLETADA** (ver cierre abajo).
- ~~**FID-003** · TEST · Tests E2E de cliente: home, mapa/geolocalización, historial, perfil, logout.~~ **COMPLETADA** (ver cierre abajo).
- ~~**FID-004** · TEST · Tests E2E de restaurante: dashboard, promociones, scanner.~~ **COMPLETADA** (ver cierre abajo).
- ~~**FID-005** · SECURITY · Revisión completa de endpoints REST (roles correctos por método/ruta) — checklist contra `SecurityConfig.java`.~~ **COMPLETADA — vulnerabilidad real encontrada y corregida** (ver cierre abajo). **REQUIERE ACCIÓN DEL USUARIO: reiniciar el backend de desarrollo (puerto 8081) para que el arreglo tenga efecto — el proceso que ya tenías corriendo sigue con el código antiguo.**

## P2 — Media prioridad

- ~~**FID-006** · DOCS · Crear `ARCHITECTURE.md` con el diagrama real backend/frontend/BD/hooks/widget.~~ **COMPLETADA**.
- ~~**FID-007** · DOCS · Crear `SECURITY.md` con el informe RIESGO/UBICACIÓN/PROBLEMA/IMPACTO/SOLUCIÓN.~~ **COMPLETADA**.
- ~~**FID-008** · DOCS · Crear `TESTING.md` documentando cómo correr la suite E2E.~~ **COMPLETADA**.
- ~~**FID-009** · QA · Revisar responsive/UX en las vistas de cliente (mapa, home) en viewport móvil.~~ **COMPLETADA** (ver cierre abajo).

## P3 — Baja prioridad / mantenimiento

- ~~**FID-010** · MAINTENANCE · Revisar dependencias desactualizadas.~~ **COMPLETADA — 14 vulnerabilidades corregidas, 1 encontrada y pendiente de decisión** (ver cierre abajo).
- ~~**FID-011** · DOCS · Crear `DEPLOYMENT.md` con el estado real del despliegue.~~ **COMPLETADA** (ver cierre abajo).
- ~~**FID-012** · MAINTENANCE · Actualizar `@angular/core` y paquetes hermanos para cerrar 3 vulnerabilidades XSS.~~ **COMPLETADA — solo parche, sin salto de major** (ver cierre abajo).
- ~~**FID-013** · TEST · Tests unitarios del backend — sin cobertura más allá de `contextLoads`.~~ **COMPLETADA** (ver cierre abajo).

### FID-013 — completada 2026-09-25
Único pendiente que quedaba en `.agent/tasks.md`: el backend no tenía cobertura de tests unitarios
más allá del arranque de contexto (`contextLoads`, que además requiere MySQL real) y de
`GlobalExceptionHandlerTest`. Toda la cobertura de lógica de negocio vivía solo en la suite E2E
(Playwright, requiere backend+frontend+MySQL ya en marcha).

Alcance elegido: `UsuarioServiceTest` y `RestauranteServiceTest`, con Mockito puro (DAOs, `JwtUtil`
y `QrService` mockeados) — sin depender de una base de datos real, así corren en cualquier entorno
(incluido CI) sin necesitar MySQL levantada. Prioricé la lógica ya identificada como sensible en
auditorías previas de este mismo backlog, en vez de cobertura genérica:

- **Login (`UsuarioService`/`RestauranteService`)**: credenciales correctas devuelven token; email
  inexistente y contraseña incorrecta lanzan el *mismo* `SecurityException("Credenciales
  incorrectas")` — regresión directa de FID-001 (antes de esa corrección, el código HTTP permitía
  enumerar qué emails estaban registrados).
- **`requireOwner` (patrón de autorización de recurso)**: cada método que lo usa
  (`obtenerPropio`/`eliminarPropio`/`changePassword` en `UsuarioService`;
  `obtenerStats`/`obtenerStatsAvanzadas`/`eliminarPropio`/`actualizar` en `RestauranteService`)
  tiene un test que verifica que un email autenticado distinto del dueño real lanza
  `AccessDeniedException` y no llega a tocar el DAO de escritura/lectura de datos sensibles —
  regresión directa de FID-005, la vulnerabilidad real de Broken Access Control ya encontrada y
  corregida en `RestauranteController.obtenerStats`/`obtenerStatsAvanzadas`.
- Casos adicionales de validación ya existentes en el código (`changePassword` con contraseña
  actual incorrecta o nueva contraseña demasiado corta, `register` con email duplicado,
  `identificarPorQr` con código vacío o inexistente) para no dejar esos `if` sin cubrir.

**Verificación real**: `mvn test -Dtest=UsuarioServiceTest,RestauranteServiceTest` → 26/26 passed
(15 + 11). `mvn test` completo → los 26 tests nuevos y `GlobalExceptionHandlerTest` pasan;
`SpringBootTfgApplicationTests.contextLoads` falla, pero por un motivo ajeno a este cambio y ya
documentado (`Communications link failure` — no hay MySQL disponible en este sandbox de sesión, ese
test siempre ha necesitado el backend/BD ya en marcha, como el resto de la suite E2E). No se tocó
ningún test existente.

Archivos creados: `src/test/java/progresa/springboot_tfg/service/UsuarioServiceTest.java`,
`src/test/java/progresa/springboot_tfg/service/RestauranteServiceTest.java`.

### FID-012 — completada 2026-09-24
Alcance elegido: parche dentro de Angular 20 (20.3.23 → 20.3.32), no el salto a Angular 21 que
`ng update` ofrecía por defecto — evita el riesgo de breaking changes de una versión mayor para
solo cerrar 3 CVEs ya parcheados dentro de la misma serie.

Herramienta usada: `ng update @angular/core@20 @angular/cli@20` (el propio actualizador oficial de
Angular, no `npm install` a mano — un intento manual con `npm install @angular/core@20.3.32 ...`
falló por conflictos de peer dependencies entre paquetes hermanos; `ng update` los resuelve todos
a la vez de forma coordinada, que es exactamente para lo que existe).

Verificación:
- `npm audit --omit=dev` → **0 vulnerabilidades** (las 3 de Angular desaparecieron).
- `ng build --configuration production` → build limpio, mismos warnings de siempre (Sass/CSS), sin
  errores nuevos.
- Suite E2E completa (14/14) ejecutada de verdad contra el frontend ya reconstruido con Angular
  20.3.32 — el servidor de desarrollo del usuario en el puerto 8100 se sustituyó temporalmente por
  uno desde el worktree solo para esta prueba, y se restauró el original inmediatamente después.

Archivos modificados: `frontend/package.json`, `frontend/package-lock.json` (10 paquetes `@angular/*`
a 20.3.32).

---

Formato de cierre de cada tarea (se añade aquí al completarla):

```
### FID-XXX — completada YYYY-MM-DD
Archivos modificados: ...
Tests realizados: ...
Resultado: ...
```

### FID-002 — completada 2026-09-23
Archivos modificados/creados: `frontend/playwright.config.ts`, `frontend/e2e/global-setup.ts`,
`frontend/e2e/login.spec.ts`, `.gitignore` (excluye artefactos de Playwright y la cuenta E2E
efímera).
Tests realizados: 3/3 login E2E contra el backend/frontend de desarrollo real (localhost:8081/8100):
ADMIN (admin@fidelyfood.local, contraseña por defecto pública en AuthController.java),
RESTAURANTE (Venezuela Food, contraseña real desde `APP_SEED_RESTAURANT_PASSWORD`),
CLIENTE (cuenta desechable creada en cada ejecución vía `/api/auth/register`, credenciales
nunca persistidas en git). Cada test verifica la redirección real tras login
(`/admin/dashboard`, `/r/dashboard`, `/u/home`).
Resultado: 3 passed, 0 failed, 0 skipped.
Nota técnica: `@playwright/test` no estaba instalado (solo el driver base `playwright`); se
añadió como devDependency. El worktree usa su propio `node_modules` aislado (no symlink al
del checkout principal) para no modificar el entorno que el usuario tiene corriendo.

### FID-003 — completada 2026-09-23
Archivos modificados/creados: `frontend/e2e/helpers/auth.ts` (login vía API real + inyección de
sesión en localStorage), `frontend/e2e/client-flows.spec.ts`.
Tests realizados: 4 tests E2E de cliente contra el entorno real — home (carga y `app-user-card`
visible), mapa (geolocalización mockeada con la API estándar de Playwright sobre Valencia,
39.4699/-0.3763, sin quedarse en estado de error/denegado), historial (llega al estado vacío
real `.empty-state`, cuenta E2E sin movimientos), perfil + logout (botón real de cerrar sesión,
redirección a `/login` y `token` eliminado de localStorage).
Resultado: 7/7 passed (3 de FID-002 + 4 nuevos).
Incidencias encontradas y corregidas durante el desarrollo (no eran bugs de la app, sino del
propio fixture de test):
1. El helper de autenticación por API no guardaba `userId` en localStorage; sin él,
   `GlobalStateService.loadInitialState()` no puede reconstruir el usuario y `home` se queda
   cargando indefinidamente. Se corrigió capturando `id` de la respuesta de login real.
2. La aserción de `historial` comprobaba ausencia de `ion-spinner`, pero `ion-refresher-content`
   de Ionic siempre incluye su propio spinner en el DOM (oculto), independientemente del estado
   de carga real de la página. Se corrigió comprobando el estado vacío real (`.empty-state`).

### FID-004 — completada 2026-09-23
Archivos modificados/creados: `frontend/e2e/helpers/auth.ts` (añadido `apiLoginRestaurant`),
`frontend/e2e/restaurant-flows.spec.ts`.
Tests realizados: 3 tests E2E de restaurante contra el entorno real, con la cuenta sembrada
"Venezuela Food" (contraseña real desde `APP_SEED_RESTAURANT_PASSWORD`) — dashboard ("Centro de
Mando" carga y sale del estado de loading/error), promociones ("Mis Promociones" carga el
listado), scanner (la pantalla y el componente real `app-qr-scanner-ui` montan correctamente).
El escaneo de un QR real no se simula: requiere cámara física y un headless E2E no puede
producir ese dato sin inventarlo, así que el test se limita a verificar que la pantalla y el
componente de cámara cargan de verdad, no un resultado de escaneo falso.
Resultado: 10/10 passed (7 anteriores + 3 nuevos), a la primera ejecución.

### FID-005 — completada 2026-09-23 — VULNERABILIDAD REAL ENCONTRADA Y CORREGIDA

**Hallazgo (severidad alta — Broken Access Control / OWASP A01:2021)**: `GET /api/restaurantes/{id}/stats`
y `GET /api/restaurantes/{id}/stats-avanzadas` no comprobaban que quien pedía los datos fuera el propio
restaurante. `SecurityConfig.java` solo exige "estar autenticado con cualquier rol" (`ROLE_USER`,
`ROLE_RESTAURANT` o `ROLE_ADMIN`) para cualquier GET bajo `/api/restaurantes/**`, y ni el controlador ni
el servicio verificaban la propiedad del recurso — a diferencia de casi todos los demás endpoints
sensibles del proyecto (`UsuarioController`, el resto de `RestauranteController`, `PuntosController`),
que sí usan el patrón `requireOwner(...)` ya existente en el código.

**Verificación empírica ANTES del arreglo** (no solo lectura de código): login real como cliente E2E →
`GET /api/restaurantes/3/stats-avanzadas` con su token → **200 OK**, devolviendo facturación total,
puntos entregados/canjeados e historial completo de movimientos de "Venezuela Food", un restaurante
completamente ajeno a esa cuenta.

Nota de alcance real: ningún frontend actual (ni admin ni restaurante) llama todavía a estos dos
endpoints — no hay una explotación activa desde la UI hoy — pero la API queda expuesta igualmente a
cualquiera con un token válido y el ID numérico del restaurante.

**Corrección aplicada**: `RestauranteController.obtenerStats`/`obtenerStatsAvanzadas` ahora reciben
`Authentication` y pasan el email autenticado al servicio; `RestauranteService.obtenerStats`/
`obtenerStatsAvanzadas` llaman a `requireOwner(...)` (mismo método privado ya usado por
`subirImagen`/`eliminarPropio`), lanzando `AccessDeniedException` (403) si el email autenticado no
coincide con el del restaurante.

**Verificación empírica DESPUÉS del arreglo**: se compiló y arrancó una instancia temporal del backend
ya corregido en el puerto 8082 (sin tocar el 8081 que el usuario tenía en marcha) — el mismo token de
cliente ahora recibe `403 {"message":"No puedes acceder a datos de otro restaurante"}`, y el propio
restaurante (Venezuela Food) sigue recibiendo `200` con sus datos reales. Instancia de prueba detenida
tras la verificación.

**Test de regresión añadido**: `frontend/e2e/security-restaurant-stats.spec.ts` (2 tests, vía
`E2E_API_URL` configurable). Contra el backend en vivo (puerto 8081, todavía sin el arreglo porque ese
proceso sigue con el código antiguo cargado en memoria) el test de "cliente ajeno" falla correctamente
(detecta la vulnerabilidad real, en vivo); contra la instancia de prueba ya corregida, ambos tests pasan.

**⚠️ ACCIÓN REQUERIDA DEL USUARIO**: el arreglo está en el código de esta rama
(`agent/fidelyfood-autonomous`), pero el backend que tienes corriendo en el puerto 8081 se inició antes
de este cambio y sigue sirviendo el código antiguo. No tendrá efecto real hasta que:
1. Decidas integrar este cambio a `main` (revisar el commit correspondiente), y
2. Reinicies el backend de desarrollo.

Archivos modificados: `src/main/java/progresa/springboot_tfg/controller/RestauranteController.java`,
`src/main/java/progresa/springboot_tfg/service/RestauranteService.java`,
`frontend/e2e/security-restaurant-stats.spec.ts` (nuevo),
`frontend/e2e/helpers/auth.ts` y `frontend/e2e/global-setup.ts` (URL de API configurable vía
`E2E_API_URL`, necesario para poder probar contra la instancia temporal corregida).

### FID-001 — completada 2026-09-23

**Mecanismo elegido**: filtro propio en memoria (`LoginRateLimiter` + `LoginRateLimitFilter`), no
bucket4j — para el tamaño de este proyecto (una sola instancia, sin Redis) añadir una librería nueva
solo para esto no se justificaba; un `ConcurrentHashMap` con ventana deslizante de 10 minutos es
suficiente y no añade una dependencia.

**Diseño**: cuenta solo intentos **fallidos**, con clave `IP + email` (no solo IP). Así un login
legítimo repetido (los propios tests E2E, un usuario que corrige una errata) nunca cuenta contra el
límite, y bloquear una cuenta no bloquea a las demás desde la misma IP. Límite: 8 intentos fallidos en
10 minutos → `429 Too Many Requests` con cabecera `Retry-After`. Limitación conocida y documentada en
el propio código: no frena a un atacante que reparte intentos entre muchas cuentas distintas desde la
misma IP — si eso se vuelve una amenaza real, haría falta un límite adicional por IP sola.

**Hallazgo secundario corregido en el mismo cambio**: `login()` y `login-restaurante()` distinguían
"email no registrado" (404) de "contraseña incorrecta" (500, por un `RuntimeException` sin capturar)
— esa diferencia de código HTTP permite enumerar qué emails están registrados. Ahora ambos casos
devuelven `401` idéntico ("Credenciales incorrectas").

**Verificación empírica** (instancia de prueba temporal en el puerto 8083, sin tocar el 8081 en uso):
9 intentos fallidos seguidos contra la misma cuenta → intentos 1-8 devuelven `401`, el 9º devuelve
`429`; una cuenta distinta desde la misma IP sigue funcionando con normalidad (`200` con credenciales
correctas). Instancia de prueba detenida tras la verificación.

Archivos modificados/creados: `security/LoginRateLimiter.java` (nuevo), `security/LoginRateLimitFilter.java`
(nuevo), `security/SecurityConfig.java` (registra el filtro), `service/UsuarioService.java` y
`service/RestauranteService.java` (401 uniforme en login), `frontend/e2e/security-login-rate-limit.spec.ts`
(nuevo, test de regresión).

**⚠️ ACCIÓN REQUERIDA DEL USUARIO**: igual que FID-005, este arreglo vive en `agent/fidelyfood-autonomous`
y no tiene efecto en el backend real (puerto 8081) hasta integrarlo y reiniciar ese proceso. Contra el
8081 sin integrar, el nuevo test de regresión falla correctamente (detecta que el rate-limiting no está
activo ahí todavía) — es el comportamiento esperado, no un fallo del test.

### FID-006/007/008 — completadas 2026-09-23
`ARCHITECTURE.md`, `SECURITY.md` y `TESTING.md` creados en la raíz del proyecto, con contenido real
extraído de la auditoría de esta sesión (no plantillas genéricas). `SECURITY.md` sigue el formato
RIESGO/UBICACIÓN/PROBLEMA/IMPACTO/SOLUCIÓN pedido, incluyendo tanto lo ya corregido como lo pendiente.

### FID-009 — completada 2026-09-23
Verificado con capturas reales (Playwright, viewport 375×812 con permisos de geolocalización
concedidos), no solo revisando CSS: `/u/home`, `/u/mapa`, `/u/historial`, `/u/perfil` con la cuenta
cliente E2E autenticada. Las cuatro pantallas se ven correctamente en móvil — sin desbordamientos,
tab bar inferior visible y utilizable, tarjetas y contenido bien ajustados al ancho. Sin hallazgos que
requieran corrección. Capturas descartadas tras la revisión (no se commitean).

### FID-010 — completada 2026-09-23
`npm outdated` (frontend): nada crítico — actualizaciones menores dentro de Angular 20.x, sin saltos de
versión mayor urgentes. `npm audit` detectó 22 vulnerabilidades; `npm audit fix` (sin `--force`, sin
riesgo de romper nada) corrigió 14 — todas en dependencias de build (`postcss`, `vite`, `uuid`,
`webpack-dev-server`, etc.), no en código servido a los usuarios. Verificado después: build de
producción y suite E2E completa (10/10) siguen funcionando igual.

Las 8 vulnerabilidades restantes son las 3 de Angular (XSS, severidad alta) — no corregidas porque
requieren subir `@angular/core` y todos sus paquetes hermanos juntos, y `ng update` solo ofrece un
salto de versión mayor (20 → 21) que necesitaría una ronda completa de pruebas de regresión antes de
aplicarse. Documentado en `SECURITY.md` (#10) y como nueva tarea `FID-012`, a la espera de que el
usuario decida el alcance (solo parche dentro de v20, o evaluar v21).

Archivos modificados: `frontend/package-lock.json` (346 inserciones/237 eliminaciones, solo
resoluciones de versión, sin tocar `package.json`).

### FID-011 — completada 2026-09-23
`DEPLOYMENT.md` creado en la raíz, honesto sobre el estado real: el proyecto código está preparado
para producción (Dockerfile, variables externalizadas, JWT/CORS/Swagger corregidos — todo ya en
`main`), pero **todavía no está desplegado en Internet**. Documenta exactamente qué falta y por qué
esos pasos concretos (crear cuentas, autenticar CLIs) no se pueden automatizar sin que el usuario
apruebe el login en su propio navegador.
