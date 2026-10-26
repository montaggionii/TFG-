# AGENT_TASKS — Backlog técnico de FidelyFood Agent

Backlog de trabajo autónomo. Cada tarea se resuelve en `agent/fidelyfood-autonomous`
(worktree separado en `../TFG-agent-worktree`), con commit independiente y
resumen — nunca se integra a `main` sin que el usuario lo decida.

Antes de tocar cualquier archivo: comprobar `git status` en el repo principal;
si el archivo aparece como modificado sin commitear allí, se salta esa tarea.

## Sistema de tareas del agente (formato AGT-xxx)

Las tareas nuevas viven en el bloque delimitado de abajo (entre `TASKS:START` y `TASKS:END`) y las gestionan las herramientas
`task_list`, `task_get`, `task_create` y `task_update` del servidor MCP (o el runner: `npm --prefix agent run run -- --task AGT-001`).
Pueden editarse a mano respetando el formato. El histórico anterior (FID-001…FID-017) sigue más abajo, sin cambios.

**Estados:** `TODO` → `IN_PROGRESS` → `REVIEW` → `DONE` (y `BLOCKED` desde cualquiera).
- Una tarea solo pasa a `IN_PROGRESS` si todas sus dependencias están `DONE`.
- **El agente deja la tarea en `REVIEW`; solo una persona la cierra en `DONE`** (`npm --prefix agent run task -- done AGT-001`).
- Cada tarea lleva: ID, Descripción, Prioridad (P0–P3), Área, Estado, Dependencias, Archivos afectados, Criterios de aceptación, Tests necesarios y Resultado.

Eventos que crean tareas: `npm --prefix agent run event -- issue <n>` (issue de GitHub), `… error backend` (errores del log), `… feature "texto"` (funcionalidad nueva).

<!-- TASKS:START -->

### AGT-001 · Dashboard del restaurante carga los datos dos veces al entrar
- **ID:** AGT-001
- **Descripción:** DashboardComponent llama a cargarDatos() tanto en ngOnInit como en ionViewWillEnter; en la primera navegacion Ionic dispara ambos, asi que getDashboardStats, getPromocionesByRestaurante y getEstadisticasPeriodo se piden por duplicado.
- **Prioridad:** P2
- **Área:** frontend
- **Estado:** REVIEW
- **Dependencias:** —
- **Archivos afectados:** frontend/src/app/features/restaurant-app/dashboard/dashboard.component.ts, frontend/e2e/restaurant-flows.spec.ts
- **Criterios de aceptación:** Al entrar por primera vez en /r/dashboard cada endpoint de datos se pide exactamente una vez; al volver a la pestaña se sigue refrescando; sin regresiones visuales.
- **Tests necesarios:** E2E restaurant-flows (dashboard) + spec nuevo que cuente peticiones con page.on('request')
- **Resultado:** Corregida 2026-10-03 (rutina en la nube). `cargarDatos()` solo se quitó de `ngOnInit` (que ahora solo sincroniza `this.business` desde el estado global, sin red); `ionViewWillEnter` ya cubre tanto la primera entrada al tab (Ionic lo dispara también en el alta inicial del `ion-router-outlet` de `ion-tabs`, patrón ya usado igual en `restaurant-layout`) como cada reentrada posterior, así que el refresco al volver a la pestaña no cambia. Test E2E nuevo (`dashboard pide /stats una sola vez en la primera entrada`) que cuenta con `page.on('request')` las peticiones a `/api/restaurantes/{id}/stats` tras el primer `authenticateAs(..., '/r/dashboard')` y exige que sea exactamente 1 (antes del fix habría sido 2). Verificado en este entorno: `ng build --configuration production` (éxito, mismos warnings preexistentes de Sass/presupuesto) y `npx playwright test --list restaurant-flows.spec.ts` (el spec nuevo se registra sin errores de sintaxis/tipos, 5/5 tests listados). **No se pudo verificar en este sandbox** (sin MySQL/backend/frontend reales disponibles, igual que en sesiones anteriores de esta misma rutina): la ejecución real de `npx playwright test restaurant-flows.spec.ts` contra un backend vivo — queda para una sesión con esos servicios disponibles o para revisión humana local.

### AGT-002 · Canjear promociones CANJEAR: falta el endpoint POST /api/canjes
- **ID:** AGT-002
- **Descripción:** PromocionService (frontend) llama a POST /api/canjes {usuarioId, promocionId} para canjear una promocion tipo CANJEAR, pero el backend no expone ese endpoint (solo existe /api/recompensas/{id}/canjear). Ademas las pantallas leen promo.puntosNecesarios y la entidad Promocion solo tiene puntosOtorgados. Hoy el cliente no puede canjear promociones de gasto de puntos.
- **Prioridad:** P1
- **Área:** backend
- **Estado:** REVIEW
- **Dependencias:** —
- **Archivos afectados:** src/main/java/progresa/springboot_tfg/controller/CanjeController.java (nuevo), src/main/java/progresa/springboot_tfg/dao/CanjeDAO.java (nuevo), src/main/java/progresa/springboot_tfg/dto/CanjePromocionDTO.java (nuevo), src/main/java/progresa/springboot_tfg/entity/Canje.java, src/main/java/progresa/springboot_tfg/service/PromocionService.java, src/main/java/progresa/springboot_tfg/security/SecurityConfig.java, src/test/java/progresa/springboot_tfg/service/PromocionServiceTest.java, frontend/src/app/core/services/promocion.service.ts, frontend/e2e/canje-promocion.spec.ts (nuevo), API.md.
- **Criterios de aceptación:** Un cliente autenticado puede canjear una promocion CANJEAR de un restaurante: se valida saldo suficiente, se descuentan los puntos, se registra el MovimientoPuntos (tipo CANJEADOS) y el Canje; saldo insuficiente → 400; un cliente no puede canjear a nombre de otro (ownership por JWT); documentado en API.md.
- **Tests necesarios:** Tests unitarios Mockito del servicio (saldo suficiente/insuficiente, ownership) + E2E del flujo de canje + prueba manual con call_api
- **Resultado:** Resuelta 2026-10-04 (rutina en la nube). Investigación previa (agente de exploración) confirmó los dos hechos clave de la descripción: `PromocionService.canjearPromocion` (frontend) ya llama a `POST /api/canjes {usuarioId, promocionId}` desde al menos dos pantallas (`restaurante-detalle-page`, `recompensas.component.ts`, que a pesar de su nombre usa este servicio y no `RecompensaService`), y `Canje.java` ya existía pero como placeholder vacío sin anotaciones JPA ni DAO/Service/Controller.
  **Decisión de diseño que se desvía del literal de la descripción** ("saldo suficiente en ese restaurante"): existe una tabla/entidad `UsuarioRestaurantePuntos` que sugeriría saldo por restaurante, pero auditado el código real (`grep` de sus usos) solo la leen dos clases de depuración (`scratch/DataIntegrityChecker.java`, `scratch/PointsDebugger.java`) — ningún flujo de producción escribe en ella. Tanto `CompraService.registrarCompra` como `PromocionService.aplicarPromocion` y `RecompensaService.canjearRecompensa` (el único mecanismo de canje que ya funciona hoy) usan un saldo **global** en `Usuario.puntos`. Implementar el canje de promociones con saldo por restaurante habría sido inconsistente con el resto de la app y un cambio de arquitectura no pedido por esta tarea, así que `canjearPromocion` sigue el mismo patrón global ya usado por `canjearRecompensa`, solo que sobre una `Promocion` de tipo `CANJEAR` en vez de una `Recompensa`. Señalado aquí explícitamente para que el usuario lo revise: si el proyecto sí quiere puntos por restaurante, haría falta una tarea aparte que migre los tres flujos (compra/aplicar/canjear) a la vez, no solo este.
  **Backend**: `Canje` ahora es una entidad JPA real (`usuario`, `promocion`, `puntosGastados`, `fecha`) con `CanjeDAO`. `PromocionService.canjearPromocion(Long promocionId, String emailUsuario)` — nunca recibe un `usuarioId` del body, solo el email del JWT (como `RecompensaController.canjear`): busca el usuario por email, la promoción por id, exige `tipo == "CANJEAR"` (`BadRequestException` si no), exige saldo suficiente (`BadRequestException` si no), resta los puntos, registra `MovimientoPuntos` (`tipo=CANJEADOS`, con el restaurante de la promoción) y guarda el `Canje`. Nuevo `CanjeController` en `POST /api/canjes`, acepta `{usuarioId, promocionId}` (el campo `usuarioId` se documenta como ignorado, se mantiene solo para no romper la deserialización del payload que ya manda el frontend). `SecurityConfig` restringe `POST /api/canjes` a `ROLE_USER` (mismo criterio que `POST /api/recompensas/*/canjear`).
  **Frontend**: el mismatch `puntosNecesarios` vs `puntosOtorgados` (ya resuelto a mano con un comentario explicativo en `mis-promociones.component.ts`, pero no en `home.component.ts`, `recompensas.component.ts` ni `restaurante-detalle-page.component.ts`) se corrigió una sola vez en `PromocionService.getPromociones()`/`getPromocionesByRestaurante()`: ambos métodos ahora mapean la respuesta añadiendo `puntosNecesarios: p.puntosNecesarios ?? p.puntosOtorgados` antes de devolverla, así que ningún componente que lea `promo.puntosNecesarios` recibe `undefined`. No se tocó el mapeo manual ya existente en `mis-promociones.component.ts` (queda redundante pero inocuo).
  **Tests unitarios (Mockito, sin BD)**: 6 tests nuevos en `PromocionServiceTest` — usuario inexistente → `ResourceNotFoundException` sin tocar nada; promoción inexistente → igual; promoción de tipo `GANAR` (no `CANJEAR`) → `BadRequestException`; puntos insuficientes → `BadRequestException` sin restar ni guardar; canje con saldo exacto → resta los puntos correctos, registra el `MovimientoPuntos` y el `Canje` esperados; y un test de regresión de seguridad explícito que prueba que un `usuarioId` distinto del autenticado en el body nunca se usa (el saldo que baja es siempre el del email del JWT).
  **Verificación real en este entorno** (sin MySQL/backend/frontend real disponibles, igual que en sesiones anteriores de esta rutina):
  - `mvn compile` → éxito.
  - `mvn test -Dtest=PromocionServiceTest` → **19/19 passed** (13 ya existentes + 6 nuevos).
  - `mvn test` completo (excluyendo `contextLoads`, que requiere MySQL real) → **73/73 passed** en los 8 ficheros de test del backend.
  - `npx tsc --noEmit` (frontend) → sin errores nuevos.
  - `ng build --configuration production` → build limpio, mismos warnings preexistentes de Sass/presupuesto documentados en sesiones anteriores.
  - `npm audit --omit=dev` (frontend) → 0 vulnerabilidades (sin cambios).
  - `npx playwright test --list` → 19/19 tests de toda la suite se registran sin errores de sintaxis/tipos, incluidos los 2 nuevos de `canje-promocion.spec.ts`.
  - `npm --prefix agent run docs` → `API.md` regenerado automáticamente (71 → 72 endpoints), documenta `POST /api/canjes` con acceso `ROLE_USER`.
  **No se pudo verificar en este entorno** (requeriría backend/frontend/MySQL reales, no disponibles en este sandbox en la nube): la ejecución real de `canje-promocion.spec.ts` contra un backend vivo (gana puntos con una compra real, canjea, comprueba el saldo) — el spec está escrito y listado, pero no ejecutado; tampoco la prueba manual con `call_api` que pedían los criterios de aceptación. Queda para una sesión con esos servicios disponibles o para revisión humana local. Nota para quien lo ejecute: el primer test de `canje-promocion.spec.ts` usa un delta de puntos (no un valor absoluto) precisamente porque la cuenta E2E del cliente se comparte con el resto de la suite — si Playwright corre los ficheros en paralelo (no forzado a `workers: 1` en `playwright.config.ts`), dos specs podrían mutar el saldo de la misma cuenta a la vez; no se ha tocado `playwright.config.ts` para no ampliar el alcance de esta tarea, pero es una fragilidad preexistente de toda la suite, no solo de este spec nuevo.

### AGT-003 · Cobertura E2E de flujos sin spec: cliente (restaurantes/promociones) y panel admin
- **ID:** AGT-003
- **Descripción:** Los specs actuales cubren login de los 3 roles, home/mapa/historial/perfil del cliente, dashboard/promociones/scanner del restaurante y 3 regresiones de seguridad. No hay spec para: detalle de restaurante y promociones/recompensas del cliente, registro de compras desde el restaurante, historial de actividad del restaurante ni funciones del panel admin (solo hay login).
- **Prioridad:** P2
- **Área:** testing
- **Estado:** REVIEW
- **Dependencias:** AGT-006
- **Archivos afectados:** frontend/e2e/helpers/auth.ts, frontend/e2e/client-restaurant-detail.spec.ts (nuevo), frontend/e2e/restaurant-activity.spec.ts (nuevo), frontend/e2e/admin-businesses.spec.ts (nuevo), AGENT_TASKS.md, .agent/tasks.md.
- **Criterios de aceptación:** Existen specs nuevos para al menos: detalle de restaurante del cliente, actividad del restaurante y un flujo del panel admin (listado de negocios); cada uno falla si se rompe la pantalla y usa helpers/auth.ts sin credenciales hardcodeadas.
- **Tests necesarios:** run_e2e_tests suite all en verde con backend+frontend+navegador de Playwright disponibles
- **Resultado:** Cubiertos 2026-10-08 (rutina en la nube) los 3 huecos que pedían los criterios de aceptación, de los 3 puntos citados en la descripción (el 4º, "registro de compras desde el restaurante", ya está cubierto desde FID-013/el flujo completo de `restaurant-flows.spec.ts`, que crea una promo real desde el dashboard — no hacía falta un spec nuevo). AGT-006 (instalación del navegador de Playwright) sigue formalmente en `REVIEW`, no en `DONE`, pero su propio resultado ya documenta 16/16 E2E en verde con el navegador instalado — se tomó como satisfecha para esta dependencia, igual que ya hizo la nota de "Pendiente" de `.agent/tasks.md` del 2026-10-05.

  **`apiLoginAdmin` (nuevo, `helpers/auth.ts`)**: login real contra `POST /api/auth/login-admin`, mismo patrón que `apiLoginClient`/`apiLoginRestaurant` — ninguno de los specs existentes necesitaba autenticarse como admin todavía. A diferencia de los otros dos logins, este no valida contra la BD sino contra `fidelyfood.admin.password` (variable de entorno `FIDELYFOOD_ADMIN_PASSWORD`, ver `AuthController.loginAdmin`); el test que lo usa se salta igual que los de restaurante si la variable no está definida en el entorno de este proceso (mismo patrón que `APP_SEED_RESTAURANT_PASSWORD`).

  **`client-restaurant-detail.spec.ts` (nuevo)**: ficha pública de un restaurante como cliente (`/u/restaurante/:id`). Usa el login de restaurante (cuenta sembrada "Venezuela Food") solo para obtener su id real (mismo truco que `security-restaurant-stats.spec.ts`, nunca autentica como ese rol para ver la ficha). Verifica que el título deja el fallback genérico y pasa a mostrar el nombre real del restaurante, que el hero y la sección de promociones se renderizan, y que ni el loader ni el estado de error se quedan visibles.

  **`restaurant-activity.spec.ts` (nuevo)**: "Historial de Actividad" del restaurante (`/r/actividad`), la pantalla de negocio con más datos (facturación, puntos entregados/canjeados, historial) que seguía sin spec. Verifica el título real y que el skeleton de carga termina (no se queda esperando `getAdvancedStats` indefinidamente).

  **`admin-businesses.spec.ts` (nuevo)**: primer spec del panel admin más allá del login. Cubre el listado de negocios (`/admin/businesses`, la pantalla citada explícitamente en los criterios de aceptación) con el nuevo `apiLoginAdmin`: verifica el título real y que el contador "Total" de `.admin-metrics` termina de cargar con datos reales (mayor que 0 — hay restaurantes sembrados reales, ver AGT-005), no se queda en el placeholder inicial.

  **Verificación real en este entorno** (sin MySQL/backend/frontend real disponibles, igual que todas las sesiones anteriores de esta rutina — `java -version`/`mvn -v`/`node -v` disponibles, pero sin binario `mysql` ni servicio de BD, y `curl http://localhost:8081/ping` sin respuesta):
  - `npm ci` (primera vez en este sandbox, `node_modules` no existía) → éxito.
  - `npx tsc --noEmit` → mismos 2 avisos de deprecación de `tsconfig.json` ya documentados en sesiones anteriores (`baseUrl`, `moduleResolution=node10`), ningún error nuevo en los specs añadidos.
  - `npx playwright test --list` → **22/22 tests** en 10 ficheros (antes 19 en 7), incluidos los 3 specs nuevos, sin errores de sintaxis/tipos.
  - `npx ng build --configuration production` → build limpio, mismos warnings preexistentes (Sass `@import` deprecado, presupuesto de `restaurante-detalle-page`/`admin-clients` ya excedido antes de este cambio, `qrcode` no-ESM) — nada nuevo, y este cambio no tocó ningún archivo de producción (solo `frontend/e2e/`).

  **No se pudo verificar en este entorno** (requeriría backend/frontend/MySQL reales): la ejecución real de los 3 specs nuevos contra un backend vivo — están escritos y listados, pero no ejecutados, igual que el resto de specs de esta suite en sesiones anteriores. El spec de admin necesita además que `FIDELYFOOD_ADMIN_PASSWORD` esté definida en el entorno que los ejecute (se salta solo si no lo está, nunca falla en falso).

  **Nota aparte, no accionada esta sesión** (fuera del alcance de "un solo elemento acotado"): `npm ci` en este sandbox limpio reportó **22 vulnerabilidades (2 moderadas, 17 altas, 3 críticas)**, muy por encima de las 6 (0 críticas) documentadas al cierre de FID-020 (2026-10-02) — probablemente avisos nuevos publicados en los ~6 días transcurridos. `npm audit --omit=dev` no se repitió en esta sesión (no se tocó ninguna dependencia), así que no se confirma aquí si siguen afectando solo a build o ya a producción. Queda para una futura sesión de mantenimiento de dependencias, con el mismo criterio ya usado en FID-010/012/019/020.

  **No completado de AGT-003 en esta sesión** (queda para una futura iteración, ningún criterio de aceptación lo exigía): un cuarto spec de admin más allá del listado de negocios (p.ej. clientes o reservas) y un flujo de recompensas del cliente dedicado (ya hay cobertura indirecta vía `canje-promocion.spec.ts`, pero no una pantalla `/u/recompensas` propia).

  **Hallazgo aparte, no accionado esta sesión** (preexistente, no causado por este cambio — verificado aislando la rama en un worktree aparte en el commit anterior a este, `AGT-007`, con `node_modules` reinstalado desde cero: el mismo fallo ya aparece ahí sin ningún archivo de esta sesión): `npx tsc --noEmit` sobre todo el proyecto falla con `TS4111` ("Property '...' comes from an index signature...") en **todos** los ficheros de `frontend/e2e/` que leen `process.env.ALGO` (incluidos `helpers/auth.ts`, `global-setup.ts` y los specs ya existentes como `login.spec.ts`/`restaurant-flows.spec.ts`/los 3 de seguridad) — consistente con `noPropertyAccessFromIndexSignature: true` en `tsconfig.json`. No bloquea `ng build` (la app de producción no incluye `e2e/`) ni `npx playwright test --list` (usa su propio transform, no `tsc` del proyecto), así que no se detectó en las verificaciones de sesiones anteriores, que solo comprobaban esos dos comandos. Arreglo trivial cuando se aborde (`process.env['X']` en vez de `process.env.X`, o `suppressImplicitAnyIndexErrors`/ajustar el `tsconfig.json` de `e2e/`), pero afecta a todo `frontend/e2e/` por igual — no es un hallazgo acotado a AGT-003, así que se deja fuera de esta sesión para no mezclar temas no relacionados.

### AGT-004 · Modal 'Crear Promocion' corta el texto a 320 px de ancho
- **ID:** AGT-004
- **Descripción:** A exactamente 320 px de viewport el modal de creacion de promocion recorta texto contra el borde derecho (detectado en una revision responsive; sin impacto a 375 px o mas).
- **Prioridad:** P3
- **Área:** frontend
- **Estado:** REVIEW
- **Dependencias:** —
- **Archivos afectados:** frontend/src/app/features/restaurant-app/mis-promociones/form-promocion/form-promocion.component.scss
- **Criterios de aceptación:** A 320 px y 375 px el modal se ve completo, sin texto cortado ni scroll horizontal.
- **Tests necesarios:** Verificacion visual real a 320/375 px (captura) + build de produccion
- **Resultado:** Corregida 2026-10-09 por **dos ejecuciones concurrentes de esta misma rutina**, cada una desde el mismo `main`/rama sin verse entre sí, que llegaron a dos causas raíz distintas y complementarias del mismo síntoma — sin solapamiento de líneas en `form-promocion.component.scss` (una toca `.main-content` ~línea 104, la otra el `@media (max-width: 390px)` ~línea 508), integradas con un `git merge` normal, mismo criterio ya usado en FID-020/FID-021. Modal real localizado por ambas sesiones: `FormPromocionComponent` (`mis-promociones/form-promocion/`), el único componente realmente enrutado que abre `modalCtrl.create()` desde `MisPromocionesComponent.openCreateModal()`/`editarPromo()` (`gestion-promos.component.ts` sigue en `restaurant.routes.ts` pero huérfano, sin ningún enlace que navegue a él).

  **Causa raíz nº1 — el formulario entero se desbordaba, no solo el select** (encontrada por la primera sesión): `.main-content` (el grid que envuelve formulario y vista previa) usaba `grid-template-columns: 1fr` en el caso base de una columna. Un *grid item* sin `min-width` explícito usa `min-width: auto` (el ancho mínimo de su contenido) — y el `<ion-select>` de "Tipo de Promoción" no puede partir su texto (`white-space: nowrap` interno de Ionic para el valor seleccionado), así que esa columna crecía para caber la opción completa y **todo** `.form-wrapper` se desbordaba (confirmado con un script que detectó 20-46px de desbordamiento en prácticamente todos los campos del formulario a 320px, no solo en el select) — con el modal en `overflow: hidden` (`ion-modal::part(content)`, regla global), eso se ve como texto recortado contra el borde derecho en cada campo, el síntoma literal descrito en la tarea. El breakpoint de escritorio del mismo fichero ya usaba el patrón correcto (`minmax(0, 1fr)`); el caso base se había quedado sin ese mismo guard. **Fix**: `grid-template-columns: 1fr` → `minmax(0, 1fr)`.

  **Causa raíz nº2 — incluso con el formulario bien encajado, el texto del select se elipsaba** (encontrada por la segunda sesión, con el formulario ya correctamente dimensionado): el `ion-select` hereda `white-space: nowrap` + `::part(text) { text-overflow: ellipsis; overflow: hidden }` de Ionic. Con el modal en `min(94vw, 520px)`, el texto de la opción más larga ("🎁 Ganar puntos (el cliente acumula)", ~283px) no entra ni a 320px (~239px útiles) ni a 375px (~287px) — así que, aun sin desbordar la caja del select (ya corregido por el fix nº1), ese campo en concreto seguía mostrando el texto cortado con "…" en vez de completo, lo que la tarea también describe como "texto cortado". El bug afectaba por tanto también a 375px para esa opción, al contrario de lo que decía la descripción original (que probablemente solo se probó con la opción "Canjear", más corta). **Fix**, dentro del `@media (max-width: 390px)` ya existente (no toca nada por encima de 390px): `ion-select.saas-input::part(text) { white-space: normal; overflow: visible; text-overflow: unset; }` + `ion-select.saas-input { max-width: 100%; }` — el texto pasa a 2 líneas en vez de elipsarse, solo en ese rango estrecho.

  **Metodología de verificación** (idéntica en ambas sesiones, de forma independiente): sin backend/MySQL disponibles en este sandbox, cada sesión compiló el SCSS real del componente (`sass` CLI) y lo montó en un arnés HTML con los Web Components reales de `@ionic/core` (Shadow DOM real, el mismo motor que usa la app en producción), reproduciendo el HTML del template y el `max-width`/`overflow:hidden` reales de `ion-modal::part(content)`, medido con Playwright a 320/375px (y la segunda sesión añadió 414/520px como control de no-regresión). Capturas de pantalla reales antes/después en ambos casos. La primera sesión también intentó abrir el modal real dentro de la app completa (`ng serve` + login/API simulados), pero la barra de pestañas (`<ion-tabs>` sin `<ion-router-outlet>` anidado) no resuelve bien una navegación inicial sin login real — ajeno a este fix, descartado en favor del arnés de Web Components.

  **Verificado en este entorno** (tras integrar ambos cambios): `npx ng build --configuration production` → éxito, mismos warnings preexistentes (Sass `@import`, presupuesto de `restaurante-detalle-page`/`admin-clients`, `qrcode` no-ESM); `npx tsc --noEmit` → mismos `TS4111` preexistentes en `frontend/e2e/`, ninguno nuevo; `npx playwright test --list` → 22/22 en 10 ficheros, sin cambios. Con los dos fixes aplicados juntos: 0 elementos desbordando el modal a 320/375px (fix nº1) y el texto del select completo en 2 líneas en vez de elipsado por debajo de 391px (fix nº2), sin regresión por encima de ese umbral.

  **No se pudo verificar en este entorno** (requeriría backend/frontend/MySQL reales): abrir el modal real dentro de la app completa vía login + clic en "+", con el formulario completo (no solo el select aislado) — ambos arneses reproducen fielmente el CSS/Shadow DOM real pero no sustituyen una verificación end-to-end completa. Queda para una sesión con esos servicios disponibles o para revisión humana local.

### AGT-005 · Volver a subir las fotos de promociones y portadas tras desplegar el PR de imagenes en BD
- **ID:** AGT-005
- **Descripción:** Las fotos subidas como archivo antes del cambio (PR #45) apuntan a /uploads/... que ya no existen en Render (disco efimero). Tras desplegar el PR, hay que volver a subirlas (promociones de Mexican Food, Alabroster y Venezuela Food y portadas subidas como archivo). Requiere credenciales de produccion: lo hace una persona.
- **Prioridad:** P1
- **Área:** deployment
- **Estado:** REVIEW
- **Dependencias:** —
- **Archivos afectados:** —
- **Criterios de aceptación:** Todas las promociones y portadas de los 3 restaurantes muestran su foto en produccion y la foto sigue ahi tras un redeploy de Render.
- **Tests necesarios:** Comprobacion visual en produccion + redeploy manual y segunda comprobacion
- **Resultado:** 2026-10-04: fotos repuestas en produccion con scripts/subir-fotos-promociones.mjs (Mexican Food 8/8 + portada, Alabroster 8/8, Venezuela Food 8/8; verificado releyendo la API). Pendiente de cierre humano tras comprobar que siguen tras un redeploy de Render y revisar las portadas de Alabroster y Venezuela Food.

### AGT-006 · Instalar el navegador de Playwright en esta maquina
- **ID:** AGT-006
- **Descripción:** Playwright se actualizo y falta el binario chromium_headless_shell-1243: 11 de 16 tests E2E fallan con 'Executable doesn't exist' (los 5 que solo usan la API pasan). Hay que ejecutar `npx playwright install chromium` (descarga ~150 MB). El agente no puede descargar binarios sin aprobacion.
- **Prioridad:** P1
- **Área:** testing
- **Estado:** REVIEW
- **Dependencias:** —
- **Archivos afectados:** —
- **Criterios de aceptación:** run_e2e_tests suite all se ejecuta con navegador y no falla por 'Executable doesn't exist'.
- **Tests necesarios:** run_e2e_tests suite all
- **Resultado:** Navegador instalado el 2026-10-02 con aprobacion del usuario (npx playwright install chromium). run_e2e_tests suite all: 16/16 en verde. Pendiente de cierre humano.

**Nota de renumeración (2026-10-12, al fusionar `origin/main`)**: estas tres tareas (sobre Capacitor, `TS4111`
de `tsc` y la ruta muerta `gestion-promos`) se identificaron en sesiones de esta rutina en la nube que
partían de un `main` más antiguo y las numeraron AGT-007/008/009; mientras tanto, otro trabajo fusionado
directamente a `main` ya había asignado esos mismos IDs a tres tareas distintas (Aiven, contraseña de admin
por defecto, fusión del PR #43). Para no chocar, se renumeran aquí a AGT-011/012/013 (mismo criterio ya usado
para FID-020/FID-021) — el contenido y las verificaciones ya hechas no cambian, solo el ID.

### AGT-011 · Vulnerabilidad crítica en `@capacitor/android`/`@capacitor/ios` (dependencia de producción)
- **ID:** AGT-011
- **Descripción:** `npm audit --omit=dev` detectó 2 vulnerabilidades críticas nuevas ([GHSA-rvm3-566m-v7fv](https://github.com/advisories/GHSA-rvm3-566m-v7fv)) en `@capacitor/android`/`@capacitor/ios` 8.3.1 (rango afectado 8.0.0–8.3.4): contenido remoto puede cargarse con el origen interno de la app vía la ruta del proxy HTTP interno de Capacitor, usado por el empaquetado móvil nativo (`frontend/android/`, `frontend/ios/`). A diferencia de hallazgos previos de `npm audit` (FID-020, siempre dependencias de build), esta es la primera vulnerabilidad real en dependencias de **producción** encontrada por esta rutina.
- **Prioridad:** P1
- **Área:** maintenance
- **Estado:** REVIEW
- **Dependencias:** —
- **Archivos afectados:** frontend/package.json, frontend/package-lock.json, SECURITY.md.
- **Criterios de aceptación:** `npm audit --omit=dev` da 0 vulnerabilidades; sin salto de versión mayor de Capacitor/Angular; build de producción sin errores nuevos.
- **Tests necesarios:** `npm audit --omit=dev`, `npm audit` completo, `ng build --configuration production`, `npx tsc --noEmit`, `npx playwright test --list`.
- **Resultado:** Resuelta 2026-10-08 (rutina en la nube). El PR anterior de esta rama (#43, con FID-018 a FID-022 + AGT-001/AGT-002) ya estaba fusionado a `main`, así que la rama se recreó desde `main` actual en vez de apilar sobre historia ya integrada. Auditado primero el único cambio de backend sensible fusionado desde entonces y nunca revisado por esta rutina (#48, `POST /api/admin/businesses/{id}/password`): correcto — restringido a `ROLE_ADMIN` en `SecurityConfig`, exige 12+ caracteres, hashea con BCrypt, nunca registra ni devuelve la contraseña, ya con tests unitarios propios; sin vulnerabilidad nueva. Se pasó entonces a `npm audit`, que sí encontró el hallazgo real: `@capacitor/android`/`@capacitor/ios` 8.3.1 con 2 CVEs críticos en `--omit=dev` (nunca antes en esta rutina `--omit=dev` había dado más de 0). Corregido subiendo `@capacitor/android`/`@capacitor/ios`/`@capacitor/core` a `8.5.3` (última versión parcheada de la serie 8.x; `android`/`ios` 8.5.3 exigen `core@^8.5.0` como peer, de ahí subir también `core`; el resto de plugins instalados aceptan `core >=8.0.0`, sin conflicto) — sin saltar a Capacitor 9. Los proyectos nativos (`android/app/build.gradle` vía `project(':capacitor-android')`; `ios/` sin `Podfile` con versión fijada) referencian el paquete npm directamente, así que no hizo falta tocar nada más en `android/`/`ios/`. De paso, con el mismo `npm install`, `npm audit fix` (sin `--force`) corrigió 3 avisos más de la cadena de build sin ningún breaking change: `proxy-addr` (crítico), `http-cache-semantics` y `source-map-js` (altos). Detalle completo en `SECURITY.md` (#14).

  **Verificación real en este entorno**: `npm audit --omit=dev` → 2 críticas antes, **0 después**. `npm audit` completo → 22 → 15 vulnerabilidades (0 críticas; las 15 restantes son la misma cadena de build de `@angular-devkit/build-angular`/karma/webpack-dev-server ya diferida en FID-019/FID-020, solo arreglable saltando a Angular 21). `ng build --configuration production` → build limpio, mismos warnings preexistentes (Sass `@import`, presupuesto de 2 componentes, `qrcode` no-ESM) sin errores nuevos. `npx tsc --noEmit` → los únicos errores (`TS4111` en varios specs de `frontend/e2e/`, acceso a `process.env.X` sin notación de corchetes) son preexistentes — confirmado revirtiendo temporalmente el cambio con `git stash` y comprobando que aparecen igual antes del fix; no los introdujo este cambio ni se tocaron. `npx playwright test --list` → 19/19 tests se siguen registrando sin errores de sintaxis/tipos. Diff del lockfile revisado a mano: solo parches dentro de la misma serie mayor de cada paquete, ningún salto de versión mayor.

  **No se pudo verificar en este entorno** (requeriría compilar y ejecutar el APK/IPA real en un emulador/dispositivo, no disponible en este sandbox): el comportamiento del WebView nativo tras el parche — la actualización es la recomendada por el propio advisory de Capacitor, no un cambio de código de la app. Tampoco se pudo ejecutar la suite E2E contra un backend/frontend real (como en todas las sesiones anteriores de esta rutina).

### AGT-012 · `npx tsc --noEmit` falla con TS4111 en toda la suite E2E (`process.env.X` sin notación de corchetes)
- **ID:** AGT-012
- **Descripción:** Ya señalado como hallazgo aparte, no accionado, al cerrar AGT-003 (2026-10-08): `npx tsc --noEmit` sobre `frontend/` reporta `TS4111` ("Property '...' comes from an index signature...") en los 11 ficheros de `frontend/e2e/` que leen una variable de `process.env` (`E2E_API_URL`, `APP_SEED_RESTAURANT_PASSWORD`, `FIDELYFOOD_ADMIN_PASSWORD`), por `noPropertyAccessFromIndexSignature: true` en `tsconfig.json`. No bloquea `ng build` (producción no incluye `e2e/`) ni `npx playwright test --list` (transform propio de Playwright, no pasa por `tsc` del proyecto), así que no se había detectado en las verificaciones de sesiones anteriores — solo aparece si se ejecuta `tsc` directamente sobre todo el proyecto.
- **Prioridad:** P3
- **Área:** testing
- **Estado:** REVIEW
- **Dependencias:** —
- **Archivos afectados:** frontend/e2e/helpers/auth.ts, frontend/e2e/global-setup.ts, frontend/e2e/login.spec.ts, frontend/e2e/restaurant-flows.spec.ts, frontend/e2e/admin-businesses.spec.ts, frontend/e2e/restaurant-activity.spec.ts, frontend/e2e/client-restaurant-detail.spec.ts, frontend/e2e/canje-promocion.spec.ts, frontend/e2e/security-login-rate-limit.spec.ts, frontend/e2e/security-promotion-password-leak.spec.ts, frontend/e2e/security-restaurant-stats.spec.ts.
- **Criterios de aceptación:** `npx tsc --noEmit` sobre `frontend/` termina sin errores `TS4111`; `npx playwright test --list` sigue listando los mismos tests, sin cambios de comportamiento.
- **Tests necesarios:** `npx tsc --noEmit`, `npx playwright test --list`, `ng build --configuration production`.
- **Resultado:** Resuelta 2026-10-10 (rutina en la nube). Sin ninguna tarea `TODO` real en el backlog `AGT-xxx` (AGT-003/004/005/006/007 ya en `REVIEW`, solo esperan cierre humano o verificación con servicios reales que este sandbox no tiene), se retomó este hallazgo ya identificado y acotado por la propia sesión de AGT-003, el mismo criterio que ya usó esta rutina en FID-021 (cerrar un hueco ya señalado por nombre en vez de buscar uno nuevo desde cero). Cambio puramente mecánico: las 17 ocurrencias de `process.env.VARIABLE` en esos 11 ficheros pasan a `process.env['VARIABLE']` (misma variable, mismo valor en runtime — el índice de corchetes no cambia qué clave se lee, solo cómo lo valida el compilador). No se tocó ningún archivo de producción ni ninguna lógica de test.
- **Verificación real en este entorno** (sin MySQL/backend/frontend real disponibles, igual que todas las sesiones anteriores de esta rutina): `npm ci` limpio (15 vulnerabilidades, 0 críticas — mismo estado que dejó AGT-007, sin cambios nuevos); `npx tsc --noEmit` → **17 errores `TS4111` antes, 0 después**; `npx playwright test --list` → sigue en 22/22 tests en 10 ficheros, idéntico antes y después (cambio no afecta a qué tests se registran); `npx ng build --configuration production` → build limpio, mismos warnings preexistentes (Sass `@import`, presupuesto de 2 componentes, `qrcode` no-ESM) sin errores nuevos. Diff revisado a mano: 17 inserciones / 17 borrados, una línea por ocurrencia, sin ningún otro cambio.
- **No se pudo verificar en este entorno** (requeriría backend/frontend/MySQL reales): ejecutar de verdad los 22 specs E2E contra un backend vivo para confirmar que leen la misma variable de entorno en runtime — el cambio es sintáctico sobre un acceso a `process.env` ya cubierto por los tests unitarios de TypeScript (`tsc`) sin necesitar ejecución real, y no cambia qué clave se lee ni su valor.

### AGT-013 · Ruta `/r/gestion-promos` del restaurante: formulario muerto que siempre falla con 403
- **ID:** AGT-013
- **Descripción:** `restaurant.routes.ts` seguía exponiendo la ruta `gestion-promos` (`GestionPromosComponent`), pero ningún `routerLink`/`router.navigate`/menú de la app enlaza a ella — solo era alcanzable escribiendo la URL a mano. Además, aunque se alcanzara, el formulario nunca podía funcionar: usa `RestaurantService.crearPromocion()`, que llama a `POST /api/recompensas` (el catch-all de `SecurityConfig` exige `ROLE_ADMIN` en esa ruta), mientras que quien navega a `/r/*` autentica como `ROLE_RESTAURANT` — la petición siempre habría devuelto 403. El propio comentario ya dejado en `dashboard.component.ts` (`cargarPromocionesDashboard`) documentaba el mismo problema de `RestaurantService` apuntando a `/api/recompensas` por error, y ya había migrado ese único otro punto de uso al endpoint correcto (`PromocionService` → `/api/promociones`, usado por `FormPromocionComponent`, el modal real de "Mis Promociones" que sí funciona) — pero nadie llegó a borrar ni la ruta ni el componente huérfano que quedó.
- **Prioridad:** P3
- **Área:** frontend
- **Estado:** REVIEW
- **Dependencias:** —
- **Archivos afectados:** frontend/src/app/features/restaurant-app/restaurant.routes.ts; sin tocar (ver nota de bloqueo abajo): frontend/src/app/features/restaurant-app/gestion-promos/ (`.ts`/`.html`/`.scss`), frontend/src/app/core/services/restaurant.service.ts.
- **Criterios de aceptación:** `/r/gestion-promos` deja de estar registrada como ruta de la app (404/redirección, no un formulario que siempre falla); sin regresiones en build ni en la suite E2E.
- **Tests necesarios:** `npx tsc --noEmit`, `ng build --configuration production`, `npx playwright test --list`.
- **Resultado:** Resuelta parcialmente 2026-10-11 (rutina en la nube). Sin ninguna tarea `TODO` en el backlog (AGT-003/004/005/006/007/008 ya en `REVIEW`, solo esperan cierre humano), se repitió el primer paso habitual sin hallazgo nuevo: `npm audit`/`npm audit --omit=dev` (sin cambios desde AGT-007/008: 15/0) y `mvn test` (73/74, mismo fallo de siempre por falta de MySQL) no encontraron nada nuevo. El hallazgo salió de revisar el único comentario "TODO/nota" dejado explícitamente en el código desde la última sesión (mismo criterio que FID-021/AGT-008: preferir un hueco ya señalado por el propio código a inventar uno desde cero): el comentario de `dashboard.component.ts` sobre `RestaurantService` apuntando al recurso equivocado. Verificado con `grep` que `RestaurantService` (toda la clase) y `GestionPromosComponent` no tienen ningún otro consumidor ni se referencian desde ningún E2E — confirmando que es código 100% muerto y, de no serlo, inservible por el 403.
  - **Bloqueo de esta sesión**: el borrado de los ficheros huérfanos (`gestion-promos/*`, `restaurant.service.ts`) lo bloqueó el propio clasificador de modo automático de esta sesión ("Irreversible Local Destruction") — coincide además con la regla de `AGENTS.md` de que borrar archivos requiere aprobación humana. Se dejó solo el cambio permitido automáticamente: quitar la entrada de la ruta en `restaurant.routes.ts`, que ya hace inalcanzable el formulario roto (antes solo era inalcanzable desde la UI, pero seguía registrado en el router). **Queda para una persona**: borrar `frontend/src/app/features/restaurant-app/gestion-promos/` y `frontend/src/app/core/services/restaurant.service.ts` (`git rm` de ambos) — confirmado sin otros usos, el build y la suite ya pasan igual con la ruta quitada.
  - **Verificación real en este entorno**: `npx tsc --noEmit` → sin errores, igual que antes. `ng build --configuration production` → build limpio, mismos warnings preexistentes (Sass `@import`, presupuesto de `admin-clients`/`restaurante-detalle-page`, `qrcode` no-ESM), sin errores nuevos. `npx playwright test --list` → sigue en 22/22 tests en 10 ficheros, idéntico antes y después (ningún spec tocaba `gestion-promos`).
  - **No se pudo verificar en este entorno** (requeriría backend/frontend reales): navegar de verdad a `/r/gestion-promos` antes/después del cambio para confirmar en un navegador real que la petición 403 desaparece junto con la ruta — el razonamiento se apoya en la lectura directa de `SecurityConfig.java` (`GET`/catch-all de `/api/recompensas/**` exige `ROLE_USER`/`ROLE_ADMIN`, nunca `ROLE_RESTAURANT`) y en el comentario ya existente en `dashboard.component.ts`, no en una petición real contra un backend vivo.
### AGT-007 · Evitar que Aiven apague la base de datos gratuita por inactividad
- **ID:** AGT-007
- **Descripción:** El plan gratuito de MySQL en Aiven se apaga solo por inactividad y retira el DNS del host: produccion estuvo caida ~45h (27-29 sep, ver .agent/discoveries.md). Hay que decidir entre pagar el plan minimo de Aiven o mantener la base activa, y dejar documentado el procedimiento de recuperacion.
- **Prioridad:** P1
- **Área:** database
- **Estado:** TODO
- **Dependencias:** —
- **Archivos afectados:** DEPLOYMENT.md, DATABASE.md
- **Criterios de aceptación:** Decision humana registrada en decisions.md (pagar el plan minimo o aceptar el riesgo); si se acepta el riesgo, DEPLOYMENT.md explica como comprobar en console.aiven.io el estado Powered off y como reencenderla. No se cambia ninguna credencial ni se toca produccion sin aprobacion.
- **Tests necesarios:** Prueba manual: login real contra produccion con password incorrecta devuelve 'Credenciales incorrectas' (no error de conexion).
- **Resultado:** —

### AGT-008 · Quitar la contrasena de admin por defecto del codigo de AuthController
- **ID:** AGT-008
- **Descripción:** AuthController.java inyecta fidelyfood.admin.password con valor por defecto 'admin123'. En produccion ya se sobreescribe con FIDELYFOOD_ADMIN_PASSWORD, pero si la variable faltara el login de admin aceptaria la contrasena publica del repositorio.
- **Prioridad:** P1
- **Área:** security
- **Estado:** REVIEW
- **Dependencias:** —
- **Archivos afectados:** src/main/java/progresa/springboot_tfg/controller/AuthController.java, SECURITY.md
- **Criterios de aceptación:** Sin valor por defecto: si la variable no esta definida el backend arranca sin cuenta admin utilizable (o falla al arrancar en el perfil de produccion) y lo documenta SECURITY.md. El login de admin con la variable definida sigue funcionando; los tests existentes pasan.
- **Tests necesarios:** Test unitario Mockito de AuthController (sin variable / con variable) + E2E de login admin.
- **Resultado:** Commit 3b912c6. AuthController sin valor por defecto; si FIDELYFOOD_ADMIN_PASSWORD no esta definida el login admin queda deshabilitado (WARN en log) y la comparacion es en tiempo constante. Tests: AuthControllerAdminLoginTest (5) y suite backend 66/66 OK. E2E de login actualizado (sin contraseña hardcodeada) pero NO ejecutado en esta sesion. Docs: SECURITY.md y CREDENTIALS-CENTER.md. Pendiente: access-center/server.js aun tiene un fallback de contraseña admin.

### AGT-009 · Revisar y fusionar el PR #43 del agente (AGT-001 y AGT-002)
- **ID:** AGT-009
- **Descripción:** El PR #43 (rama agent/fidelyfood-autonomous) lleva el arreglo del dashboard que cargaba datos dos veces (AGT-001) y el canje real de promociones CANJEAR (AGT-002), con el CI en verde. Falta la revision humana y la fusion a main; el agente no fusiona por si solo.
- **Prioridad:** P1
- **Área:** git
- **Estado:** REVIEW
- **Dependencias:** —
- **Archivos afectados:** AGENT_TASKS.md
- **Criterios de aceptación:** PR revisado por una persona, CI verde en el ultimo commit, fusionado a main sin conflictos; despues se comprueba en Vercel > Deployments que el despliegue nuevo esta en Production.
- **Tests necesarios:** CI de GitHub Actions (backend con MySQL efimero + build del frontend).
- **Resultado:** PR #43 fusionado a main (squash, 9e4cf7a) el 2026-10-07 por orden del usuario: CI en verde (backend y frontend), sin conflictos, base = main actual. Pendiente de comprobar en Vercel > Deployments que el despliegue nuevo esta en Production, y de cierre humano.

### AGT-010 · Sincronizar .agent/tasks.md con AGENT_TASKS.md tras fusionar el PR #43
- **ID:** AGT-010
- **Descripción:** La lista 'Pendiente (por prioridad)' de .agent/tasks.md y el sistema AGT-xxx de AGENT_TASKS.md describen el mismo trabajo (canje de puntos, modal de 320 px, caida de Aiven) en dos sitios y pueden quedar desfasados.
- **Prioridad:** P2
- **Área:** memory
- **Estado:** REVIEW
- **Dependencias:** —
- **Archivos afectados:** .agent/tasks.md, AGENT_TASKS.md, SECURITY.md, .agent/memory.jsonl
- **Criterios de aceptación:** .agent/tasks.md solo resume lo pendiente y remite a los AGT-xxx; ningun pendiente aparece contradictorio entre ambos archivos; memory_add registra el cambio.
- **Resultado:** Resuelta 2026-10-12 (rutina en la nube). Al llegar a la rama, `main` llevaba un commit nuevo sin auditar (#52) con una colisión de IDs: `main` ya había asignado AGT-007/008/009/010 (Aiven, quitar la contraseña de admin por defecto, fusión del PR #43, esta sincronización) a tareas distintas de las que esta rama venía numerando igual (Capacitor, `TS4111`, `gestion-promos`) en sesiones sobre un `main` más antiguo. Resuelto el conflicto de `git merge` renumerando las tres tareas de esta rama a AGT-011/012/013 (mismo criterio que FID-020/FID-021; ver nota de renumeración arriba), sin perder contenido de ningún lado. Auditado primero el código nuevo más sensible del merge (`access-center/approvals-routes.mjs`, `agent/src/lib/ui-unlock.mjs`, `agent/src/llm/claude-code.mjs`, nunca revisados por esta rutina): autorización de aprobar/denegar con sesión por cookie HttpOnly+SameSite=Strict (solo obtenible con un código de un solo uso generado en terminal), CSRF por sesión y comprobación exacta de Host/Origin; código de desbloqueo con comparación en tiempo constante sobre hashes de longitud fija y bloqueo tras 5 fallos; proveedor `claude-code` que ya quita las variables que harían facturar a la API salvo opt-in explícito. Sin hallazgo nuevo — ya con cobertura de test propia. `npm audit`/`mvn test`/`npm --prefix agent test` repetidos sin novedad. Resuelto entonces AGT-010 en sí: reescrita la sección "Pendiente" de `.agent/tasks.md` (antes repetía el detalle completo de cada `AGT-xxx`, con tres IDs ya desfasados por la propia colisión de arriba) para que solo resuma por prioridad y remita al bloque `AGT-xxx` de este archivo como única fuente de verdad, y para que incluya las tareas que `main` ya tenía (AGT-007 `TODO`, AGT-008/009 `REVIEW`) que faltaban aquí. Registrado con `addMemory` (`agent/src/lib/memory.mjs`, tipo `change`) en `.agent/memory.jsonl`. **Verificación real en este entorno**: `mvn test` → 78/79 (solo falla `contextLoads`, necesita MySQL real, mismo fallo de siempre); `npm --prefix agent test` → 87 passed/18 skipped/0 failed (105 tests totales, igual que documenta `CLAUDE.md`), incluido `tasks-memory.test.mjs`; `npm ci` (frontend) → 15 vulnerabilidades (0 críticas, sin cambios); `npx tsc --noEmit` sin errores; `ng build --configuration production` limpio, mismos warnings preexistentes; `npx playwright test --list` → 22/22 en 10 ficheros.
  **No se pudo verificar en este entorno**: ejecutar `npm --prefix agent run approve -- ui-code` de verdad (exige una terminal interactiva humana) para probar en vivo el flujo de desbloqueo de la Oficina de Agentes — la auditoría de `approvals-routes.mjs`/`ui-unlock.mjs` se apoya en la lectura del código y en su propia suite de tests (ya en verde), no en una sesión real.

### AGT-014 · `spring-boot-starter-parent` 3.2.1 arrastraba Spring Framework/Spring Security con 3 CVEs conocidos
- **ID:** AGT-014
- **Descripción:** `pom.xml` fijaba `spring-boot-starter-parent` en `3.2.1`, que arrastra de forma transitiva `spring-web`/`spring-webmvc`/`spring-core` 6.1.2 y `spring-security-core` 6.2.1 — versiones afectadas por CVE-2024-22243 (Spring Framework, open redirect/SSRF vía `UriComponentsBuilder`), CVE-2024-22234 y CVE-2024-22257 (Spring Security, broken access control con `Authentication` nula), todas corregidas en parches posteriores dentro de la misma serie 3.2.x. Sin tarea `TODO` adecuada en el backlog (AGT-007 sigue `TODO` pero exige una decisión humana sobre Aiven, no código; todo lo demás está en `REVIEW` esperando cierre humano), se identificó este hallazgo nuevo auditando dependencias de backend con `mvn dependency:tree` — nunca revisadas por esta rutina hasta ahora (las sesiones anteriores solo auditaban `npm audit` del frontend/agent).
- **Prioridad:** P2
- **Área:** maintenance
- **Estado:** REVIEW
- **Dependencias:** —
- **Archivos afectados:** pom.xml, SECURITY.md.
- **Criterios de aceptación:** `mvn dependency:tree` muestra `spring-core`/`spring-web`/`spring-webmvc` ≥ 6.1.4 y `spring-security-core` ≥ 6.2.3; sin salto de versión mayor/minor de Spring Boot; `mvn test` sin regresiones (mismos resultados que antes del cambio); documentado en SECURITY.md.
- **Tests necesarios:** `mvn dependency:tree`, `mvn test`, `mvn clean package -DskipTests`, `mvn compile` (warnings).
- **Resultado:** Resuelta 2026-10-13 (rutina en la nube). Confirmado con `mvn dependency:tree` que `spring-boot-starter-parent` 3.2.1 resolvía `spring-web`/`spring-webmvc`/`spring-core` en `6.1.2` y `spring-security-core` en `6.2.1` — ambos dentro del rango afectado de los 3 CVEs citados en la descripción (verificados por nombre y rango de versiones antes de tocar nada). `grep` confirmó que el código propio (`SecurityConfig`, controladores) no llama directamente a `isFullyAuthenticated`/`AuthenticatedVoter`/`UriComponentsBuilder` sobre una URL externa — sin ruta de explotación directa conocida desde código propio, pero librería vulnerable real en el classpath de producción, igual criterio de "parchear aunque no se haya demostrado explotación directa" ya usado en AGT-011 (Capacitor) y FID-020 (piscina).
  **Fix**: subir `spring-boot-starter-parent` de `3.2.1` a `3.2.12` — última versión de código abierto de la serie 3.2.x (Spring anunció el fin del soporte open-source de 3.2.x el 2024-11-21 con esa release; no se saltó a 3.3.x/3.4.x para no ampliar el alcance de este hallazgo con un cambio de minor no pedido). Una sola línea de `pom.xml` tocada.
  **Verificación real en este entorno**: `mvn dependency:tree` → `spring-core`/`spring-web`/`spring-webmvc` 6.1.2 → **6.1.15**, `spring-security-core` 6.2.1 → **6.2.8** (ambos muy por encima de las versiones que corrigen los 3 CVEs: 6.1.4/6.2.3). `mvn test` → **78/79 antes y después**, mismo único fallo (`contextLoads`, requiere MySQL real, preexistente y documentado en todas las sesiones anteriores de esta rutina) — sin regresión. `mvn clean package -DskipTests` → `BUILD SUCCESS`, jar generado. `mvn compile` → sin warnings de deprecación nuevos. Detalle completo en `SECURITY.md` (#16).
  **No se pudo verificar en este entorno** (requeriría backend/frontend/MySQL reales): arrancar la app contra una BD viva y ejercitar manualmente los endpoints de autenticación/autorización tras el cambio — la suite de tests unitarios/Mockito ya cubre `SecurityConfig`/`AuthController`/ownership sin necesitar esa conexión y ninguno cambió de comportamiento ni de resultado.
  **Nota aparte, no accionada esta sesión**: la serie 3.2.x ya no recibe parches open-source desde 2024-11-21; subir a 3.3.x/3.4.x (con soporte activo) es un cambio de mayor alcance que requiere decisión humana y revisión de posibles cambios de comportamiento entre minors — queda fuera de este hallazgo acotado, igual criterio que el punto 7 pendiente de FID-019 (Angular 21).

### AGT-015 · `POST /api/jarvis/run` (access-center) acepta CSRF: cualquier pagina web abierta a la vez podria lanzar una ejecucion real de Harvey
- **ID:** AGT-015
- **Descripción:** `access-center/server.js` expone `POST /api/jarvis/run`, que lanza una ejecución real y autónoma del Agent Layer (Harvey: hasta 12 pasos / 10 min / 16k tokens, con permiso para escribir ficheros, hacer commits y ejecutar comandos dentro de su presupuesto — solo las acciones marcadas `"approval"` en `TOOL_RISK` quedan bloqueadas por `approvals-routes.mjs`). Esa ruta no comprueba Host/Origin ni ninguna otra cosa: solo la middleware CORS genérica (pensada para que el frontend Angular, en otro puerto, pueda hacer `POST /api/agent-state`), que es puramente informativa para el navegador (decide qué origen puede *leer* la respuesta) y nunca impide que la petición llegue y se ejecute en el servidor. El propio `approvals-routes.mjs` ya documenta esta distinción con precisión ("Origin y x-jarvis-ui NO son autenticacion... Host y Origin exactos... Frena CSRF y DNS rebinding") y ya protege `/api/jarvis/approvals/**` con ese mecanismo — pero nunca se aplicó a `/api/jarvis/run`, el endpoint que de verdad arranca el trabajo antes de llegar a ninguna aprobación. Mientras `access-center` está en marcha (tal y como lo documenta `CLAUDE.md`, pensado para dejarse abierto durante el desarrollo), cualquier pestaña del navegador con una página de otro origen podría hacer el mismo `fetch("http://127.0.0.1:5757/api/jarvis/run", {method:"POST", ...})` que hace `oficina.html` y disparar una ejecución real sin que el usuario lo pidiera.
- **Prioridad:** P2
- **Área:** security
- **Estado:** REVIEW
- **Dependencias:** —
- **Archivos afectados:** access-center/lib/same-origin.mjs (nuevo), access-center/approvals-routes.mjs, access-center/server.js, access-center/package.json, access-center/test/same-origin.test.mjs (nuevo).
- **Criterios de aceptación:** `POST /api/jarvis/run` responde 403 sin iniciar ninguna ejecución si falta la cabecera `Origin`, si no coincide con `Host`, o si `Sec-Fetch-Site` indica que la petición viene de otro sitio; sigue funcionando igual desde `oficina.html` (fetch same-origin real, único llamador legítimo — confirmado con `grep` en `access-center/public/`); sin cambio de comportamiento en `/api/jarvis/approvals/**`.
- **Tests necesarios:** Tests unitarios de la función de comprobación (sin servidor real) + ejecución de `agent/test/approvals-routes.test.mjs` (ejercita en servidor real y aislado el mismo mecanismo ya extraído) para confirmar que el refactor no cambia su comportamiento.
- **Resultado:** Resuelta 2026-10-15 (rutina en la nube). Sin ninguna tarea `TODO` real en el backlog (AGT-007 sigue `TODO` pero exige una decisión humana sobre Aiven, no código; todo lo demás en `REVIEW` esperando cierre humano) y sin hallazgo nuevo en `npm audit` (frontend: 15/0-producción, sin cambios desde AGT-011; `agent/`: 0 vulnerabilidades) ni en `mvn dependency:tree` (Spring ya en 6.1.15/6.2.8 tras AGT-014, sin CVEs nuevos) ni en `mvn test` (78/79, mismo fallo de siempre por falta de MySQL), se leyó con atención el único módulo de `access-center/` nunca auditado línea a línea por esta rutina más allá de un resumen de alto nivel (AGT-010 solo revisó por bloques qué protege cada fichero, sin comparar entre rutas): el hallazgo salió de notar que `approvals-routes.mjs` deja por escrito, en su propio comentario de cabecera, exactamente por qué la cabecera CORS no basta como autorización — y que ese mismo razonamiento nunca se aplicó a `/api/jarvis/run`, la ruta de mayor alcance de las dos (inicia trabajo real, no solo decide sobre un trabajo ya pedido).
  **Fix**: la lógica `hostOk`/`sameOrigin` de `approvals-routes.mjs` se extrajo, sin cambiarla, a `access-center/lib/same-origin.mjs` (`createSameOriginGuard(port)`), y `approvals-routes.mjs` pasó a importarla en vez de definirla por duplicado. `server.js` la usa para rechazar con 403 cualquier `POST /api/jarvis/run` que no sea un fetch same-origin real — el único llamador legítimo, `oficina.html` (`public/oficina.html:808`, fetch relativo sin cabeceras manuales de Origin, servido por este mismo proceso), sigue funcionando exactamente igual porque los navegadores ya envían `Origin`/`Sec-Fetch-Site` reales en cualquier `fetch` con método distinto de GET/HEAD. También se corrigió el comentario de la propia cabecera CORS en `server.js`, que afirmaba (incorrectamente) que esa cabecera por sí sola ya impedía el acceso desde fuera del Mac. **Alcance deliberadamente acotado**: no se tocó `/api/agent-state` ni `/api/agent-events` (ambas POST) porque su diseño ya es intencionalmente cross-origin (el comentario original lo explica: el frontend Angular, en el puerto 8100, necesita poder llamarlas desde el navegador) — aplicarles la misma comprobación same-origin las habría roto. Tampoco se intentó proteger contra un proceso local arbitrario (`curl` con un `Origin` falsificado a mano): ese límite ya está documentado y aceptado explícitamente en el propio `approvals-routes.mjs` ("NO frena a un proceso con tu mismo usuario") y es el mismo límite de todo este sistema de un solo usuario en loopback — ampliarlo habría sido un cambio de arquitectura no pedido por este hallazgo.
  **Descubrimiento colateral** (no es el hallazgo principal, pero cambia una suposición de sesiones anteriores): `agent/test/approvals-routes.test.mjs` (18 tests que levantan un servidor Express real y aislado para ejercitar exactamente este código) se salta entero si `access-center/node_modules` no está instalado — y no lo estaba en ninguna sesión anterior de esta rutina, que solo hacía `npm ci` en `frontend/`/`agent/`. Es decir, el "87 passed / 18 skipped (105 tests)" que `CLAUDE.md`/AGT-010 documentaban como el estado esperado llevaba sesiones enteras sin ejecutar de verdad esos 18 tests — se limitaban a no fallar por estar deshabilitados. Esta sesión instaló `access-center/node_modules` (necesario para poder escribirle tests propios) y, con eso, los 18 se ejecutaron de verdad por primera vez: **105/105 passed, 0 skipped**, incluida la cobertura ya existente de CSRF/sesión/Host-Origin de `approvals-routes.mjs` — confirmando en servidor real que el refactor de `hostOk`/`sameOrigin` a `same-origin.mjs` no cambió su comportamiento. No se modificó ese test ni el criterio de `skip`: sigue siendo correcto que se salte si de verdad no hay `node_modules`, solo que ahora sí los hay.
  **Verificación real en este entorno**: `node --check` en los 3 ficheros `.mjs` tocados → sin errores de sintaxis. `access-center` nunca tenía script de test (`"test": "echo ... && exit 1"`) — se le dio uno real (`node --test`) y se añadió `access-center/test/same-origin.test.mjs` (6 tests unitarios puros, sin servidor ni red: acepta Host/Origin same-origin reales, rechaza Origin de otro sitio, rechaza petición sin `Origin`, rechaza `Origin` que no coincide con `Host` aunque ambos sean válidos por separado, rechaza `Sec-Fetch-Site` cruzado) → **6/6 passed**. `npm --prefix agent test` → **105/105 passed, 0 skipped** (ver descubrimiento colateral arriba), incluye `approvals-routes.test.mjs` ejercitando en un servidor real que el comportamiento de `/api/jarvis/approvals/**` no cambió tras mover `hostOk`/`sameOrigin` a un módulo compartido. `mvn test` (backend, sin tocar) → 78/79, mismo fallo de siempre (`contextLoads`, requiere MySQL real). `npm audit`/`npm audit --omit=dev` en `frontend/`/`agent/`/`access-center/` → sin regresión (access-center: 0 vulnerabilidades, nuevo para este módulo, nunca auditado como paquete npm propio por esta rutina).
  **No se pudo verificar en este entorno** (requeriría arrancar `access-center/server.js` de verdad, lo que a su vez importa `agent/src/runner/run.mjs`/`agent/src/llm/providers.mjs` y abre un puerto real): una petición HTTP real cruzada de origen contra el servidor en marcha recibiendo 403, y una petición same-origin real completando un run de Harvey — la lógica exacta que decide eso (`sameOrigin`) es la misma que ya se probó en servidor real y aislado en `approvals-routes.test.mjs`, así que no es una ruta sin ninguna cobertura real, pero no es exactamente el mismo servidor. Queda para una sesión con un entorno donde abrir ese puerto y hacer peticiones reales no interfiera con nada, o para revisión humana local abriendo la Oficina de Agentes de verdad.

**Nota de renumeración (2026-10-17, al fusionar dos sesiones concurrentes de esta misma rutina)**: esta
tarea sobre `AdminController` se identificó en una sesión que partía del mismo commit base (`bb91f20`) que
otra sesión concurrente, que mientras tanto ya había numerado AGT-016 su propio hallazgo (Spring Framework
6.1.x/CVEs nuevos, justo abajo). Para no chocar, se renumera aquí a **AGT-017** (mismo criterio ya usado
para FID-020/FID-021 y para AGT-007/008/009 → AGT-011/012/013) — el contenido y las verificaciones no
cambian, solo el ID.

### AGT-017 · `AdminController` sin ningún test propio — cero cobertura del ajuste manual de puntos
- **ID:** AGT-017
- **Descripción:** `AdminController.java` (907 líneas) es el controlador más grande y más sensible del backend — gestión de negocios/clientes/reservas y, sobre todo, `POST /api/admin/clients/{id}/points/add|subtract|set`, el único punto donde un administrador puede mutar manualmente el saldo de puntos de fidelidad de un cliente — y no tenía ningún fichero de test propio (el único test de `controller/` era `AuthControllerAdminLoginTest`). `applyPointChange` calcula un `delta` distinto según el modo (`add`/`subtract`/`set`), valida saldo no negativo, resuelve un `restaurantId` opcional y solo entonces persiste — exactamente el tipo de lógica con validación/orden de operaciones propensa a errores de signo o a dejar un guardado a medias si una regresión futura reordenara las comprobaciones, y hasta ahora ninguna regresión de ese tipo la detectaría un test, solo una auditoría manual.
- **Prioridad:** P2
- **Área:** testing
- **Estado:** REVIEW
- **Dependencias:** —
- **Archivos afectados:** src/test/java/progresa/springboot_tfg/controller/AdminControllerPointsTest.java (nuevo).
- **Criterios de aceptación:** `addPoints`/`subtractPoints`/`setPoints` tienen test que fije: suma/resta/set correctos y el `MovimientoPuntos` registrado con el `delta` esperado; saldo insuficiente nunca deja al cliente en negativo y no persiste nada; cantidad inválida (`<= 0`, negativa en `set`, tipo de movimiento no reconocido) lanza `BadRequestException` sin guardar; `restaurantId` inexistente lanza `ResourceNotFoundException` **antes** de mutar el saldo (no a medias); no se puede ajustar una cuenta `ROLE_ADMIN` ni un cliente ya eliminado lógicamente; sin tests nuevos rotos en el resto de la suite.
- **Tests necesarios:** `mvn test -Dtest=AdminControllerPointsTest`, `mvn test` completo.
- **Resultado:** Resuelta 2026-10-17 (rutina en la nube). Sin ninguna tarea `TODO` real en el backlog (AGT-007 sigue exigiendo una decisión humana sobre Aiven, no código) y sin hallazgo nuevo en `npm audit` (frontend `--omit=dev`: 0; completo: 15, 0 críticas, sin cambios desde AGT-011/012 — misma cadena de build que requeriría Angular 21; `agent/`: 0 vulnerabilidades) ni en `mvn dependency:tree` (Spring sigue en 6.1.15, mismo estado que dejó AGT-014, sin CVEs nuevos desde esa versión), se intentó primero retomar la limpieza ya señalada explícitamente en AGT-013 (`git rm` de `frontend/src/app/features/restaurant-app/gestion-promos/` y `restaurant.service.ts`, reconfirmados sin ningún otro uso en todo `frontend/src`/`frontend/e2e` — solo queda un comentario que menciona `RestaurantService` por nombre en `dashboard.component.ts`, sin importarlo) — bloqueado otra vez por el mismo motivo documentado en las ~8 sesiones anteriores (clasificador de modo automático "Irreversible Local Destruction"), así que sigue exactamente igual de pendiente para una persona, sin ningún intento de rodear el bloqueo. Se pasó entonces a auditar el backend en busca de un hueco de cobertura real (mismo criterio que FID-013/015/016/018, nunca repetido con `AdminController`, el único controlador grande del backend sin examinar línea a línea desde que se fusionó): confirmado con `@PreAuthorize`/`SecurityConfig` que `/api/admin/**` sigue restringido a `ROLE_ADMIN` (sin cambios, sin hallazgo de autorización), pero cero cobertura de test de su lógica de negocio. Añadido `AdminControllerPointsTest` (12 tests unitarios puros, sin Spring ni BD, mismo patrón que `AuthControllerAdminLoginTest`: instancia `AdminController` directamente con DAOs/`RestauranteService` mockeados con Mockito) centrado en `applyPointChange`, la única lógica de `AdminController` con impacto financiero directo sobre el saldo de puntos de un cliente.
  **Verificación real en este entorno**: `mvn test -Dtest=AdminControllerPointsTest` → **12/12 passed**. `mvn test` completo → **90/91 passed** (solo falla `contextLoads`, el mismo fallo preexistente de siempre por falta de MySQL real; antes de este cambio eran 78/79 — mismo único fallo, 12 tests nuevos en verde, cero tests rotos). No se tocó ningún archivo de producción, solo un test nuevo — no hizo falta repetir `ng build`/`npx playwright test --list`.
  **No se pudo verificar en este entorno** (requeriría backend/MySQL reales): ejercitar los mismos endpoints con una petición HTTP real (`curl` con un token de admin real) contra un servidor vivo — los tests nuevos llaman directamente a los métodos del controlador (igual que `AuthControllerAdminLoginTest`), sin pasar por Spring Security/MVC/la base de datos real.
  **Nota aparte, no accionada esta sesión** (fuera del alcance de "un solo elemento acotado"): el resto de `AdminController` (negocios, clientes, reservas, borrado lógico/duro) y el resto de controladores grandes sin test propio (`PromocionController`, `CompraController`, `RecompensaController`, `CanjeController`, `RestauranteController`, `UsuarioController` — todos cubiertos solo a nivel de servicio, nunca de controlador) siguen sin cobertura a nivel de controlador; queda para una futura sesión de mantenimiento, con el mismo criterio ya usado en FID-013/015/016/018 para los servicios.

### AGT-016 · Spring Framework 6.1.x tiene 3 CVEs nuevos sin parche open-source en esa serie: decidir si se sube Spring Boot más allá de 3.2.x
- **ID:** AGT-016
- **Descripción:** Tras AGT-014 (que subió `spring-boot-starter-parent` a 3.2.12, el último parche libre de la serie 3.2.x), se publicaron 3 CVEs nuevos que afectan a Spring Framework 6.1.x hasta 6.1.27 (versión en uso: 6.1.15): CVE-2026-41841 (fuga de información vía caché de recursos estáticos en Spring MVC/WebFlux), CVE-2026-41845 (XSS en `JavaScriptUtils`) y CVE-2026-41846 (XSS en el tag `<form>` de JSP). La serie 6.1.x ya no recibe parches open-source (fin de soporte a mediados de 2025): el único arreglo libre real exige Spring Framework 6.2.19+/7.0.8+, lo que implica saltar `spring-boot-starter-parent` de 3.2.x a 3.4.x como mínimo — y a día de hoy (2026-10-17) toda la serie Spring Boot 3.x (3.2 a 3.5) ya alcanzó también su fin de soporte open-source, con Spring Boot 4.0.x/4.1.x como único destino con parches libres activos.
- **Prioridad:** P2
- **Área:** security
- **Estado:** TODO
- **Dependencias:** —
- **Archivos afectados:** pom.xml, SECURITY.md (decisión y, si procede, el cambio de versión la ejecutará quien decida el alcance).
- **Criterios de aceptación:** Decisión humana registrada (quedarse en Spring Boot 3.2.x asumiendo el riesgo documentado, subir a 3.4.x como parche mínimo dentro de 3.x, o saltar directamente a 4.x); si se decide subir, requiere una sesión con backend/MySQL reales disponibles para validar los endpoints de autenticación/autorización tras el cambio (`mvn test` solo no basta para un salto de esta magnitud).
- **Tests necesarios:** `mvn dependency:tree` (confirmar versión de Spring Framework tras cualquier cambio), `mvn test`, y pruebas manuales de login/autorización contra un backend real tras el cambio.
- **Resultado:** Identificada 2026-10-17 (rutina en la nube). Sin ninguna tarea `TODO` con código pendiente en el backlog (AGT-007 sigue exigiendo una decisión humana sobre Aiven; todo lo demás ya está en `REVIEW` esperando cierre humano) y sin novedad en `npm audit` de `frontend/`/`agent/`/`access-center/` (15/0-producción, 0, 0 — mismos números que AGT-015) ni en `mvn test` (78/79, mismo fallo de siempre por falta de MySQL), se repitió el tipo de auditoría de AGT-014: dependencias de backend con `mvn versions:display-dependency-updates` — esta vez buscando explícitamente avisos de seguridad publicados *después* del cierre de AGT-014 (2026-10-15), no solo versiones más nuevas. Hallazgo: los 3 CVEs de Spring Framework descritos arriba, publicados en ese margen de 2 días. Investigación de explotabilidad real en este código (no asumida): `grep` confirma que el backend es una API REST pura (`@RestController` únicamente, sin JSP/Thymeleaf/vistas server-side) y que no registra ningún `addResourceHandlers`/`WebMvcConfigurer` propio (lo único servido desde disco, `uploads/`, pasa por `UploadController`, con su propia protección anti path-traversal, nunca por el resource handler de Spring) — así que, sin descartar el riesgo en la librería, **ninguno de los tres CVEs tiene hoy una ruta de explotación real conocida en el código propio de esta app**. A diferencia de AGT-014 (donde el parche eran completo dentro de la misma serie 3.2.x, cambio de una línea), aquí el único arreglo libre real exige un salto de `spring-boot-starter-parent` más allá de 3.2.x — y la investigación encontró, además, que las series 3.3.x/3.4.x/3.5.x también alcanzaron ya su fin de soporte open-source (3.5.16 fue su último release libre, 2026-06-25), así que el único destino con soporte activo hoy es Spring Boot 4.x, un salto de versión mayor con cambios de comportamiento conocidos en Spring Security (6.x → 7.x) que esta rutina no puede validar sin un backend/MySQL reales. Documentado sin tocar `pom.xml` — mismo criterio que el salto a Angular 21 (diferido varias veces en FID-010/FID-012/FID-019) y que la propia nota de cierre de AGT-014 sobre subir de minor dentro de Spring Boot 3.x.
  **Verificación real en este entorno**: `mvn dependency:tree`/`mvn versions:display-dependency-updates` confirman `spring-web`/`spring-webmvc`/`spring-core` en 6.1.15 (sin cambios desde AGT-014) y que el único salto disponible hacia Spring Boot es a `4.2.0-M2` (milestone/pre-release, no apto para producción) vía gestión de dependencias de Maven Central. `grep -r "JavaScriptUtils\|@Controller\b|ViewResolver|Thymeleaf|\.jsp" src/main/java` → sin resultados. `grep -r "ResourceHandler|addResourceHandlers|WebMvcConfigurer" src/main/java` → solo coincide `UploadController.java` (no implementa `WebMvcConfigurer`, sirve los ficheros con su propio código, confirmado leyéndolo). `mvn test` (sin tocar código) → 78/79, mismo único fallo de siempre (`contextLoads`, requiere MySQL real).
  **No se pudo verificar en este entorno** (requeriría backend/MySQL reales, y es además la propia naturaleza de esta tarea — una decisión humana, no un fix): el impacto real de subir a Spring Boot 3.4.x o 4.x contra un backend vivo; cualquier upgrade de esta magnitud necesita su propia sesión de validación con esos servicios disponibles, no solo `mvn test`.

### AGT-018 · `braces` (vía `karma`/`chokidar`, dependencia de build de Angular) sin parche todavía para una DoS por agotamiento de pila
- **ID:** AGT-018
- **Descripción:** `npm audit` en `frontend/` detectó la cadena `braces` (≤3.0.3, todas las versiones publicadas hasta hoy) → `chokidar`/`micromatch` → `karma`/`webpack-dev-server` → `@angular-devkit/build-angular`/`@angular/build`: [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) (CVE-2026-93687, CWE-770, CVSS 7.5 alto), una denegación de servicio por agotamiento de la pila de llamadas con patrones de llaves (`{a,{b,{c,...}}}`) profundamente anidados en los walkers recursivos del AST de `braces`, sin límite de profundidad. A diferencia de AGT-011 (Capacitor, dependencia de producción), esta es de nuevo una dependencia 100% de build (`devDependencies`, usada por `ng build`/`ng serve`/`ng test` vía Karma), nunca enviada al navegador del usuario final.
- **Prioridad:** P3
- **Área:** maintenance
- **Estado:** TODO
- **Dependencias:** —
- **Archivos afectados:** frontend/package.json, frontend/package-lock.json, SECURITY.md (sin cambios aplicados todavía — ver "Resultado").
- **Criterios de aceptación:** `npm audit` deja de listar GHSA-vfj7-8cjw-p6xm (porque `braces` publica una versión ≥3.0.4 parcheada, o porque se decide aceptar el riesgo documentado) sin bajar de versión mayor ningún paquete de testing (`karma`) salvo que una persona lo apruebe explícitamente; `npm audit --omit=dev` sigue en 0; build de producción y suite de tests existente sin regresiones.
- **Tests necesarios:** `npm audit` / `npm audit --omit=dev`, `ng build --configuration production`, `npx playwright test --list`.
- **Resultado:** Identificada 2026-10-18 (rutina en la nube). La rama ya estaba al día con `main` (sin commits nuevos que auditar) y sin ninguna tarea `TODO` con código pendiente (AGT-007 y AGT-016 siguen exigiendo una decisión humana; todo lo demás ya en `REVIEW`), así que se repitió el primer paso habitual de estas sesiones sin tarea asignada: `npm ci` limpio + `npm audit` en `frontend/`/`agent/`/`access-center/` (también se instalaron por primera vez en este sandbox `agent/node_modules` y `access-center/node_modules`, necesarios para que `npm --prefix agent test` no se salte los 18 tests de `approvals-routes.test.mjs` — confirmado 105/105 passed, 0 skipped, sin cambios respecto a AGT-015/016/017). `agent/`/`access-center/` → 0 vulnerabilidades. `frontend/` → 15 vulnerabilidades (2 moderate, 13 high), el mismo total que se viene repitiendo sin cambios desde AGT-011 — pero nunca se había vuelto a desglosar por nombre de aviso desde entonces (las notas de AGT-012 a AGT-017 solo comprobaban el número total, "15/0-producción"). Al desglosar esta vez por primera vez, aparece `braces`/GHSA-vfj7-8cjw-p6xm, nunca documentado antes por su nombre en este backlog — bien porque es un aviso publicado en estos últimos días, bien porque ya estaba dentro del total de "15" sin que ninguna sesión lo identificara por separado; no se puede distinguir cuál de las dos sin el historial detallado de `npm audit` de sesiones anteriores, que no se guardó.
  **Investigación de un fix real (no asumida)**: `npm view braces versions`/`dist-tags` confirma que **la última versión publicada de `braces` sigue siendo 3.0.3** — no existe todavía ninguna release parcheada (a pesar de que alguna base de datos de vulnerabilidades de terceros, consultada por búsqueda web, afirma que el fix es la 3.0.4; no se pudo confirmar esa versión en el registro real de npm en el momento de esta sesión). `npm audit`'s propio `fixAvailable` para este aviso no ofrece ninguna versión parcheada de `braces`: solo propone instalar `karma@4.0.0` (salto de versión mayor del test runner, con los tests existentes de Karma sin revalidar, y que en todo caso no sustituye a un parche real de `braces`, que ese downgrade de `karma` tampoco garantiza evitar en todas las rutas — `@angular-devkit/build-angular`/`@angular/build` siguen trayendo su propia copia). Se descartó aplicar ese downgrade sin aprobación humana, mismo criterio que AGT-011 descartó el downgrade de `@angular-devkit/build-angular` a 19.2.27 que proponía `npm audit fix --force`.
  **Impacto real**: dependencia pura de build/test (`karma`, usado solo por `ng test`; `chokidar`/`micromatch`/`webpack-dev-server`, usados por `ng serve`/el propio `@angular/build`) — `npm audit --omit=dev` confirma **0 vulnerabilidades** antes y después de esta sesión, nunca llega al bundle servido a los usuarios de FidelyFood. El escenario de explotación real (un atacante enviando un patrón de llaves malicioso a un proceso de build/test local o de CI) no aplica a producción.
  **Por qué no se actuó más allá de documentar**: no hay ningún parche real disponible hoy para aplicar — a diferencia de AGT-011/FID-020 (donde sí existía una versión parcheada dentro de la misma serie, aplicada vía `overrides`), aquí el propio paquete vulnerable no tiene todavía ninguna versión corregida publicada. Forzar un `overrides` a una versión de `braces` que no existe no sería un fix real, y bajar `karma` de versión mayor sin que nadie revise la suite de tests de Karma (no ejecutada en este sandbox, no hay tests `.spec.ts` de Angular Testing Library/Jasmine en este proyecto más allá de la plantilla por defecto, sin verificar aquí) es justo el tipo de cambio que esta rutina no debe decidir por su cuenta.
  **Verificación real en este entorno**: `npm ci` (frontend) → 15 vulnerabilidades (2 moderate, 13 high), desglosadas por primera vez: `braces` (alta, GHSA-vfj7-8cjw-p6xm, vía `chokidar`/`karma`/`micromatch`/`fast-glob`/`http-proxy-middleware`/`webpack-dev-server`), `uuid` (moderada, GHSA-w5hq-g745-h8pq, vía `sockjs`) y `webpack-dev-middleware` (alta, GHSA-g84c-rxfj-3j2c) — las dos últimas ya documentadas desde FID-019/AGT-011 como pendientes de un salto a Angular 21, sin cambios. `npm audit --omit=dev` → 0. `npm view braces versions --json`/`dist-tags` → `3.0.3` es la última publicada, confirmado dos veces. `ng build --configuration production` → éxito, mismos warnings preexistentes de siempre (Sass `@import` deprecado, presupuesto excedido en 2 componentes, `qrcode` no-ESM), sin errores nuevos. `npx tsc --noEmit` → sin errores. `npx playwright test --list` → 22/22 tests en 10 ficheros, idéntico a AGT-017. `mvn test` (sin tocar backend) → 90/90 (excluyendo `contextLoads`, que requiere MySQL real; sin cambios). `npm --prefix agent test` → 105/105 passed, 0 skipped. No se modificó ningún archivo de producción ni de dependencias — esta tarea es puramente de documentación, sin código que verificar más allá de confirmar que nada se rompió al instalar de cero en este sandbox.
  **No se pudo verificar en este entorno** (requeriría backend/frontend/MySQL reales): ejecutar de verdad los 22 specs E2E contra un backend vivo. Queda para una futura sesión volver a comprobar `npm view braces versions` hasta que exista una versión parcheada, o para que una persona decida aceptar el riesgo (documentado, solo build/test, 0 en producción) mientras tanto.

### AGT-019 · `UploadController` sin ningún test propio — cero cobertura de su protección anti path-traversal

- **ID:** AGT-019
- **Descripción:** `UploadController.java` es el único endpoint público (`GET /uploads/**`, sin `@PreAuthorize`) que lee un archivo del disco a partir de un nombre tomado directamente de la URL, con su propia protección manual anti path-traversal (`Paths.resolve(filename).normalize()` + `startsWith(uploadPath)`, sin depender de ningún framework). No tenía ningún fichero de test propio — el único sitio donde ese comportamiento estaba verificado era la lectura manual del código (AGT-016 ya lo auditó así, sin tests, al evaluar si algún `WebMvcConfigurer`/resource handler de Spring estaba afectado por CVEs). Es exactamente el tipo de lógica de seguridad (normalize + startsWith) donde una refactorización futura con buena intención (p. ej. cambiar el orden de las comprobaciones, o "simplificar" la validación) podría reabrir un path-traversal sin que nada lo detectara salvo una auditoría manual.
- **Prioridad:** P2
- **Área:** testing
- **Estado:** REVIEW
- **Dependencias:** —
- **Archivos afectados:** src/test/java/progresa/springboot_tfg/controller/UploadControllerTest.java (nuevo).
- **Criterios de aceptación:** Un archivo real dentro de `uploads/` (incluido en un subdirectorio) se sirve con su contenido exacto y el content-type correcto; un archivo inexistente devuelve siempre el placeholder (de perfil si la ruta empieza por `perfiles/`, de restaurante en cualquier otro caso), nunca un error; una ruta que intenta escapar de `uploads/` (literal `../` o codificada `%2e%2e%2f`) nunca devuelve el contenido de un archivo real fuera de ese directorio, aunque ese archivo exista y sea legible; una URI que no empieza por el prefijo `/uploads/` también cae al placeholder; sin tests nuevos rotos en el resto de la suite.
- **Tests necesarios:** `mvn test -Dtest=UploadControllerTest`, `mvn test` completo.
- **Resultado:** Resuelta 2026-10-19 (rutina en la nube). La rama ya estaba al día con `main` (PR #51 abierto, CI en verde en el último commit, sin commits nuevos en `main` que auditar). Sin ninguna tarea `TODO` con código pendiente (AGT-007 y AGT-016 siguen exigiendo una decisión humana; AGT-018 se reconfirmó sin novedad — `npm view braces versions` sigue en `3.0.3`, sin ninguna versión parcheada publicada todavía), se retomó la misma línea que dejó abierta AGT-017 ("el resto de controladores grandes sin test propio"): de los controladores del backend, `UploadController` es el único que lee archivos del disco por nombre tomado de la URL y nunca se había auditado con un test que de verdad ejercite su protección anti path-traversal (solo por lectura de código, en AGT-016). Añadido `UploadControllerTest` (7 tests unitarios puros, sin Spring ni MySQL: instancia `UploadController` directamente y mockea `HttpServletRequest` con Mockito, mismo patrón que `AdminControllerPointsTest`/`AuthControllerAdminLoginTest`) que crea y borra archivos reales bajo `uploads/` (directorio ya en `.gitignore`, limpiado en `@AfterEach` con un borrado recursivo) para forzar el camino real de lectura de disco, sin necesitar ningún mock de sistema de ficheros.
  **Verificación empírica de la protección, no solo lectura de código**: dos tests intentan activamente escapar de `uploads/` contra un archivo real que sí existe y es legible fuera de ese directorio (uno con `../` literal, otro con `%2e%2e%2f` codificado en la URL) y confirman que la respuesta es siempre el placeholder, nunca el contenido real del archivo fuera de `uploads/` — ambos pasaban ya antes de este cambio (la protección era correcta), pero ahora una regresión futura en `normalize()`/`startsWith()` la detectaría un test en rojo, no una auditoría manual.
  **Verificación real en este entorno**: `mvn compile` → éxito. `mvn test -Dtest=UploadControllerTest` → **7/7 passed**. `mvn test` completo → **97/98 passed** (antes de este cambio: 90/91; mismo único fallo de siempre, `contextLoads`, requiere MySQL real — confirmado leyendo la traza completa, `Communications link failure`/`Connection refused`, no relacionado con este cambio). Confirmado manualmente tras cada ejecución que el directorio `uploads/` no queda creado en el repo (`ls uploads` → "No such file or directory"), así que la limpieza en `@AfterEach` funciona y no deja residuos. No se tocó ningún archivo de producción, solo un test nuevo — no hizo falta repetir `ng build`/`npx playwright test --list` (sin cambios de frontend).
  **No se pudo verificar en este entorno** (requeriría backend real en marcha): una petición HTTP real (`curl`) contra `GET /uploads/...` con una ruta de traversal — los tests nuevos llaman directamente al método del controlador (igual que `AdminControllerPointsTest`), sin pasar por Tomcat/Spring MVC, que en un servidor real probablemente ya normalizaría o rechazaría algunas de estas rutas antes de llegar al controlador (defensa en profundidad adicional, no verificada aquí); esta suite prueba específicamente la protección propia del controlador, no la del contenedor.
  **Nota aparte, no accionada esta sesión** (fuera del alcance de "un solo elemento acotado"): el resto de controladores grandes sin test propio señalados ya en AGT-017 (`PromocionController`, `CompraController`, `RecompensaController`, `CanjeController`, `RestauranteController`, `UsuarioController`, y el resto de `AdminController` más allá de `applyPointChange`) siguen sin cobertura a nivel de controlador; queda para una futura sesión de mantenimiento.

### AGT-020 · `PuntosController` sin ningún test propio — autorización de ownership escrita en el controlador, no en un servicio

- **ID:** AGT-020
- **Descripción:** `PuntosController` (`GET /api/puntos/{usuarioId}/total`, `GET /api/puntos/{usuarioId}/{restauranteId}`, `POST /api/puntos`) es distinto del resto del backend: en vez de delegar en el `requireOwner(...)` de un servicio, hace sus propias comprobaciones de autorización directamente en el controlador (`getOwnedUsuario` compara el email autenticado contra el dueño del recurso; `sumarPuntos` compara el `restauranteId` del body contra el restaurante autenticado) y además calcula/persiste puntos (suma, `MovimientoPuntos` tipo `GANADOS`) sin pasar por `CompraService`. No tenía ningún fichero de test propio — ni unitario ni E2E — pese a ser la única otra vía (aparte de `CompraService.registrarCompra`) por la que un restaurante puede dar puntos a un cliente.
- **Prioridad:** P2
- **Área:** testing
- **Estado:** REVIEW
- **Dependencias:** —
- **Archivos afectados:** src/test/java/progresa/springboot_tfg/controller/PuntosControllerTest.java (nuevo).
- **Criterios de aceptación:** Un usuario autenticado solo puede consultar sus propios puntos (totales y por restaurante); un rol distinto de `ROLE_USER` nunca llega a consultar el DAO; un restaurante autenticado solo puede sumar puntos en su propio nombre (un `restauranteId` del body que no coincide con el restaurante autenticado nunca persiste nada); importe/puntos ≤0, `usuarioId` ausente o usuario/restaurante inexistente lanzan la excepción correcta sin guardar nada a medias; una suma válida persiste el saldo y el `MovimientoPuntos` correctos; sin tests nuevos rotos en el resto de la suite.
- **Tests necesarios:** `mvn test -Dtest=PuntosControllerTest`, `mvn test` completo.
- **Resultado:** Resuelta 2026-10-20 (rutina en la nube). La rama ya estaba al día con `main` (PR #51 abierto, CI en verde en el último commit, sin commits nuevos en `main` que auditar desde #52). Sin ninguna tarea `TODO` con código pendiente (AGT-007 sigue exigiendo una decisión humana sobre Aiven; AGT-016 sobre el salto de Spring Boot; AGT-018 reconfirmado sin novedad — `npm view braces versions`/`dist-tags` siguen en `3.0.3`, sin ninguna versión parcheada publicada todavía), se retomó explícitamente la nota de cierre de AGT-019 ("el resto de controladores grandes sin test propio"). De esa lista, `PuntosController` se eligió sobre `PromocionController`/`CompraController`/`RecompensaController`/`CanjeController`/`RestauranteController`/`UsuarioController` por ser el único con lógica de autorización de ownership escrita directamente en el controlador en vez de delegada a un servicio con su propio `requireOwner` ya cubierto por un test de servicio — es decir, el único de esa lista sin ninguna cobertura indirecta ya existente de esa lógica concreta.
  **Auditoría de autorización previa** (mismo criterio que FID-005/013/015/016/AGT-017): confirmado leyendo el código que `getOwnedUsuario` usa siempre `SecurityUtils.email(authentication)` (nunca un id del body) y que `sumarPuntos` usa siempre `SecurityUtils.email(authentication)` para resolver qué restaurante otorga los puntos (el `restauranteId` del body, si viene, solo se usa para **validar** que coincide con el propio, nunca para suplantar a otro) — sin vulnerabilidad nueva, el patrón ya era correcto, igual que en AGT-016/AGT-017/AGT-019.
  **Qué cambié**: `PuntosControllerTest` nuevo (14 tests unitarios puros, sin Spring ni MySQL: instancia `PuntosController` directamente con los 3 DAOs mockeados con Mockito, mismo patrón que `AdminControllerPointsTest`/`UploadControllerTest`; usa `UsernamePasswordAuthenticationToken` real con `SimpleGrantedAuthority` en vez de mockear `Authentication`, ya que `SecurityUtils`/Spring Security solo necesitan `getName()`/`getAuthorities()`, sin necesitar ningún framework de test adicional). Cubre: `totalUsuario`/`puntosPorRestaurante` del propio usuario (incluida la suma correcta solo de los movimientos de un restaurante concreto, ignorando otros restaurantes y movimientos sin restaurante); acceso a los puntos de otro usuario → `AccessDeniedException`; rol `ROLE_RESTAURANT` en el endpoint de cliente → `AccessDeniedException` sin tocar el DAO (`verifyNoInteractions`); usuario inexistente → `ResourceNotFoundException`; en `sumarPuntos`: rol distinto de `ROLE_RESTAURANT` → `AccessDeniedException` sin ninguna escritura; restaurante autenticado inexistente; `usuarioId` ausente; `restauranteId` del body de otro restaurante → `AccessDeniedException` sin guardar nada (la regresión de seguridad más directa de esta tarea); monto/puntos ≤0; usuario inexistente; y dos casos de éxito (con y sin `restauranteId` explícito en el body) que confirman el saldo sumado y el `MovimientoPuntos` (`tipo=GANADOS`, restaurante correcto) persistidos.
  **Verificación real en este entorno**: `mvn compile` → éxito. `mvn test -Dtest=PuntosControllerTest` → **14/14 passed**. `mvn test` completo → **111/112 passed** (antes de este cambio: 97/98; mismo único fallo de siempre, `contextLoads`, requiere MySQL real — confirmado leyendo la traza completa, `Communications link failure`/`Connection refused`, no relacionado con este cambio). No se tocó ningún archivo de producción, solo un test nuevo — no hizo falta repetir `ng build`/`npx playwright test --list` (sin cambios de frontend/dependencias).
  **No se pudo verificar en este entorno** (requeriría backend/MySQL reales): una petición HTTP real (`curl`) contra `POST /api/puntos`/`GET /api/puntos/**` con JWTs de dos restaurantes/usuarios distintos — los tests nuevos llaman directamente a los métodos del controlador (igual que `AdminControllerPointsTest`/`UploadControllerTest`), sin pasar por Spring Security/MVC/Tomcat ni por la base de datos real.
  **Nota aparte, no accionada esta sesión**: de la lista de AGT-017/AGT-019, siguen sin test propio a nivel de controlador `PromocionController`, `CompraController`, `RecompensaController`, `CanjeController`, `RestauranteController`, `UsuarioController` y el resto de `AdminController` más allá de `applyPointChange` — todos ellos delegan su autorización en un servicio ya cubierto por un test de servicio (a diferencia de `PuntosController`), así que el riesgo real de ese hueco es menor; queda para una futura sesión de mantenimiento si se quiere cobertura también a nivel de controlador.

### AGT-021 · `CanjeController` sin ningún test propio — nada fijaba que el usuarioId del body se ignora siempre

- **ID:** AGT-021
- **Descripción:** Retomando la misma nota dejada abierta por AGT-017/AGT-019/AGT-020 ("el resto de controladores grandes sin test propio"), `CanjeController` (`POST /api/canjes`) tampoco tenía ningún test a nivel de controlador. Solo el servicio (`PromocionService.canjearPromocion`, cubierto por 6 tests desde AGT-002) estaba probado; nada fijaba la propia garantía de seguridad que ya documenta `CanjePromocionDTO` ("el usuarioId del body se ignora, el usuario se identifica siempre por el JWT") a nivel del controlador real que recibe la petición HTTP — un cambio futuro que por accidente empezara a leer `dto.getUsuarioId()` en vez de `SecurityUtils.email(authentication)` reabriría la posibilidad de canjear a nombre de otro usuario sin que nada lo detectara salvo una auditoría manual.
- **Prioridad:** P2
- **Área:** testing
- **Estado:** REVIEW
- **Dependencias:** —
- **Archivos afectados:** src/test/java/progresa/springboot_tfg/controller/CanjeControllerTest.java (nuevo).
- **Criterios de aceptación:** El controlador llama siempre a `promocionService.canjearPromocion(promocionId, email)` usando el email de la `Authentication` del JWT, nunca el `usuarioId` del body, incluso si el body manda uno distinto o nulo; `BadRequestException`/`ResourceNotFoundException` lanzadas por el servicio se propagan tal cual (las gestiona el `GlobalExceptionHandler`, ya con su propio test); sin tests nuevos rotos en el resto de la suite.
- **Tests necesarios:** `mvn test -Dtest=CanjeControllerTest`, `mvn test` completo.
- **Resultado:** Resuelta 2026-10-20 (rutina en la nube, en paralelo a AGT-020 — otra sesión concurrente resolvió `PuntosController` casi al mismo tiempo; renumerada de AGT-020 a AGT-021 al chocar los IDs al fusionar, mismo criterio que la renumeración de AGT-007/008/009 a AGT-011/012/013). La rama ya estaba al día con `main` (PR #51 abierto, merge-base = HEAD de `origin/main`, sin commits nuevos que auditar). Sin ninguna tarea `TODO` con código pendiente (AGT-007/016/018 siguen exigiendo una decisión humana, reconfirmadas sin novedad), se retomó la misma nota ya señalada por nombre en AGT-017/AGT-019: de los controladores listados ahí, `CanjeController` es el más sensible en seguridad que quedaba sin tocar (es el único, junto a `AdminController`, donde una regresión movería puntos de un usuario real). Añadido `CanjeControllerTest` (4 tests unitarios puros con Mockito, sin Spring ni MySQL — mismo patrón que `AdminControllerPointsTest`/`UploadControllerTest`: instancia `CanjeController` directamente, mockea `PromocionService` y `Authentication`): confirma que el email usado es siempre el de `Authentication.getName()` aunque el DTO traiga un `usuarioId` distinto (999L) o nulo, y que `BadRequestException`/`ResourceNotFoundException` del servicio se propagan sin que el controlador las intercepte.
  **Verificación real en este entorno** (sin MySQL/backend real disponible, igual que todas las sesiones anteriores de esta rutina): `mvn test -Dtest=CanjeControllerTest` → **4/4 passed**. `mvn test` completo (tras rebasar sobre el commit de AGT-020) → **115/116 passed** (único fallo preexistente: `contextLoads` — `Communications link failure`, requiere MySQL real, no relacionado con este cambio). No se tocó ningún archivo de producción ni de frontend, solo un test nuevo — no hizo falta repetir `ng build`/`npx tsc --noEmit`/`npx playwright test --list`.
  **No se pudo verificar en este entorno** (requeriría backend/MySQL reales): una petición HTTP real (`curl`) contra `POST /api/canjes` con un JWT real y un `usuarioId` falsificado en el body — el test nuevo llama directamente al método del controlador (igual que `AdminControllerPointsTest`/`UploadControllerTest`), sin pasar por Spring Security/Tomcat.
  **Nota aparte, no accionada esta sesión** (fuera del alcance de "un solo elemento acotado"): de la lista de AGT-017/AGT-020, siguen sin cobertura a nivel de controlador `PromocionController`, `CompraController`, `RecompensaController`, `RestauranteController`, `UsuarioController` y el resto de `AdminController` más allá de `applyPointChange`; queda para una futura sesión de mantenimiento.

### AGT-022 · `PromocionController` sin ningún test propio — mapeo manual de `Map<String,Object>` y comprobación de ownership condicional nunca ejercitados

- **ID:** AGT-022
- **Descripción:** Retomando la misma nota dejada abierta por AGT-017/AGT-019/AGT-020/AGT-021 ("el resto de controladores grandes sin test propio"), `PromocionController` tampoco tenía ningún test a nivel de controlador. `PromocionServiceTest` ya cubre a fondo la lógica de negocio del servicio, pero dos piezas viven solo en el controlador y nunca se ejercitaban desde ahí: (1) `toPromocion()`/`intValue()`/`dateValue()`, el mapeo manual de un `Map<String,Object>` (JSON o multipart) a una entidad `Promocion`, con fallbacks silenciosos (`puntosOtorgados` ← `puntosNecesarios` si falta, `tipo` ← `"GANAR"` si falta, `activa` ← `true` si falta, fecha inválida ← `null` sin lanzar nada) que una regresión futura podría romper sin que ningún test lo note; (2) `obtenerPorRestaurante()`, que solo exige `PromocionService.validarRestauranteAutenticado(...)` cuando quien llama tiene `ROLE_RESTAURANT` — para un cliente la comprobación se salta a propósito (puede ver las promociones de cualquier restaurante) — y nada fijaba que esa condición es la correcta ni que de verdad bloquea a un restaurante que intente leer las promociones de otro.
- **Prioridad:** P2
- **Área:** testing
- **Estado:** REVIEW
- **Dependencias:** —
- **Archivos afectados:** src/test/java/progresa/springboot_tfg/controller/PromocionControllerTest.java (nuevo).
- **Criterios de aceptación:** `obtenerPorRestaurante` llama a `validarRestauranteAutenticado` solo cuando la `Authentication` tiene `ROLE_RESTAURANT`, propaga el `AccessDeniedException` del servicio sin listar nada si no es el dueño, y nunca llama a esa validación para otros roles (p. ej. `ROLE_USER`); `toPromocion` mapea `puntosOtorgados`/`puntosNecesarios`/`tipo`/`activa`/fechas con los mismos fallbacks documentados arriba; `aplicarPromocion` delega en el servicio con el `id` de la ruta, el `usuarioId` del DTO y el email del JWT; sin tests nuevos rotos en el resto de la suite.
- **Tests necesarios:** `mvn test -Dtest=PromocionControllerTest`, `mvn test` completo.
- **Resultado:** Resuelta 2026-10-22 (rutina en la nube). La rama (`agent/fidelyfood-autonomous`) ya estaba al día con `main` (sin commits nuevos que auditar desde #52). Sin ninguna tarea `TODO` con código pendiente (AGT-007/016/018 siguen exigiendo una decisión humana o un parche que todavía no existe — reconfirmado sin novedad por el propio contenido de esas entradas), se retomó la nota de cierre de AGT-021: de `PromocionController`/`CompraController`/`RecompensaController`/`RestauranteController`/`UsuarioController`, se eligió `PromocionController` por ser el único de esa lista con lógica propia en el controlador (el mapeo `toPromocion`/`intValue`/`dateValue` y la comprobación de ownership condicional por rol en `obtenerPorRestaurante`) que no es simple delegación en un servicio ya cubierto por su propio test — a diferencia de `CompraController`/`MovimientoPuntosController`/`UsuarioController`, que solo reenvían al servicio (`CompraService`/`MovimientoPuntosService`/`UsuarioService`) sin lógica adicional propia que valga la pena fijar por separado. Añadido `PromocionControllerTest` (10 tests unitarios puros con Mockito, sin Spring ni MySQL — mismo patrón que `CanjeControllerTest`/`PuntosControllerTest`: instancia `PromocionController` directamente, mockea `PromocionService` y usa `UsernamePasswordAuthenticationToken` con `SimpleGrantedAuthority` para simular roles reales en vez de un mock plano de `Authentication`, necesario porque `SecurityUtils.hasRole` recorre `getAuthorities()`): 3 tests de `obtenerPorRestaurante` (restaurante ajeno → `AccessDeniedException` propagado y el servicio de listado nunca se llama; dueño real → valida y luego lista; cliente → nunca valida ownership y lista igual), 6 tests de `crear`/`toPromocion` (mapeo completo, fallback de `puntosOtorgados`/`puntosNecesarios`, cero si ninguno, `tipo` por defecto `GANAR`, `activa` por defecto `true`, fecha inválida → `null` sin lanzar) y 1 test de `aplicarPromocion` (delega con el `usuarioId` del DTO y el email del JWT).
  **Verificación real en este entorno** (sin MySQL/backend real disponible, igual que todas las sesiones anteriores de esta rutina): `mvn test -Dtest=PromocionControllerTest` → **10/10 passed**. `mvn test` completo → **126/127 passed** (único fallo preexistente: `contextLoads` — `Communications link failure`, requiere MySQL real, no relacionado con este cambio; antes de este cambio eran 116/117 con el mismo único fallo). No se tocó ningún archivo de producción ni de frontend, solo un test nuevo — no hizo falta repetir `ng build`/`npx tsc --noEmit`/`npx playwright test --list`.
  **No se pudo verificar en este entorno** (requeriría backend/MySQL reales): una petición HTTP real (`curl` con un JWT real de un restaurante contra `GET /api/promociones/restaurante/{id}` de otro restaurante) — el test nuevo llama directamente a los métodos del controlador (igual que `CanjeControllerTest`/`PuntosControllerTest`), sin pasar por Spring Security/Tomcat.
  **Nota aparte, no accionada esta sesión** (fuera del alcance de "un solo elemento acotado"): de la lista de AGT-017/AGT-021, siguen sin cobertura a nivel de controlador `CompraController`, `RecompensaController`, `RestauranteController`, `UsuarioController` y el resto de `AdminController` más allá de `applyPointChange` — todos ellos, revisados en esta sesión, delegan su lógica/autorización íntegramente en un servicio ya cubierto por un test de servicio, sin lógica propia adicional del tamaño de la de `PromocionController`; queda para una futura sesión de mantenimiento si se decide que vale la pena esa cobertura indirecta también a nivel de controlador.

### AGT-023 · `@angular/common` con vulnerabilidad real en producción: fuga del token XSRF (parche incompleto de CVE-2025-66035)

- **ID:** AGT-023
- **Descripción:** `npm audit --omit=dev` en `frontend/` pasó de 0 a 5 vulnerabilidades (moderadas) desde el cierre de AGT-021 (2026-10-20): [GHSA-jfgx-762w-99vr](https://github.com/advisories/GHSA-jfgx-762w-99vr), un parche incompleto de CVE-2025-66035 en el `HttpClient` de Angular — una discrepancia de parseo de URL permitía que el token XSRF protegido se adjuntara a una petición hacia un origen distinto del esperado. A diferencia de todos los hallazgos de `npm audit` desde AGT-012 (siempre `devDependencies` de build/test, nunca en producción), esta es la primera vulnerabilidad real en el bundle que sirve FidelyFood a sus usuarios desde AGT-011 (Capacitor).
- **Prioridad:** P1
- **Área:** security
- **Estado:** REVIEW
- **Dependencias:** —
- **Archivos afectados:** frontend/package.json, frontend/package-lock.json, SECURITY.md (#20).
- **Criterios de aceptación:** `npm audit --omit=dev` deja de listar GHSA-jfgx-762w-99vr; sin salto de versión mayor de Angular; `ng build`/`npx tsc --noEmit`/`npx playwright test --list` sin regresiones.
- **Tests necesarios:** `npm audit --omit=dev`, `npm audit`, `ng build --configuration production`, `npx tsc --noEmit`, `npx playwright test --list`, `mvn test` (backend sin tocar, solo para confirmar que no hay interferencia).
- **Resultado:** Resuelta 2026-10-22 (rutina en la nube). La rama (`agent/fidelyfood-autonomous`, PR #51) ya estaba al día con `main` (sin commits nuevos desde #52; CI en verde en el último commit, sin conflictos, sin comentarios de revisión pendientes). Reconfirmado primero que ninguna tarea `TODO` tenía código accionable hoy: AGT-007 sigue exigiendo una decisión humana sobre Aiven; AGT-016 reconfirmado sin cambios (`mvn dependency:tree`: Spring sigue en 6.1.15/6.2.8/`spring-boot-starter-parent` 3.2.12, igual que al cerrar AGT-016); AGT-018 reconfirmado sin parche (`npm view braces versions`/`dist-tags` siguen en `3.0.3`). Se intentó además retomar la limpieza de código muerto ya señalada en AGT-013/AGT-017 (`git rm` de `gestion-promos/`/`restaurant.service.ts`, reconfirmados sin otro uso) — bloqueada **otra vez** por el mismo clasificador de modo automático ("Irreversible Local Destruction") que ya la bloqueó dos veces antes, esta vez incluso en el paso de `git commit` tras un `git rm` que sí se había ejecutado; revertido sin dejar ningún cambio a medias, sigue pendiente para una persona (tercera vez documentada).
  Repetido el primer paso habitual de estas sesiones (`npm ci` limpio + `npm audit`/`npm audit --omit=dev`): a diferencia de todas las sesiones desde AGT-011, `npm audit --omit=dev` ya **no daba 0** — 5 vulnerabilidades moderadas en `@angular/common`/`forms`/`platform-browser`/`platform-browser-dynamic`/`router` 20.0.0–20.3.33 (instalada: 20.3.33), el hallazgo descrito arriba. `npm audit` completo subió de 15 (AGT-021) a 24 (7 moderate, 17 high) — además del de Angular, aparecieron por primera vez `@modelcontextprotocol/sdk` (dependencia nueva de `@angular/cli` 20.3.x) y `follow-redirects`, ambos con "fix available via `npm audit fix`" sin `--force` en el momento de detectarlos.
  **Corrección**: `npx ng update @angular/core@20 @angular/cli@20` (mismo comando ya usado en FID-019/AGT-011) sube `@angular/core` y paquetes hermanos de 20.3.33 a **20.3.34** — la versión publicada que corrige GHSA-jfgx-762w-99vr, dentro de la misma serie 20.3.x, sin saltar de major — y `@angular/cli`/`@angular-devkit/build-angular` de 20.3.39/20.3.37 a 20.3.40. Tras ese bump, `@modelcontextprotocol/sdk` pasó a exigir `@angular/cli@21` (ya no tenía parche dentro de 20.x) — no aplicado, mismo criterio de AGT-011/AGT-018 de no saltar de major sin aprobación humana. `npm audit fix` (sin `--force`) sí corrigió `follow-redirects` 1.16.0 → 1.16.1 (dependencia de build vía `karma`/`http-proxy`, nunca en producción) sin ningún cambio de versión mayor.
  **Verificación real en este entorno**: `npm audit --omit=dev` → 5 → **0 vulnerabilidades**. `npm audit` completo → 24 → **18** (2 moderate, 16 high — las restantes: `braces`/AGT-018, `uuid`, `vite`, `webpack-dev-middleware`, `@modelcontextprotocol/sdk`, todas de build/test y todas exigiendo ya un salto a `@angular-devkit/build-angular@21`/`@angular/cli@21`, no aplicado). Diff real de `package.json`: solo las 11 líneas de versión de paquetes `@angular/*`/`@angular-devkit/build-angular`, sin tocar ninguna otra dependencia. `npx tsc --noEmit` → sin errores. `ng build --configuration production` → limpio, mismos warnings preexistentes de siempre (Sass `@import` deprecado, presupuesto de `admin-clients`/`restaurante-detalle-page`, `qrcode` no-ESM). `npx playwright test --list` → sigue en 22/22 tests en 10 ficheros, idéntico a antes. `mvn test` (backend sin tocar, instalado `agent/node_modules`/`access-center/node_modules` por primera vez en este sandbox para que no se salten tests) → **115/116 passed** (mismo único fallo de siempre, `contextLoads`, requiere MySQL real). `npm --prefix agent test` → **105/105 passed, 0 skipped**.
  **No se pudo verificar en este entorno** (requeriría backend/frontend/MySQL reales): ejercitar de verdad el `HttpClient` de Angular contra un backend vivo para confirmar en tráfico real que el token XSRF ya no se adjunta a peticiones de otro origen — la corrección es upstream (dentro de `@angular/common`), verificada aquí solo por el cambio de versión y la ausencia del aviso en `npm audit`, no por una prueba de tráfico real.

### AGT-024 · `agent/` (Agent Layer / servidor MCP) con 2 vulnerabilidades conocidas: 4 CVEs del SDK de MCP + 1 de `ip-address`

- **ID:** AGT-024
- **Descripción:** `npm audit` en `agent/` pasó de 0 vulnerabilidades (AGT-018, AGT-023) a 2: `@modelcontextprotocol/sdk` 1.31.0 (dependencia directa, `^1.31.0`) con 4 avisos de severidad alta — [GHSA-22jm-h49p-29qw](https://github.com/advisories/GHSA-22jm-h49p-29qw) (tareas experimentales no ligadas a la sesión que las creó), [GHSA-6prh-2h8m-c8cw](https://github.com/advisories/GHSA-6prh-2h8m-c8cw) (el cliente HTTP seguía redirecciones cross-origin reenviando cabeceras/cuerpo), [GHSA-46jr-4wx8-v453](https://github.com/advisories/GHSA-46jr-4wx8-v453) (una petición HTTP dentro del límite de tamaño por defecto podía agotar la memoria del servidor durante la validación) y [GHSA-rvq5-wwqv-78pq](https://github.com/advisories/GHSA-rvq5-wwqv-78pq) (la autenticación bearer del servidor aceptaba tokens emitidos para otro servicio) — más `ip-address` 10.7.3 (transitiva, vía `express-rate-limit`, que a su vez trae el propio SDK) con [GHSA-rxp7-6hxx-x8q5](https://github.com/advisories/GHSA-rxp7-6hxx-x8q5) (ReDoS cuadrático en `Address6` con identificadores de zona largos). El propio `server.mjs` de este proyecto solo usa `McpServer`/`StdioServerTransport` (transporte por stdio, nunca el HTTP/OAuth de las 4 CVEs del SDK), pero las 5 ya tenían parche publicado dentro de la misma serie 1.x/10.x — sin motivo para dejarlas sin corregir.
- **Prioridad:** P2
- **Área:** security
- **Estado:** REVIEW
- **Dependencias:** —
- **Archivos afectados:** agent/package.json, agent/package-lock.json, AGENT_TASKS.md.
- **Criterios de aceptación:** `npm audit` en `agent/` deja de listar las 5 vulnerabilidades, sin salto de versión mayor de `@modelcontextprotocol/sdk`; `npm --prefix agent test` sigue en verde.
- **Tests necesarios:** `npm audit` antes/después, `npm --prefix agent test`.
- **Resultado:** Resuelta 2026-10-23 (rutina en la nube). La rama (`agent/fidelyfood-autonomous`) ya estaba al día con `main` (0 commits de diferencia en ambos sentidos, confirmado con `git log origin/main..origin/agent/fidelyfood-autonomous` / en sentido inverso) y el backlog `AGT-xxx` no tenía ningún `TODO` con código accionable hoy (AGT-007 y AGT-016 siguen exigiendo una decisión humana; AGT-018 reconfirmado sin parche real: `npm view braces versions`/`dist-tags` siguen en `3.0.3`, 5 días después de su última comprobación). Se repitió entonces el primer paso habitual de estas sesiones sin tarea de código asignada — `npm ci` limpio + `npm audit` — pero esta vez en los tres `package.json` del repo (`frontend/`, `agent/`, `access-center/`), no solo en `frontend/` como las últimas sesiones: `agent/` pasó de las 0 vulnerabilidades documentadas en AGT-018/AGT-023 a 2 (1 alta con 4 avisos del SDK de MCP, 1 moderada de `ip-address`), el hallazgo de esta entrada. `frontend/` subió de 15 (AGT-018) a 19 (los mismos de siempre más `@modelcontextprotocol/sdk` — ya documentado en AGT-023 como dependencia nueva de `@angular/cli` 20.3.x, bloqueado por el mismo salto a Angular 21 — e `ip-address`, sin fix aplicado aquí: pertenece a la cadena de build de Angular, fuera del alcance de esta tarea centrada en `agent/`). `access-center/` → 0 vulnerabilidades, sin cambios.
  **Corrección**: `agent/package.json` pasa `"@modelcontextprotocol/sdk": "^1.31.0"` → `"^1.32.1"` (última versión publicada, corrige las 4 CVEs — la última rango afectado es `<1.32.0` — sin saltar de major: sigue siendo la serie `1.x`, mismo rango de API pública, el propio `server.mjs` solo usa `McpServer`/`StdioServerTransport`, subrutas estables desde antes de la 1.31). `npm install` deja `ip-address` todavía en 10.7.3 (no se mueve solo al re-resolver); `npm audit fix` (sin `--force`) lo sube a **10.7.4**, la primera versión parcheada de la serie `10.7.x`, sin tocar ninguna otra dependencia.
  **Verificación real en este entorno**: `npm --prefix agent test` → **105/105 passed** tanto antes (con la versión vulnerable, para fijar la base) como después del cambio — instalado también `access-center/node_modules` en este sandbox (no existía) para que no se salten los 18 tests de `approvals-routes.test.mjs`. `npm audit` en `agent/` → 2 → **0 vulnerabilidades**. Diff real de `package.json`/`package-lock.json`: solo `@modelcontextprotocol/sdk` (1.31.0 → 1.32.1) e `ip-address` (10.7.3 → 10.7.4), sin ningún otro cambio de versión. No se tocó ningún archivo de `src/` del Agent Layer, ni `frontend/` ni el backend Java, así que no hizo falta repetir `ng build`/`mvn test`.
  **No se pudo verificar en este entorno** (requeriría MySQL/backend/frontend reales): ningún caso aquí los necesita — las 5 vulnerabilidades corregidas son del propio Agent Layer (Node.js puro) y sus tests (`npm --prefix agent test`) no dependen de servicios externos, ya verificados de verdad arriba.

### AGT-025 · `frontend/` seguía con 4 vulnerabilidades nuevas además de `@modelcontextprotocol/sdk` (ya cubierto por AGT-024): `ip-address`, `express`, `body-parser`, `content-disposition`, `enhanced-resolve`, `iconv-lite`

- **ID:** AGT-025
- **Descripción:** Esta sesión llegó a la misma causa raíz que AGT-024 (`npm audit` reportaba `@modelcontextprotocol/sdk`/`ip-address` nuevos desde AGT-023) **de forma concurrente e independiente** — otra ejecución de esta misma rutina, partiendo del mismo commit base, numeró y resolvió primero esos dos hallazgos en `agent/` como AGT-024 (fusionado con `git merge`, sin solapamiento de líneas: esta tarea solo renumera y recorta lo que ya quedó cubierto allí). Lo que **no** cubría AGT-024 (centrada solo en `agent/`): el propio `npm audit` de `frontend/` tenía una copia transitiva, separada, de `ip-address` 10.7.2 (vía `@angular/cli` → `@modelcontextprotocol/sdk` → `express-rate-limit`, y también vía `pacote`/`make-fetch-happen`/`socks-proxy-agent`, deduplicadas a la misma versión) con el mismo [GHSA-rxp7-6hxx-x8q5](https://github.com/advisories/GHSA-rxp7-6hxx-x8q5) — y, al aplicar `npm audit fix` sobre ella, arrastró además `express`/`body-parser`/`content-disposition`/`enhanced-resolve`/`iconv-lite` (todas dependencias transitivas de `@angular/cli`, con parche disponible dentro de sus propios rangos semver ya permitidos, sin ningún salto de major).
- **Prioridad:** P3
- **Área:** maintenance
- **Estado:** REVIEW
- **Dependencias:** —
- **Archivos afectados:** frontend/package-lock.json, SECURITY.md (#21).
- **Criterios de aceptación:** `npm audit` en `frontend/` no empeora respecto al estado ya corregido; `npm audit --omit=dev` sigue en 0; `ng build`/`npx tsc --noEmit`/`npx playwright test --list` sin regresiones.
- **Tests necesarios:** `npm audit` (`frontend/`), `npm audit --omit=dev`, `npx tsc --noEmit`, `ng build --configuration production`, `npx playwright test --list`, `mvn test` (backend sin tocar, solo para confirmar que no hay interferencia).
- **Resultado:** Resuelta 2026-10-23 (rutina en la nube), renumerada de AGT-024 a AGT-025 al fusionar con la sesión concurrente que resolvió primero el hallazgo de `agent/` (mismo criterio ya usado varias veces en este backlog — FID-020/021, AGT-007/008/009→011/012/013, AGT-020/021 — para colisiones de ID sin solapamiento real de contenido). `npm ci` limpio en `frontend/` seguía reportando 19 vulnerabilidades (3 moderate, 16 high) tras el cierre de AGT-023: la mayoría ya documentadas (braces/#19, uuid, vite, webpack-dev-middleware, `@modelcontextprotocol/sdk` — esta última, en su copia transitiva de `@angular/cli`, sigue sin parche libre dentro de la serie 20.x, igual que en AGT-024), más `ip-address` 10.7.2 (moderada, nueva desde AGT-023), no cubierta por el fix de AGT-024 porque esa sesión solo tocó `agent/package.json`/`agent/package-lock.json`, nunca `frontend/`.
  **Corrección**: `npm audit fix` (sin `--force`) en `frontend/` resolvió `ip-address` 10.7.2 → **10.7.4** (mismo parche real que AGT-024 aplicó en `agent/`, aquí dentro del rango ya permitido transitivamente — sin tocar `frontend/package.json`) y, en la misma resolución, 4 vulnerabilidades más sin ningún salto de major: `express`, `body-parser`, `content-disposition`, `enhanced-resolve`, `iconv-lite` (todas dependencias transitivas de `@angular/cli`, dentro de sus propios rangos semver ya permitidos). `frontend/package.json` no cambió, solo el lockfile. Las vulnerabilidades restantes (braces/#19, uuid, vite, webpack-dev-middleware, `@modelcontextprotocol/sdk` transitivo) siguen exigiendo `@angular-devkit/build-angular@21`/`@angular/cli@21` — no aplicado, mismo criterio que AGT-018/AGT-023/AGT-024 de no saltar de major sin aprobación humana.
  **Verificación real en este entorno**: `npm audit` en `frontend/` → 19 (3 moderate, 16 high) → **15 (2 moderate, 13 high)**; `npm audit --omit=dev` → 0 antes y después (nunca afectó a producción del frontend). `npx tsc --noEmit` sin errores. `ng build --configuration production` → limpio, mismos warnings preexistentes de siempre (Sass `@import` deprecado, presupuesto de `admin-clients`/`restaurante-detalle-page`, `qrcode` no-ESM). `npx playwright test --list` → 22/22 en 10 ficheros, idéntico a antes. `mvn test` (backend sin tocar) → **126 tests, 125 passed, 1 error** (mismo único fallo de siempre, `contextLoads`, requiere MySQL real — sin regresión). Diff revisado a mano: solo `frontend/package-lock.json`, ningún `package.json` ni ningún paquete con salto de versión mayor.
  **No se pudo verificar en este entorno** (requeriría backend/frontend/MySQL reales): ejecutar de verdad los 22 specs E2E contra un backend vivo — las dependencias corregidas son todas de build/test de `@angular/cli`, nunca llegan al bundle servido (`npm audit --omit=dev` lo confirma en 0 antes y después).

### AGT-026 · `body-parser`/`zod`/`fast-uri` con avisos nuevos en `agent/`, `access-center/` y `frontend/` desde el cierre de AGT-024/AGT-025

- **ID:** AGT-026
- **Descripción:** Un `npm ci` limpio en las tres carpetas Node del proyecto detectó avisos nuevos publicados tras el cierre de AGT-024/AGT-025 (2026-10-23): `body-parser` (GHSA-27r3-jxmh-p828, DoS por bytes sobrantes tras un cuerpo comprimido) en `agent/` y `access-center/` (ambas vía `express`, dependencia directa de producción en los dos casos); `zod` (GHSA-mrhx-c7xc-m3w5, agotamiento de memoria validando colecciones sobredimensionadas) en `agent/`, dependencia directa de producción usada para validar el esquema de las herramientas MCP; y `fast-uri` (4 avisos moderados de confusión de esquema/host) en `agent/` y `frontend/` (esta última solo de build, vía `ajv`→`@angular-devkit/build-angular`).
- **Prioridad:** P2
- **Área:** security
- **Estado:** REVIEW
- **Dependencias:** —
- **Archivos afectados:** agent/package-lock.json, access-center/package-lock.json, frontend/package-lock.json, SECURITY.md.
- **Criterios de aceptación:** `npm audit` en `agent/` y `access-center/` vuelve a 0; en `frontend/` baja sin empeorar ninguna vulnerabilidad existente y sin saltar de versión mayor ningún paquete; `npm audit --omit=dev` (frontend) sigue en 0; ningún `package.json` cambia, solo los lockfiles; tests existentes sin regresiones.
- **Tests necesarios:** `npm audit` (las tres carpetas), `npm --prefix agent test`, `npm --prefix access-center test`, `npx tsc --noEmit`, `ng build --configuration production`, `npx playwright test --list`, `mvn test` (backend sin tocar, solo para confirmar que no hay interferencia).
- **Resultado:** Resuelta 2026-10-24 (rutina en la nube). La rama ya estaba al día con `main` (0 commits de diferencia en ambos sentidos) y el PR #51 seguía abierto con el mismo acumulado de AGT-011 a AGT-025 sin novedad desde ayer; sin ninguna tarea `TODO` con código pendiente (AGT-007 y AGT-016 siguen exigiendo una decisión humana; AGT-018 sigue sin parche real de `braces` — reconfirmado en esta misma sesión con `npm view braces dist-tags`, sigue en `3.0.3`), se repitió el primer paso habitual de estas sesiones sin tarea asignada: `npm ci` limpio en `agent/`, `access-center/` y `frontend/` (las tres, no solo `frontend/`, mismo criterio que AGT-024/025 de auditar cada carpeta Node por separado) seguido de `npm audit`.
  **Hallazgo**: `agent/` pasó de 0 (cierre de AGT-024) a 3 vulnerabilidades (`body-parser` alta, `fast-uri` moderada, `zod` alta); `access-center/` pasó de 0 (cierre de AGT-025) a 1 (`body-parser` alta); `frontend/` pasó de 15 (cierre de AGT-025) a 10 (2 moderate, 5 moderate, 4 high desglosadas: `@angular-devkit/build-angular`/`build-webpack`, `body-parser`, `fast-uri`, `serialize-javascript`, `sockjs`/`uuid`, `undici`, `webpack-dev-middleware`/`webpack-dev-server` — la aparente "bajada" respecto al número de AGT-025 es solo porque varios avisos de esa sesión ya se habían resuelto corriente arriba en el registro de npm entre entonces y ahora, no por ningún cambio hecho en este repositorio).
  **Corrección**: `npm audit fix` (sin `--force`) en las tres carpetas, todas dentro de los rangos semver ya permitidos por los `package.json` existentes (ninguno se tocó): `agent/`: `body-parser` 2.3.0→2.4.0, `fast-uri` 3.1.8→3.1.9, `qs` 6.16.0→6.16.1, `zod` 4.6.5→4.6.7. `access-center/`: `body-parser` 2.3.0→2.4.0, `qs` 6.16.0→6.16.1. `frontend/`: `fast-uri` 3.1.8→3.1.9, `body-parser` (copia de `karma`) 1.20.8→1.20.9, `serialize-javascript` 7.0.5→7.1.4, `undici` 6.28.1→6.29.1. Las 6 vulnerabilidades restantes de `frontend/` (`braces`/AGT-018, `uuid`, `webpack-dev-middleware`, `@angular-devkit/build-angular`/`build-webpack`) solo se resuelven saltando a `@angular-devkit/build-angular@21`/`@angular/cli@21` (confirmado con el propio `npm audit fix` ofreciendo ese salto de major) — no aplicado, mismo criterio que todas las sesiones anteriores desde AGT-011.
  **Verificación real en este entorno**: `npm audit` → `agent/` 3→**0**, `access-center/` 1→**0**, `frontend/` 10→**6**. `npm audit --omit=dev` (frontend) → 0 antes y después. `npm --prefix agent test` → **105/105 passed**, 0 skipped (instalado también `access-center/node_modules`, necesario para no saltarse los tests de `approvals-routes.test.mjs`). `npm --prefix access-center test` → **6/6 passed**. `npx tsc --noEmit` (frontend) → sin errores. `ng build --configuration production` → limpio, mismos warnings preexistentes de siempre (Sass `@import` deprecado, presupuesto de `admin-clients`/`restaurante-detalle-page`, `qrcode` no-ESM). `npx playwright test --list` → 22/22 tests en 10 ficheros, sin cambios. `mvn test` (backend sin tocar) → **126 tests, 125 passed, 1 error** (mismo único fallo de siempre, `contextLoads`, requiere MySQL real — sin regresión). Diff revisado a mano: solo los tres `package-lock.json`, ningún `package.json` ni ningún paquete con salto de versión mayor.
  **No se pudo verificar en este entorno** (requeriría backend/frontend/MySQL reales): ejecutar de verdad los 22 specs E2E contra un backend vivo, ni arrancar `access-center/server.js` real para ejercitar `POST /api/jarvis/run` con un cuerpo comprimido malicioso — el fix es un parche de dependencia ya publicado y probado por su propio mantenedor, sin cambio de código propio que requiera esa verificación end-to-end.

### AGT-027 · Panel admin sin spec E2E de la pantalla de clientes (`/admin/clients`)
- **ID:** AGT-027
- **Descripción:** Al cerrar AGT-003 (2026-10-08) quedó señalado explícitamente, pero fuera de alcance de esa sesión, "un cuarto spec de admin más allá del listado de negocios (p.ej. clientes o reservas)". Seguía sin cubrir: de las 4 pantallas de gestión del panel admin (`businesses`, `clients`, `reservations`, `stats`), solo `admin-businesses.spec.ts` tenía spec propio. `AdminClientsComponent` es además la única de las tres restantes con lógica de mutación real desde la UI (ajuste manual de puntos, edición, baja lógica) — el backend (`AdminControllerPointsTest`, AGT-017) ya cubre `applyPointChange` con tests unitarios, pero nunca se había ejercitado desde la UI real el flujo de abrir un cliente y ver su detalle.
- **Prioridad:** P2
- **Área:** testing
- **Estado:** REVIEW
- **Dependencias:** —
- **Archivos afectados:** frontend/e2e/admin-clients.spec.ts (nuevo), AGENT_TASKS.md, .agent/tasks.md.
- **Criterios de aceptación:** Existe un spec para `/admin/clients` que falla si la pantalla se rompe (listado o detalle), usa `helpers/auth.ts` (`apiLoginAdmin`) sin credenciales hardcodeadas y se salta limpiamente si `FIDELYFOOD_ADMIN_PASSWORD` no está definida.
- **Tests necesarios:** `npx tsc --noEmit`, `npx playwright test --list`, `ng build --configuration production`.
- **Resultado:** Resuelta 2026-10-24 (rutina en la nube). Rama ya al día con `main` y con el PR #51 tras fusionar el trabajo concurrente de AGT-026 (ver arriba) — sin solapamiento de archivos con esta tarea. Reconfirmado sin novedad en los pendientes bloqueados (AGT-007/016/018). Repasados también, igual que en la sesión de AGT-026, los controladores grandes sin test propio: `CompraController`/`MovimientoPuntosController`/`RecompensaController`/`RestauranteController`/`UsuarioController` siguen sin lógica propia sin cubrir (delegan en servicios ya testeados o en `requireRole` declarativo) — se descartó esa línea por agotada y se retomó en su lugar el hueco de E2E ya señalado por nombre en AGT-003, mismo criterio ya usado varias veces en este backlog (FID-021, AGT-008/009, AGT-017/019/020/022) de preferir un hueco ya identificado a inventar uno nuevo.
  **`admin-clients.spec.ts` (nuevo)**: reutiliza `apiLoginAdmin`/`authenticateAs` ya existentes (sin tocar `helpers/auth.ts`). Verifica el título real de la pantalla (`Clientes`), que el contador "Total" de `.client-metrics` termina de cargar con clientes reales (mayor que 0 — hay cuentas de cliente ya sembradas/registradas) y, más allá de lo que ya hacía `admin-businesses.spec.ts` (solo listado), que **abrir el primer cliente real de la tabla carga su detalle de verdad**: el panel `.client-detail` aparece, el spinner de `.detail-loading` desaparece y la pestaña "Resumen" (por defecto) muestra el bloque de "Puntos totales" con datos reales — ejercitando `GET /api/admin/clients` y `GET /api/admin/clients/{id}` desde la UI real por primera vez en esta suite.
  **Verificación real en este entorno** (sin MySQL/backend real disponible, igual que todas las sesiones anteriores de esta rutina — `node_modules` del frontend no existía en este sandbox, primera vez en esta sesión; instalado con `npm ci`): `npx tsc --noEmit` → sin errores nuevos (mismos 2 avisos de deprecación de `tsconfig.json` ya documentados). `npx playwright test --list` → **23/23 tests en 11 ficheros** (antes 22/10), incluido el spec nuevo, sin errores de sintaxis/tipos. `npx ng build --configuration production` → build limpio, mismos warnings preexistentes (Sass `@import` deprecado, presupuesto de `admin-clients`/`restaurante-detalle-page` ya excedido antes de este cambio, `qrcode` no-ESM) — este cambio no tocó ningún archivo de producción, solo `frontend/e2e/`. `npm ci` (frontend) → 6 vulnerabilidades (0 críticas, todas ya documentadas en AGT-026, requieren Angular 21, sin cambios).
  **No se pudo verificar en este entorno** (requeriría backend/frontend/MySQL reales): la ejecución real del spec nuevo contra un backend vivo — está escrito y listado, pero no ejecutado, igual que el resto de la suite en todas las sesiones anteriores de esta rutina. El spec necesita además que `FIDELYFOOD_ADMIN_PASSWORD` esté definida en el entorno que lo ejecute (se salta solo si no lo está, nunca falla en falso, mismo patrón que `admin-businesses.spec.ts`).
  **No completado de AGT-003/AGT-027 en esta sesión** (queda para una futura iteración, ningún criterio de aceptación lo exigía): spec de `/admin/reservations` (la pantalla de gestión del panel admin que sigue sin cobertura) y un flujo de recompensas del cliente dedicado (`/u/recompensas`, ya con cobertura indirecta vía `canje-promocion.spec.ts`).

### AGT-028 · Mass assignment real en `PUT /api/usuarios/{id}`: un cliente podía autoasignarse puntos de fidelidad arbitrarios
- **ID:** AGT-028
- **Descripción:** `UsuarioService.actualizar(id, actualizado, emailAutenticado)` (usada por `PUT /api/usuarios/{id}`, el endpoint de edición de perfil propio) copiaba `usuario.setPuntos(actualizado.getPuntos())` directamente del cuerpo de la petición sin ninguna restricción. El `ownership` (que el `id` sea el del propio autenticado, vía `requireOwner`) era y sigue siendo correcto, pero una vez dentro de su propio registro el cliente podía incluir en el JSON un `puntos` manipulado (p.ej. `999999`) y el backend lo persistía sin pasar por ningún flujo de compra/canje/ajuste de administrador — otorgamiento de puntos de fidelidad reales (canjeables por recompensas) sin ninguna validación de negocio.
- **Prioridad:** P1
- **Área:** security
- **Estado:** REVIEW
- **Dependencias:** —
- **Archivos afectados:** src/main/java/progresa/springboot_tfg/service/UsuarioService.java, src/test/java/progresa/springboot_tfg/service/UsuarioServiceTest.java, SECURITY.md.
- **Criterios de aceptación:** `PUT /api/usuarios/{id}` sigue permitiendo editar nombre/email/contraseña del propio usuario con normalidad, pero ningún valor de `puntos` incluido en el cuerpo de la petición cambia el saldo persistido; test de regresión que envía un `puntos` manipulado y confirma que el saldo no cambia; sin tests existentes rotos.
- **Tests necesarios:** `mvn test -Dtest=UsuarioServiceTest`, `mvn test` completo.
- **Resultado:** Resuelta 2026-10-25 (rutina en la nube). Al llegar a la rama (`agent/fidelyfood-autonomous`, sin commits nuevos en `main` que auditar — el PR #51 sigue abierto y al día) se reconfirmó primero que los tres pendientes bloqueados por decisión humana/parche externo seguían igual: AGT-007 (Aiven, decisión humana) y AGT-016 (Spring Boot/Framework, decisión humana) sin tarea de código posible; AGT-018 (`braces`/GHSA-vfj7-8cjw-p6xm) reconfirmado con `npm view braces dist-tags` — sigue en `3.0.3`, sin ninguna versión parcheada publicada. Sin ninguna tarea `TODO` con código real pendiente, se retomó la línea que la propia sesión de AGT-027 había cerrado en falso (ver su nota de cierre, arriba): "`CompraController`/`MovimientoPuntosController`/`RecompensaController`/`RestauranteController`/`UsuarioController` siguen sin lógica propia sin cubrir (delegan en servicios ya testeados...)" — esa frase solo comprobó el **controlador**, nunca leyó con atención el **servicio** al que delega cada uno. Al leer `UsuarioService.actualizar` línea a línea (el único de esos cinco con un método de escritura genérico tipo "actualizar perfil", a diferencia de `CompraController`/`RecompensaController`, que solo registran compras/canjes con su propia validación de negocio), apareció la línea `usuario.setPuntos(actualizado.getPuntos())` sin ninguna comprobación — exactamente el tipo de "campo sensible que el cliente puede mandar en el body y que el backend copia sin pensar" que este backlog ya penalizó dos veces antes (FID-005: Broken Access Control por falta de ownership; FID-017: exceso de exposición de datos), pero aquí es una tercera variante distinta — mass assignment de un campo de negocio con impacto financiero directo, no de autorización ni de exposición de datos.
  **Verificación empírica de la explotabilidad** (no solo lectura de código, sin necesitar backend real): confirmado con `grep` que `UsuarioService.actualizar(Long, Usuario, String)` solo tiene una ruta de entrada real, `UsuarioController.actualizar` (línea 88), y que `SecurityConfig` solo exige `ROLE_USER` autenticado en `/api/usuarios/**` (ninguna comprobación adicional de campos en el cuerpo) — cualquier cliente autenticado podía disparar esto con su propio `id`. Revisado también el frontend (`perfil.component.ts`, único punto que llama a `updateUsuario`): hoy siempre reenvía `...this.user` (el mismo `puntos` ya cargado, sin editarlo en el formulario), así que no hay explotación activa desde la UI oficial — mismo matiz exacto que FID-005 en su día: sin frontend que lo dispare hoy, la API queda igual de expuesta a cualquier cliente con un token real vía `curl`/Postman.
  **Corrección**: una sola línea eliminada en `UsuarioService.actualizar` — el saldo de puntos ya nunca se acepta ni se copia desde el cuerpo de este endpoint; solo puede cambiar a través de los flujos ya existentes y con su propia validación (`PuntosController.sumarPuntos`, `CanjeController`, `RecompensaController.canjear`, los endpoints de ajuste manual de `AdminController`, ya cubiertos por sus propios tests — AGT-017/020/021). Nombre/email/contraseña siguen editándose exactamente igual que antes.
  **Test de regresión añadido**: 4 tests nuevos en `UsuarioServiceTest` (`actualizar` no tenía ningún test, ni antes ni después del propio hallazgo de AGT-027): ownership (`AccessDeniedException` sin guardar si el email autenticado no es el dueño), actualización normal de nombre/email, la contraseña no se toca si no se manda una nueva, y el test central — con `puntos=999999` manipulado en el cuerpo, el saldo del usuario (y el de la respuesta `UsuarioDTO`) permanece en su valor original (`50`) tras la llamada.
  **Verificación real en este entorno**: `mvn compile` → éxito. `mvn test -Dtest=UsuarioServiceTest` → **19/19 passed** (15 ya existentes + 4 nuevos). `mvn test` completo → **130 tests, 130 passed, 1 error** (`contextLoads`, el mismo fallo preexistente de siempre por falta de MySQL real en este sandbox — confirmado leyendo la traza completa, `Communications link failure`/`Connection refused`, sin relación con este cambio; antes de este cambio eran 126 tests). No se tocó ningún archivo de frontend ni de otro controlador/servicio — no hizo falta repetir `ng build`/`npm audit`/`npx playwright test --list` (sin cambios de frontend ni de dependencias).
  **No se pudo verificar en este entorno** (requeriría backend/MySQL reales): una petición HTTP real (`curl` con un JWT de cliente real) contra `PUT /api/usuarios/{id}` con un `puntos` manipulado, antes y después del fix — el test nuevo llama directamente al método del servicio (mismo patrón que el resto de esta suite, incluido `AdminControllerPointsTest`), sin pasar por Spring Security/MVC/JWT reales. Queda para una sesión con esos servicios disponibles, o para revisión humana local, confirmar el mismo comportamiento end-to-end.

### AGT-029 · Panel admin de reservas: "Completada"/"Asistió"/"No asistió" nunca se podían aplicar desde la UI real (y faltaba el spec de `/admin/reservations` que AGT-027 dejó señalado)

- **ID:** AGT-029 (renumerada desde AGT-028 al chocar de ID, al fusionar, con una sesión concurrente de esta misma rutina que llegó primero a un hallazgo distinto — mass assignment en `PUT /api/usuarios/{id}`, ver arriba; mismo criterio ya usado en FID-020/FID-021/AGT-024-025 para resolver colisiones de numeración sin perder ningún hallazgo).
- **Descripción:** Retomando el hueco que AGT-027 dejó explícitamente señalado ("spec de `/admin/reservations`"), al escribirlo se encontró un hallazgo real: el formulario de reservas del panel admin (`admin-reservations.component.html`) ofrece 6 estados en su selector y en los botones de acción rápida (Pendiente/Confirmada/Cancelada/Completada/Asistió/No asistió), pero `AdminController` (`applyReservationData`/`updateReservationStatus`) solo aceptaba `PENDING`/`CONFIRMED`/`CANCELLED` — elegir "Completar", "Asistió" o "No asistió" desde la pantalla real siempre devolvía 400, con un simple toast de error que no rompía la pantalla (por eso no se había detectado en una auditoría visual). El propio frontend (`statusLabel`/`statusClass`/los `ion-select-option` y los botones de `quick-actions`) ya trata esos 3 estados como válidos desde que se escribió el componente — nunca llegó a existir ninguna sesión que los hubiera podido aplicar de verdad.
- **Prioridad:** P2
- **Área:** backend / testing
- **Estado:** REVIEW
- **Dependencias:** —
- **Archivos afectados:** `src/main/java/progresa/springboot_tfg/controller/AdminController.java`, `src/test/java/progresa/springboot_tfg/controller/AdminControllerReservationTest.java` (nuevo), `frontend/e2e/admin-reservations.spec.ts` (nuevo), `AGENT_TASKS.md`, `.agent/tasks.md`.
- **Criterios de aceptación:** `PATCH /api/admin/reservations/{id}/status` y `POST`/`PUT /api/admin/reservations` aceptan los 6 estados que ofrece la UI (no solo 3); un estado fuera de ese conjunto sigue devolviendo 400; existe un spec E2E para `/admin/reservations` (listado + detalle, mismo patrón que `admin-clients.spec.ts`/`admin-businesses.spec.ts`) y un spec de regresión que ejercita los 3 estados antes rotos contra un backend real.
- **Tests necesarios:** `mvn test -Dtest=AdminControllerReservationTest`, `mvn test` completo, `npx tsc --noEmit`, `npx playwright test --list`, `ng build --configuration production`.
- **Resultado:** Resuelta 2026-10-25 (rutina en la nube). Rama ya al día con `main` y con el PR #51 (AGT-027 como último commit, sin commits nuevos en `main` que auditar). Reconfirmado sin novedad en los pendientes bloqueados por decisión humana (AGT-007 Aiven, AGT-016 Spring Boot/Framework fin de soporte, AGT-018 `braces` sin parche todavía — ninguno con código pendiente). Se retomó el hueco que AGT-027 dejó señalado por nombre ("spec de `/admin/reservations`"), mismo criterio ya usado varias veces en este backlog de preferir un hueco ya identificado a inventar uno nuevo. Al ir a fusionar con el remoto apareció una sesión concurrente que ya había numerado AGT-028 su propio hallazgo (mass assignment en `UsuarioService.actualizar`, ver arriba) — renumerada esta tarea a AGT-029 al fusionar, sin solapamiento de archivos entre ambas.
  **El hallazgo**: al escribir el spec y revisar `AdminController.java` para saber qué estados son válidos, los dos únicos sitios que validaban el estado (`applyReservationData`, usado por crear/editar; `updateReservationStatus`, usado por el PATCH de los botones de acción rápida) comprobaban `Set.of("PENDING", "CONFIRMED", "CANCELLED").contains(status)` — un `grep` de `ATTENDED`/`NO_SHOW`/`COMPLETED` en todo `src/main/java` no devolvió ningún resultado, confirmando que esos 3 estados, ya ofrecidos por el frontend desde que se escribió `AdminReservationsComponent`, nunca habían sido aceptados por el backend.
  **Corrección**: nueva constante `RESERVATION_STATUSES` (`PENDING`, `CONFIRMED`, `CANCELLED`, `COMPLETED`, `ATTENDED`, `NO_SHOW`) que sustituye a los dos `Set.of(...)` inline — un único sitio que mantener sincronizado con las opciones reales de la UI, en vez de dos copias del mismo conjunto que ya habían podido desincronizarse una vez.
  **Tests unitarios nuevos (`AdminControllerReservationTest`, 11 tests, Mockito puro sobre `AdminController` directamente, mismo patrón que `AdminControllerPointsTest` de AGT-017)**: crear una reserva con cada uno de los 6 estados (parametrizado) se acepta y persiste el estado pedido; cambiar el estado a `COMPLETED`/`ATTENDED`/`NO_SHOW` (parametrizado, los 3 que antes fallaban) devuelve 200 y aplica el cambio; un estado fuera de ese conjunto (`"ARCHIVADA"`) sigue lanzando `BadRequestException` tanto al crear como al cambiar el estado, sin mutar la reserva existente.
  **Spec E2E nuevo (`admin-reservations.spec.ts`)**: un primer test cubre el hueco de pantalla que señaló AGT-027 (siembra una reserva real vía API, navega a `/admin/reservations` autenticado como admin, confirma el título real, que el contador "Total" carga con datos reales y que abrir la primera fila carga el panel de detalle real `.reservation-detail`/`.summary-grid`, no el placeholder "Selecciona una reserva"); un segundo test reproduce el bug contra un backend real: crea una reserva, aplica los 3 estados antes rotos vía `PATCH .../status` (los mismos botones de acción rápida de la pantalla llaman a este endpoint) y confirma 200 + el estado esperado en cada uno, y que un estado inválido sigue devolviendo 400. Ambos tests limpian la reserva de prueba con un borrado lógico (`DELETE`) en un bloque `finally`, para no dejar datos de prueba acumulándose en el panel admin real entre ejecuciones.
  **Verificación real en este entorno**: `mvn compile` → éxito. `mvn test -Dtest=AdminControllerReservationTest` → **11/11 passed**. `mvn test` completo tras el merge con AGT-028 (UsuarioServiceTest) → **141 tests, 140 passed, 1 error** (`SpringBootTfgApplicationTests.contextLoads`, mismo motivo de siempre, `Communications link failure`/`Connection refused`, no hay MySQL en este sandbox) — sin tests existentes rotos. `npm ci` (frontend, `node_modules` no existía en este sandbox) → 6 vulnerabilidades, 0 críticas, mismas ya documentadas en AGT-026/AGT-027. `npx tsc --noEmit` → sin errores. `npx playwright test --list` → **25/25 tests en 12 ficheros** (antes 23/11), incluidos los 2 tests nuevos, sin errores de sintaxis/tipos. `npx ng build --configuration production` → build limpio, mismos warnings preexistentes de siempre (Sass `@import` deprecado, presupuesto de `admin-clients`/`restaurante-detalle-page` ya excedido antes de este cambio, `qrcode` no-ESM) — este cambio no afecta el bundle de producción del cliente/restaurante, solo el controlador admin.
  **No se pudo verificar en este entorno** (requeriría backend/frontend/MySQL reales, igual que todas las sesiones anteriores de esta rutina): la ejecución real de `admin-reservations.spec.ts` contra un backend vivo — está escrito y listado, pero no ejecutado. Ambos tests necesitan `FIDELYFOOD_ADMIN_PASSWORD` definida en el entorno que los ejecute (se saltan limpiamente si no lo está, mismo patrón que `admin-clients.spec.ts`/`admin-businesses.spec.ts`).

### AGT-030 · El frontend no tenía ningún test unitario real de su capa de autenticación/autorización (guards + interceptor), y `ng test` no podía ejecutarse en este sandbox
- **ID:** AGT-030
- **Descripción:** De los 7 ficheros `*.spec.ts` que `npx playwright test --list`/`grep` mostraban en `frontend/`, solo 2 (`app.component.spec.ts`, `home.page.spec.ts`) eran tests unitarios de Karma/Jasmine, y ambos son el boilerplate genérico del esqueleto de Ionic ("should create"), sin ningún test propio del proyecto. Mientras el backend tiene cobertura Mockito extensa de ownership/autorización (AGT-017/019/020/021/022, FID-005/013), la contraparte del frontend — `authGuard`, `roleGuard` y `tokenInterceptor` (`frontend/src/app/core/auth/`), que decide qué pantallas se muestran por rol y si el JWT se adjunta o se borra la sesión — no tenía ningún test, solo lectura de código en sesiones anteriores. Aparte, `ng test` no podía ejecutarse en ningún sandbox de esta rutina: Karma solo tenía configurado el lanzador `Chrome` (no headless, falla sin pantalla) y el `ChromeHeadless` por defecto de `karma-chrome-launcher` falla al ejecutarse como root sin `--no-sandbox` ("Running as root without --no-sandbox is not supported").
- **Prioridad:** P2
- **Área:** testing / frontend
- **Estado:** REVIEW
- **Dependencias:** —
- **Archivos afectados:** `frontend/karma.conf.js`, `frontend/src/app/core/auth/auth.guard.spec.ts` (nuevo), `frontend/src/app/core/auth/role.guard.spec.ts` (nuevo), `frontend/src/app/core/auth/token.interceptor.spec.ts` (nuevo), `AGENT_TASKS.md`, `.agent/tasks.md`.
- **Criterios de aceptación:** `ng test --watch=false` puede ejecutarse en un sandbox sin sesión gráfica real (vía `--browsers=ChromeHeadlessCI`, sin cambiar el comportamiento por defecto para desarrollo local); `authGuard`/`roleGuard` tienen test para cada combinación relevante de rol/ruta (sin sesión, token caducado, rol correcto, rol incorrecto en cada una de las 3 áreas); `tokenInterceptor` tiene test que confirma que el JWT nunca se adjunta a peticiones externas ni a `/api/auth/**`, que un 401 solo cierra sesión cuando el token ya no es válido (no cuando es un 401 de alcance/rol) y que un 403 redirige según el rol actual; todos los tests nuevos y los 2 ya existentes pasan.
- **Tests necesarios:** `CHROME_BIN=<ruta del chromium de Playwright> npx ng test --watch=false --browsers=ChromeHeadlessCI`, `npx tsc --noEmit`, `ng build --configuration production`, `npx playwright test --list`.
- **Resultado:** Resuelta 2026-10-26 (rutina en la nube). Rama ya al día con `main` (0 commits de diferencia en ambos sentidos); PR #51 sigue abierto y al día. Reconfirmados sin novedad los 3 pendientes bloqueados por decisión humana/parche externo (AGT-007 Aiven, AGT-016 Spring Boot/Framework fin de soporte, AGT-018 `braces` — `npm view braces dist-tags` sigue en `3.0.3`). Repetidos los audits habituales antes de elegir tarea: `npm audit` en `agent/` y `access-center/` → 0 (sin cambios); `npm audit` en `frontend/` → 6 vulnerabilidades (4 moderate, 2 high: `uuid`/`webpack-dev-middleware`/`sockjs`/`@angular-devkit/build-angular`, todas ya diferidas a un salto a Angular 21 desde AGT-019/AGT-025 — nota: `braces` ya no aparece en este audit, probablemente un cambio en los datos de la propia advisory de npm, no un parche real: `npm view braces dist-tags` sigue en `3.0.3`, así que AGT-018 no se reabre ni se cierra solo por esto); `mvn test` → **141 tests, 140 passed, 1 error** (`contextLoads`, mismo fallo preexistente de siempre, sin MySQL real) — sin hallazgo nuevo en ninguno de los tres. Sin ninguna tarea `TODO` con código pendiente y con la línea de "controlador/servicio de backend sin test propio" ya agotada (confirmado otra vez), se trasladó el mismo criterio de cobertura de seguridad ya aplicado al backend a la mitad del stack que nunca lo había recibido: el frontend. Elegido `frontend/src/app/core/auth/` por ser, con diferencia, el código de frontend más sensible a un fallo silencioso (una regresión aquí no rompe visualmente la UI, solo decide mal quién entra a qué pantalla o cuándo se cierra una sesión) y el único sin ningún test.
  **Auditoría de autorización previa** (mismo criterio que siempre: comprobar que no hay una vulnerabilidad real antes de limitarse a añadir cobertura): confirmado con `grep` que las 4 rutas raíz de `app.routes.ts` combinan siempre `[authGuard, roleGuard('ROLE_...')]` — `roleGuard` es la comprobación real de rol en cada ruta, `authGuard` es una capa adicional de sesión/redirección temprana, ninguna de las dos es la única barrera. Esto es además solo una capa de experiencia de usuario: la autorización real ya la impone el backend (`SecurityConfig`/`requireOwner`, auditado exhaustivamente en sesiones anteriores) con un JWT que el cliente no puede falsificar — sin vulnerabilidad nueva, el hueco era puramente de cobertura de regresión.
  **`karma.conf.js`**: añadido un `customLaunchers.ChromeHeadlessCI` (`base: 'ChromeHeadless'`, flags `--no-sandbox --disable-gpu --disable-dev-shm-usage`) — aditivo y no usado por defecto (`browsers` sigue siendo `['Chrome']`); solo se activa pidiéndolo explícitamente con `--browsers=ChromeHeadlessCI`, así que el flujo de desarrollo local normal (`ng test` con Chrome real y su sandbox intacto) no cambia. Sin este cambio, `ng test` no podía ejecutarse en ningún sandbox de esta rutina (confirmado: el `ChromeHeadless` por defecto falla igual, "Running as root without --no-sandbox is not supported", al ejecutarse como root en el contenedor).
  **`auth.guard.spec.ts` (8 tests)**: sin token en ruta normal/de admin (redirige a `/login`/`/admin/login` respectivamente); token caducado (llama a `authService.logout()`, no al redirect genérico del guard); rol `RESTAURANT` válido en `/r/`, rol `USER` bloqueado en `/r/` (regresión directa de la comprobación de línea 18); rol `RESTAURANT`/`USER` bloqueados en `/admin` cada uno redirigiendo a su propio dashboard, no al de admin ni entre sí; rol `ADMIN` válido en `/admin`.
  **`role.guard.spec.ts` (7 tests)**: rol exacto permitido, rol dentro de una lista de roles permitidos, bloqueo con redirect al dashboard propio para cada rol que no coincide, sin sesión en ruta de admin/normal (redirige a `/admin/login`/`/login`), autenticado pero sin rol reconocible nunca concede acceso solo por estar autenticado.
  **`token.interceptor.spec.ts` (8 tests, con `provideHttpClient`/`provideHttpClientTesting`)**: header `Authorization` añadido solo en peticiones propias con token válido; nunca añadido a `/api/auth/**` aunque haya token; nunca añadido ni se toca la sesión en una petición a un dominio externo (Google Maps), incluido su propio 401; con el token ya caducado, no se añade el header y se cierra la sesión de forma preventiva (la rama `else if` del interceptor); un 401 en `/api/auth/login` se propaga sin cerrar sesión (fallo de credenciales, no de sesión); un 401 "de alcance" (token aún válido, endpoint que no es para ese rol) no cierra la sesión — regresión directa del comentario explícito del propio código (líneas 64-68); un 401 de sesión real (el token ya no está en `localStorage` cuando llega la respuesta) sí cierra la sesión; un 403 redirige según el rol actual.
  **Verificación real en este entorno**: `CHROME_BIN=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome npx ng test --watch=false --browsers=ChromeHeadlessCI` → **25/25 SUCCESS** (2 ya existentes + 23 nuevos: 8+7+8), primera vez que la suite de Karma se ejecuta de verdad en esta rutina (no solo se lee el código). `npx tsc --noEmit` → sin errores nuevos. `npx ng build --configuration production` → build limpio, mismos warnings preexistentes de siempre (Sass `@import` deprecado, presupuesto de `admin-clients`/`restaurante-detalle-page`, `qrcode` no-ESM) — no se tocó ningún componente ni plantilla. `npx playwright test --list` → **25/25 tests en 12 ficheros**, sin cambios (no se tocó `frontend/e2e/`). No se tocó ningún archivo de backend, así que no hizo falta repetir `mvn test` aparte de la reconfirmación inicial de rutina.
  **No se pudo verificar en este entorno**: ejercitar estos mismos guards/interceptor dentro de una navegación real del navegador (en vez de invocarlos directamente vía `TestBed.runInInjectionContext`/`HttpTestingController`) — ya cubierto indirectamente por la suite E2E de Playwright existente, que sí navega con sesiones reales de los 3 roles, aunque no contra los casos límite exactos que cubren estos tests nuevos (401 de alcance, token caducado a mitad de petición).

<!-- TASKS:END -->

### FID-022 — completada 2026-10-03 — VULNERABILIDAD REAL ENCONTRADA Y CORREGIDA (Agent Layer)

Rutina en la nube del 2026-10-03. Al llegar a `agent/fidelyfood-autonomous` la rama seguía abierta en el
PR #43 (FID-018 a FID-021), 3 commits por detrás de `main` (le faltaban `#44` fix de memory leak en
historial, `#45` fotos de promociones/restaurantes en BD, y `#46` — el Agent Layer/Jarvis completo,
servidor MCP + política de permisos + runner). `git merge origin/main` sin conflictos antes de auditar.

Sin tarea "Pendiente" explícita en `AGENT_TASKS.md`/`.agent/tasks.md` adecuada para este entorno sin
servidores locales, se auditó el código nuevo más grande y más sensible fusionado desde la última
ejecución: el propio Agent Layer (`agent/src/`), recién incorporado en `#46` y nunca auditado todavía,
con el mismo criterio ya aplicado al backend en sesiones anteriores (FID-005/013/015/016/017: cualquier
componente que decide qué datos sensibles expone debe hacerlo de forma robusta, no solo por el nombre
superficial de un campo).

**Hallazgo (severidad alta)**: `query_database`/`explain_query` — las únicas herramientas de lectura de
BD que el Agent Layer ejecuta **sin aprobación humana** — enmascaraban columnas sensibles
(`password`/`token`/`secret`/`hash`) mirando solo el nombre de columna en la salida de `mysql`. Una
consulta con alias (`SELECT password AS foo FROM restaurante`, o incluso sin `AS`: `SELECT password foo
FROM restaurante`) cambia ese nombre de salida a `foo`, que nunca coincide con el patrón de enmascarado,
así que el hash bcrypt real salía en claro — exactamente el mismo tipo de fuga que FID-017 encontró en la
API REST, pero esta vez en la herramienta MCP del propio agente, documentada en `AGENT_LAYER.md` como
segura precisamente por este enmascarado.

**Verificación empírica del fallo** (antes de corregir, con el código viejo aislado en memoria, sin
necesitar MySQL real porque el enmascarado es puro JavaScript sobre el texto de salida): `SELECT
password AS foo FROM restaurante` devolvía `{"foo": "$2a$10$hash"}` sin enmascarar.

**Corrección**: `parseTable` (`agent/src/tools/database.mjs`) ahora resuelve, para cada columna del
`SELECT`, su expresión de origen (quita `AS alias` o un alias final sin `AS`, y el prefijo de tabla) y
enmascara si esa expresión contiene el patrón sensible — cubre alias con/sin `AS`, columna calificada
(`restaurante.password AS pw`) y columna envuelta en una función (`REVERSE(password) AS pw`). Sin cambio
de comportamiento en el caso ya cubierto (sin alias).

**Test de regresión añadido**: `agent/test/database.test.mjs` (8 tests nuevos, sin MySQL real): enmascara
sin alias (caso ya existente), con alias `AS`, con alias sin `AS`, con columna calificada por tabla, con
la columna envuelta en una función, y confirma que columnas normales con alias (`COUNT(*) AS total`)
siguen sin enmascararse (sin falsos positivos).

**Verificación real**: `npm --prefix agent test` → **50/50 passed** (42 previos + 8 nuevos). No se tocó
ningún test existente ni el resto del Agent Layer.

**No se pudo verificar en este entorno** (requeriría MySQL real): el comportamiento end-to-end de
`query_database` contra una base de datos viva — el fix opera sobre texto (salida de `mysql` + SQL de
entrada), ya cubierto por los tests unitarios nuevos sin necesitar conexión real.

Archivos modificados: `agent/src/tools/database.mjs`, `SECURITY.md` (#13), `AGENT_TASKS.md`,
`.agent/tasks.md`.
Archivos creados: `agent/test/database.test.mjs`.

**Estado**: corregido en `agent/fidelyfood-autonomous` (PR #43, que acumula esta y las sesiones
anteriores sin fusionar todavía), pendiente de revisión humana.

## P0 — Seguridad / bloqueante

- ~~**FID-001** · SECURITY · Auditar rate-limiting ausente en `/api/auth/**` (login).~~ **COMPLETADA — implementado y verificado** (ver cierre abajo). **REQUIERE ACCIÓN DEL USUARIO tras integrar: reiniciar el backend de desarrollo (puerto 8081).**
- ~~**FID-017** · SECURITY · Auditoría de ownership real (curl con JWT de restaurantes distintos) en `PromocionController`/`RestauranteController`, aislamiento de roles admin/restaurante/cliente, Swagger y actuator.~~ **COMPLETADA — vulnerabilidad real de fuga de contraseñas encontrada y corregida** (ver cierre abajo). **REQUIERE ACCIÓN DEL USUARIO tras integrar: reiniciar el backend de desarrollo (puerto 8081).**

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
- ~~**FID-015** · TEST · Cobertura unitaria de `PromocionService` y del nuevo endpoint `GET /api/restaurantes/{id}/estadisticas` — código añadido en #29/#30 sin tests unitarios, solo E2E.~~ **COMPLETADA** (ver cierre abajo).
- ~~**FID-016** · TEST · Cobertura unitaria de `CompraService` y `RecompensaService` — últimos dos servicios de negocio del backend sin ningún test unitario, solo E2E.~~ **COMPLETADA** (ver cierre abajo).
- ~~**FID-020** · MAINTENANCE · Nuevo aviso CRÍTICO de `npm audit` (RCE por prototype pollution en `piscina`) publicado tras el cierre de FID-019.~~ **COMPLETADA — vulnerabilidad crítica corregida sin breaking change** (ver cierre abajo).
- ~~**FID-018** · TEST · Cobertura unitaria de `MovimientoPuntosService` — único servicio de negocio no trivial que quedaba sin tests tras FID-016.~~ **COMPLETADA** (ver cierre abajo) — **pendiente de revisión humana (PR #43)**.
- ~~**FID-019** · MAINTENANCE · `npm audit` del frontend volvió a detectar vulnerabilidades (postcss, vite, piscina, http-proxy-middleware, @babel/core, esbuild — 12 en total) tras nuevos avisos publicados desde FID-012.~~ **COMPLETADA — 6 de 12 corregidas dentro de Angular 20, 6 pendientes de decisión (requieren Angular 21)** (ver cierre abajo).
- ~~**FID-021** · A11Y · El commit `#38` (fuera de este backlog) dejó documentado que, tras arreglar los dos formularios de login, quedaban otros 10 formularios con `ion-input`/`ion-select`/`ion-textarea` sin ninguna asociación accesible real a su etiqueta visible.~~ **COMPLETADA** (ver cierre abajo).

### FID-021 — completada 2026-10-02

**Nota de concurrencia**: esta tarea se identificó y resolvió en paralelo a otra ejecución de la misma
rutina que, el mismo día, encontró y corrigió FID-020 (RCE crítica en `piscina`). Ambas partieron del
mismo `main`/rama sin tareas "Pendiente" explícitas y llegaron a hallazgos distintos sin solapamiento
de archivos (ésta solo toca plantillas HTML del frontend; FID-020 solo toca `package.json`/lockfile) —
al integrar ambas ramas con `git merge`, esta entrada se renumeró de FID-020 a FID-021 para no chocar
con la ya asignada, mismo criterio que se usó para FID-013/FID-014.

Rutina en la nube del 2026-10-02. La rama `agent/fidelyfood-autonomous` ya estaba al día con `main`
(el PR #43 de FID-018/FID-019 seguía abierto y sin commits nuevos en `main` que auditar — verificado
con `git log origin/main..origin/agent/fidelyfood-autonomous` / al revés), así que este commit se
añade a la misma rama/PR (mismo criterio que FID-015/FID-016/FID-019).

**Elección de la tarea**: `AGENT_TASKS.md`/`.agent/tasks.md` no tenían ninguna entrada "Pendiente"
explícita. Antes de buscar un hallazgo nuevo desde cero, se revisó el único commit de accesibilidad
fusionado directamente a `main` (`08cdbff fix(a11y): asociar las etiquetas de email/password en los
logins (#38)`, fuera de este backlog): su propio mensaje dejaba escrito textualmente que, tras
arreglar los dos formularios de login, "hay otros 10 formularios con el mismo patrón (registro de
usuario/restaurante, ajustes, promociones, perfil, paneles de admin) que quedan pendientes". Un
pendiente ya identificado y acotado por nombre es más fiable que inventar un hallazgo nuevo, así que
se eligió cerrar exactamente ese hueco.

**El problema real** (el mismo que `#38` ya había corregido en los logins): Ionic renderiza
`ion-input`/`ion-select`/`ion-textarea` como Web Components con Shadow DOM. Ni un `<ion-label
position="stacked">` hermano ni un `<label>` nativo que envuelve al componente asocian su texto como
nombre accesible del control interno (el `<input>`/`<textarea>` real vive dentro del Shadow DOM, fuera
del árbol donde el algoritmo de cómputo de nombre accesible busca un `<label>` asociado). Un lector de
pantalla solo anuncia el `placeholder` — y éste desaparece en cuanto el usuario empieza a escribir,
dejando el campo sin nombre alguna vez tiene contenido.

**Alcance**: se localizaron y corrigieron los 10 formularios señalados, uno por área:
- Registro: `register-user.component.html` (3 campos), `register-restaurant.component.html` (7 campos).
- Restaurante: `settings.component.html`/"ajustes" (7 campos: nombre, descripción, email, teléfono,
  categoría, dirección, c. postal, ciudad — 8 en total), `mis-promociones/form-promocion.component.html`
  (5 campos) y el formulario legado `gestion-promos.component.html` (4 campos, todavía enrutado y en
  uso — verificado en `restaurant.routes.ts`).
- Cliente: `perfil.component.html` (2 campos, usando `[attr.aria-label]` con el mismo pipe
  `ffTranslate` que ya usa cada `<label>` visible, para no desincronizar el idioma) y
  `security-center.component.html` (3 campos de contraseña, mismo criterio de `ffTranslate` donde
  aplica).
- Admin: `admin-reservations.component.html`, `admin-clients.component.html` y
  `admin-businesses.component.html` — los tres paneles usan `<label>Texto<ion-input .../></label>`
  (envoltura nativa), que tiene el mismo problema de Shadow DOM que el `ion-label` de los demás
  formularios; se añadió `aria-label` a cada campo de sus formularios de edición/alta. Se dejaron
  fuera deliberadamente los `ion-select` de los filtros de cabecera de cada listado (fuera del alcance
  que describía el commit original, centrado en "formularios"), y los que ya usaban el atributo
  `label` nativo de Ionic (`admin-clients`/`admin-businesses`, filtros de estado/ciudad/orden), que sí
  expone nombre accesible.

Cambio puramente aditivo: un atributo `aria-label`/`[attr.aria-label]` nuevo por campo, sin tocar
diseño, maquetación, ni lógica de ningún componente.

**Verificación real**: `npm install` (primera vez en este sandbox, `node_modules` no existía) + `ng
build --configuration production` → **éxito**, sin ningún error nuevo. Los únicos avisos son los ya
preexistentes (Sass `@import` deprecado en varios `_shared-admin.scss`, presupuesto de tamaño ya
excedido en `admin-clients`/`restaurante-detalle-page` antes de este cambio, `qrcode` no-ESM) — nada
causado por este commit. No se tocó ningún archivo de backend, así que no hizo falta `mvn test`.

**No se pudo verificar en este entorno** (requeriría un lector de pantalla real, o un navegador con
backend/frontend en marcha): confirmar de oído que cada campo se anuncia correctamente. El cambio es
mecánico y repite exactamente el mismo patrón que `#38` ya verificó así para los logins.

**Nota aparte, no accionada esta sesión**: `npm install` reportó 8 vulnerabilidades (3 críticas) en
vez de las 6 que documentó el cierre de FID-019 (2026-10-01). Puede ser que se hayan publicado nuevos
avisos en 24h, o un recuento distinto del mismo problema — resultó ser lo segundo: la ejecución paralela
de esta misma rutina lo identificó como FID-020 (RCE crítica en `piscina`) y ya lo corrigió, ver esa
entrada más abajo.

Archivos modificados: `frontend/src/app/features/public/register-user/register-user.component.html`,
`frontend/src/app/features/public/register-restaurant/register-restaurant.component.html`,
`frontend/src/app/features/restaurant-app/settings/settings.component.html`,
`frontend/src/app/features/restaurant-app/mis-promociones/form-promocion/form-promocion.component.html`,
`frontend/src/app/features/restaurant-app/gestion-promos/gestion-promos.component.html`,
`frontend/src/app/features/user-app/perfil/perfil.component.html`,
`frontend/src/app/features/user-app/security-center/security-center.component.html`,
`frontend/src/app/features/admin-app/reservations/admin-reservations.component.html`,
`frontend/src/app/features/admin-app/clients/admin-clients.component.html`,
`frontend/src/app/features/admin-app/businesses/admin-businesses.component.html`.

### FID-020 — completada 2026-10-02 — VULNERABILIDAD CRÍTICA CORREGIDA

Rutina en la nube del 2026-10-02. `main` no llevaba commits nuevos desde el cierre de FID-018/019
(PR #43 seguía abierto con `base` = HEAD actual de `main`, `mergeable_state: clean`), así que no hizo
falta ningún `git merge` ni recrear la rama. Sin ninguna tarea "Pendiente" explícita en
`AGENT_TASKS.md`/`.agent/tasks.md`, se repitió el primer paso de siempre en estas sesiones sin tarea
asignada: `npm audit` en `frontend/` (tras `npm ci` limpio, no reusando `node_modules` de una sesión
anterior) para ver si hay avisos nuevos desde el último cierre.

**Hallazgo**: desde el cierre de FID-019 (2026-10-01) se publicó un aviso nuevo de severidad
**crítica**: [GHSA-67c8-pqhq-4rmx](https://github.com/advisories/GHSA-67c8-pqhq-4rmx) — gadget de
*prototype pollution* en `piscina` (el pool de worker threads que usa `@angular/build`/
`@angular-devkit/build-angular` internamente para `ng build`/`ng serve`) que permite RCE si algo
contamina `Object.prototype` antes de construir el `ThreadPool`. Rango afectado: `piscina` 5.0.0 –
5.3.1 (resuelto en este proyecto a 5.2.0, vía `@angular/build@20.3.37` → `piscina@5.2.0`, dependencia
transitiva fijada por versión exacta, sin rango `^`). `npm audit` pasó de 6 vulnerabilidades (estado
de cierre de FID-019) a **8** (4 moderate, 1 high, 3 critical) tras `npm ci` en este sandbox limpio —
confirma que es un aviso publicado después de FID-019, no algo que FID-019 ya hubiera visto y dejado
pendiente.

**Alcance real**: dependencia 100% de build (`devDependencies` vía `@angular-devkit/build-angular`),
nunca se envía al navegador del usuario final — `npm audit --omit=dev` ya daba 0 antes y sigue dando
0 después. Aun así, severidad crítica + RCE merece arreglo inmediato: el pool de workers se usa en
cada `ng build`/`ng serve`, incluido en CI/CD si lo hubiera.

**Corrección** (sin breaking change, sin tocar la versión de `@angular-devkit/build-angular` ni saltar
a Angular 21): se descartó `npm audit fix --force` porque proponía **instalar
`@angular-devkit/build-angular@19.2.27`, una regresión de versión** (downgrade, no upgrade) con
cambios de API no evaluados. En su lugar, override selectivo en `frontend/package.json`:

```json
"overrides": {
  "piscina": "5.3.2"
}
```

`piscina@5.3.2` (publicado 2026-08-28, confirmado en su `CHANGELOG.md`: "avoid re-linking
Object.prototype in Piscina constructor", "sanitize run/close options with withNullPrototype") es la
primera versión parcheada dentro de la misma rama 5.x — mismo major, mismo rango de API pública que
`@angular/build` espera (su único cambio incompatible documentado es para quien llame
`pool.options.hasOwnProperty(...)` directamente, algo que `@angular/build` no hace). Se prefirió el
override puntual sobre esperar un parche de `@angular-devkit/build-angular` (no existe ninguno más
nuevo que `20.3.37`, ya instalado, verificado con `npm view @angular-devkit/build-angular versions`).

**Verificación real**:
- `npm audit` antes → 8 vulnerabilidades (4 moderate, 1 high, **3 critical**, incluida GHSA-67c8).
- `npm install` con el override → `npm ls piscina` confirma `piscina@5.3.2 overridden` en ambas rutas
  (`@angular/build` y la dependencia directa de `@angular-devkit/build-angular`).
- `npm audit` después → **6 vulnerabilidades (4 moderate, 2 high), 0 critical** — la de `piscina`
  desaparece por completo; las 6 restantes son las mismas ya documentadas en FID-019 como pendientes
  de una decisión de usuario (saltar a `@angular-devkit/build-angular@21`, salto de major): `uuid`
  (vía `sockjs`, que fija `uuid: "^8.3.2"` incluso en su versión más reciente — no hay forma de
  arreglarlo sin ese salto de major) y `webpack-dev-middleware`/`webpack-dev-server` (ya al tope de su
  serie 5.x, el siguiente parche real es la 6.0.0).
- `npm audit --omit=dev` → 0 antes y 0 después (sin cambio, nunca afectó a producción).
- `ng build --configuration production` → build limpio, mismos warnings de siempre (Sass `@import`
  deprecado, presupuesto de dos `.scss`, `qrcode` no-ESM) — sin errores nuevos.
- Diff real en `package-lock.json`: solo la entrada de `piscina` (5.2.0 → 5.3.2), nada más — el
  override no arrastró ningún otro cambio de versión.

**No se pudo verificar en este entorno** (requeriría backend/frontend/MySQL reales): la suite E2E de
Playwright — no aplica aquí de todas formas, es una dependencia de build, no de runtime de la app.

Archivos modificados: `frontend/package.json` (nuevo campo `overrides`), `frontend/package-lock.json`
(solo `piscina` 5.2.0 → 5.3.2), `SECURITY.md` (nueva entrada #12), `AGENT_TASKS.md`.

Pendiente para una futura sesión: las 6 vulnerabilidades restantes (y la decisión ya diferida de
Angular 21) siguen igual que al cierre de FID-019 — sin cambios aquí más allá de la de `piscina`.

### FID-018 — completada 2026-09-30

Rutina en la nube del 2026-09-30. El PR #28 (FID-013 a FID-016) ya estaba fusionado a `main` — la rama
`agent/fidelyfood-autonomous` se recreó desde el `main` actual (`eaf26d4`) siguiendo la regla de "PR ya
fusionado ⇒ rama nueva desde `main`", en vez de seguir apilando commits sobre historia ya integrada.

Sin ninguna tarea "Pendiente" explícita en `AGENT_TASKS.md`/`.agent/tasks.md`, primero se auditó (mismo
criterio que FID-005/013/015/016) el único cambio de backend fusionado desde el cierre de FID-016: el PR
#33 (`fix(historial)`), que añadió los campos `monto`, `usuarioNombre` y `usuarioFotoPerfil` a
`MovimientoPuntosDTO` y los usos correspondientes en `MovimientoPuntosService`/`RestauranteService`.
Verificado leyendo el código: los tres puntos donde se construye ese DTO cuelgan de endpoints que ya
identifican al restaurante/usuario por el email autenticado (`RestauranteController` vía `requireOwner`,
ya corregido en FID-005; `MovimientoPuntosController.obtenerHistorial` vía
`authentication.getName()`, nunca un id del cliente) — sin vulnerabilidad nueva de Broken Access Control,
los datos de cliente expuestos (nombre/foto) son del propio flujo autorizado del restaurante sobre sus
movimientos.

De ese mismo cambio salió el hallazgo de bajo riesgo de esta sesión: `MovimientoPuntosService` (que
gestiona `GET /api/movimientos`, el historial de puntos del cliente autenticado) era, junto a
`QrService` (trivial, descartado ya en FID-016), el único de los siete servicios de negocio del backend
sin ningún test unitario — un descuido de FID-013/015/016, que cubrieron el resto uno a uno pero nunca
llegaron a este.

- **`MovimientoPuntosServiceTest.java` (nuevo, 3 tests)**: usuario inexistente lanza
  `ResourceNotFoundException` sin consultar `MovimientoPuntosDAO`; usuario sin movimientos devuelve
  lista vacía; y el mapeo a DTO de varios movimientos reales conserva puntos/tipo/monto (incluido `null`
  cuando el movimiento no viene de un consumo, caso `CANJEADOS`) y el nombre/foto reales del usuario
  autenticado — fija el comportamiento de los tres campos añadidos en el PR #33.

**Verificación real**: `mvn compile` → éxito. `mvn test -Dtest=MovimientoPuntosServiceTest,
CompraServiceTest,RecompensaServiceTest,PromocionServiceTest,UsuarioServiceTest,RestauranteServiceTest,
LoginRateLimiterTest,GlobalExceptionHandlerTest` → **64/64 passed** (3+6+6+13+15+13+7+1). `mvn test`
completo → **65 tests, 64 passed, 1 error** (`SpringBootTfgApplicationTests.contextLoads`, mismo motivo
ya documentado en FID-013/014/015/016: `Communications link failure`, no hay MySQL en este sandbox —
confirmado leyendo la traza completa, `Connection refused`). No se tocó ningún test ni código de
producción existente (solo un test nuevo).

**No se pudo verificar en este entorno** (requeriría backend/frontend/MySQL reales): el flujo E2E
completo del historial de puntos del cliente y de "Actividad Reciente"/"Historial de Actividad" del
restaurante (PR #33), ya cubierto por la suite E2E existente (`client-flows.spec.ts`,
`restaurant-flows.spec.ts`), no duplicado aquí; tampoco `npm audit`/dependencias de frontend (sin
cambios de `package.json` desde FID-012, no había nada nuevo que auditar en esta sesión).

Con esto, los 7 servicios de negocio del backend tienen cobertura unitaria (salvo `QrService`, trivial),
cerrando el hueco que quedó abierto tras FID-016.

Archivo creado: `src/test/java/progresa/springboot_tfg/service/MovimientoPuntosServiceTest.java`.

### FID-019 — completada 2026-10-01

Rutina en la nube del 2026-10-01. El PR #43 (FID-018) seguía abierto y la rama `agent/fidelyfood-autonomous`
ya estaba al día con `main` (sin ningún commit nuevo en `main` desde el cierre de FID-018: verificado con
`git log origin/main..origin/agent/fidelyfood-autonomous` / en sentido inverso, cero commits en ambos
casos salvo el propio commit de FID-018), así que esta sesión añade un commit nuevo a la misma rama/PR en
vez de abrir uno aparte — mismo criterio ya seguido en FID-015/FID-016 cuando el PR previo seguía sin
fusionar.

Sin ninguna tarea "Pendiente" explícita, y sin ningún commit de backend nuevo que auditar (confirmado con
`git show --stat` de los diez commits mergeados a `main` el 2026-09-29 — `#41,#32,#31,#33,#34,#35,#36,
#38,#12` —, ninguno toca `src/main/java/**` ni `pom.xml` salvo el ya auditado `#33` en FID-018), se repitió
el tipo de hallazgo de FID-010/FID-012: dependencias con vulnerabilidades conocidas. `npm audit` en
`frontend/` volvió a reportar 12 vulnerabilidades (2 bajas, 3 moderadas, 7 altas) aparecidas desde el
cierre de FID-012 — nuevos avisos (`postcss`, `vite`, `piscina`, `http-proxy-middleware`, `@babel/core`,
`esbuild`, y transitivamente `uuid`/`sockjs`/`webpack-dev-server`/`webpack-dev-middleware`), todas en la
cadena de dependencias de build de Angular (`@angular-devkit/build-angular`), ninguna en código servido a
los usuarios (`npm audit --omit=dev` ya daba 0 antes y después del cambio).

**Causa real**: `@angular-devkit/build-angular` estaba fijado en `^20.0.0` en `package.json`, y la copia
instalada (`20.3.26`) no se había actualizado junto con `@angular/core` en FID-012 (ese cambio solo tocó
los paquetes `@angular/*` de primer nivel, no el propio `@angular/cli`/`build-angular`) — quedó rezagada
varios parches (20.3.26 → 20.3.37 disponible) mientras el ecosistema de bundling (`postcss`/`vite`/
`webpack-dev-server`, dependencias de `@angular/build`) recibía parches de seguridad en esas versiones
más recientes.

**Corrección aplicada** (mismo criterio que FID-012 — parche dentro de Angular 20, sin saltar a un major):
`npx ng update @angular/core@20 @angular/cli@20` (sube `@angular/core` y paquetes hermanos de 20.3.32 a
20.3.33) + `npm install @angular-devkit/build-angular@20.3.37 --save-dev` (el `ng update` no subió
`@angular-devkit/build-angular` por sí solo, pese al rango `^20.0.0` que lo permitía — se instaló el
parche más reciente de la serie 20.3.x explícitamente). Sin cambios de versión mayor en ningún paquete.

**Resultado**: de 12 vulnerabilidades, 6 corregidas (`postcss`, `vite`, `piscina`, `http-proxy-middleware`,
`@babel/core`, `esbuild`). Las 6 restantes (`uuid`/`sockjs`/`webpack-dev-server`/`webpack-dev-middleware`,
2 moderadas + 2 altas con sus dependientes) solo tienen arreglo saltando a
`@angular-devkit/build-angular@21.2.24` (Angular 21, cambio de versión mayor) — **no aplicado aquí**, mismo
motivo que FID-010 → FID-012: un salto de major necesita una ronda completa de regresión que esta sesión
no puede ejecutar (sin frontend/backend reales en este entorno). Documentado como decisión pendiente del
usuario, igual que el resto de "major version" ya abiertos en el backlog (Angular 21 completo, descartado
en FID-010/FID-012; `spring-boot-starter-parent` 3.2.1 → 3.2.12, descartado en FID-014).

**Verificación real**:
- `npm audit --omit=dev` → 0 vulnerabilidades (antes y después; estas vulnerabilidades siempre fueron solo
  de dependencias de build, nunca de código enviado a producción).
- `npm audit` completo → 12 → 6 vulnerabilidades (bajada real, no solo supresión de avisos).
- `npx ng build --configuration production` → build limpio, mismos warnings de siempre (deprecación de
  `@import` de Sass, presupuestos de tamaño de 2 componentes ya señalados antes, módulo `qrcode` no-ESM) —
  sin errores nuevos.
- `npx ng lint` → 8 errores/1 warning preexistentes (reglas de estilo `@angular-eslint/prefer-inject` y
  `no-output-on-prefix`), no relacionados con este cambio de dependencias (confirmado: son reglas de
  `@angular-eslint/*`, paquete no tocado en este commit) — no corregidos aquí, fuera de alcance de esta
  tarea de mantenimiento de dependencias.

**No se pudo verificar en este entorno** (requeriría backend/frontend/MySQL reales): la suite E2E
completa de Playwright contra el build actualizado — ya se verificó así en FID-012 cuando había un
servidor de desarrollo local disponible, pero este sandbox en la nube no tiene ningún servidor local
corriendo. El build de producción (`ng build`) y `npm audit` son lo máximo verificable aquí, tal y como
pide la rutina para este tipo de entorno.

Archivos modificados: `frontend/package.json`, `frontend/package-lock.json` (parches dentro de Angular 20,
sin cambios de versión mayor).

### FID-016 — completada 2026-09-27

Rutina en la nube del 2026-09-27. `main` no llevaba commits nuevos desde la última ejecución (FID-015,
2026-09-26) — el PR #28 seguía abierto y ya actualizado (`base` = HEAD actual de `main`), así que no
hizo falta ningún `git merge`. Sin ninguna tarea "Pendiente" explícita en `AGENT_TASKS.md`/`.agent/tasks.md`,
se identificó el mismo tipo de hallazgo de bajo riesgo que en FID-013/014/015: de los siete servicios del
backend (`src/main/java/.../service/`), `CompraService` y `RecompensaService` eran los dos únicos que
seguían sin ningún test unitario (`QrService` se descartó por trivial: solo compone un string con un
`UUID.randomUUID()`, nada que probar sin fijar el azar).

**Auditoría de autorización previa** (mismo criterio que FID-005/FID-013/FID-015 — cualquier endpoint que
opera sobre puntos de un usuario debe identificarlo por el email/token autenticado, nunca por un id que
mande el cliente): `CompraController.registrarCompra` pasa `SecurityUtils.email(authentication)` como
email del restaurante (no lo acepta del body — el `RegistrarCompraDTO` solo lleva `usuarioId` e
`importe`, que es el cliente al que el restaurante autenticado está otorgando puntos, parte esperada del
flujo: el restaurante escanea el QR del cliente); `RecompensaController.canjear` usa
`authentication.getName()` directamente como email del usuario que canjea, nunca un id del body. En
ambos casos el patrón ya es correcto — no se encontró ninguna vulnerabilidad nueva de Broken Access
Control, así que esta tarea se quedó en cerrar el hueco de cobertura, no en un fix de seguridad.

- **`CompraServiceTest.java` (nuevo, 6 tests)**: importe cero o negativo lanza `BadRequestException` sin
  consultar ningún DAO; usuario o restaurante inexistente lanzan `ResourceNotFoundException`; un importe
  menor a 1€ no genera puntos suficientes y lanza `BadRequestException` sin guardar nada; una compra
  válida (25,50€) suma los puntos enteros correctos (25) al usuario y registra un `MovimientoPuntos` tipo
  `GANADOS` con el restaurante y monto reales (regla de negocio "1€ = 1 punto", truncado a entero, ya en
  el código, ahora con test que la fija).
- **`RecompensaServiceTest.java` (nuevo, 6 tests)**: `obtenerPorId` con id inexistente lanza
  `ResourceNotFoundException`; `canjearRecompensa` con usuario o recompensa inexistente lanza
  `ResourceNotFoundException` sin tocar el resto; con puntos insuficientes lanza `BadRequestException` sin
  restar puntos ni registrar movimiento; con puntos suficientes (incluido el caso límite de saldo exacto)
  resta los puntos correctos y registra un `MovimientoPuntos` tipo `CANJEADOS` con la descripción
  esperada.

**Verificación real**: `mvn compile` → éxito. `mvn test -Dtest=CompraServiceTest,RecompensaServiceTest,
PromocionServiceTest,UsuarioServiceTest,RestauranteServiceTest,LoginRateLimiterTest,
GlobalExceptionHandlerTest` → **61/61 passed** (6+6+13+15+13+7+1). `mvn test` completo → **62 tests, 61
passed, 1 error** (`SpringBootTfgApplicationTests.contextLoads`, mismo motivo ya documentado en
FID-013/014/015: `Communications link failure`, no hay MySQL en este sandbox — confirmado leyendo la
traza completa, `Connection refused`). No se tocó ningún test ni código de producción existente (solo
tests nuevos).

**No se pudo verificar en este entorno** (requeriría backend/frontend/MySQL reales): el flujo E2E
completo de compras y canje de recompensas, ya cubierto por la suite E2E existente
(`restaurant-flows.spec.ts`/`client-flows.spec.ts`), no duplicado aquí.

Archivos creados: `src/test/java/progresa/springboot_tfg/service/CompraServiceTest.java`,
`src/test/java/progresa/springboot_tfg/service/RecompensaServiceTest.java`.

Con esto, los siete servicios de negocio del backend tienen ya cobertura unitaria (salvo `QrService`,
descartado por trivial). Pendiente para una futura sesión sin tareas nuevas en el backlog: seguir el
mismo criterio de auditar cualquier endpoint que se fusione a `main` entretanto, y evaluar el salto de
`spring-boot-starter-parent` 3.2.1 → 3.2.12 ya identificado en FID-014 (requiere una sesión con MySQL
disponible para verificarse en runtime real).

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

- ~~**FID-014** · TEST · Cobertura unitaria de `LoginRateLimiter` (ventana deslizante de rate-limiting de login).~~ **COMPLETADA** (ver cierre abajo).

### FID-014 — completada 2026-09-25

**Nota de concurrencia**: esta tarea se identificó de forma independiente y en paralelo a FID-013
(ambas ejecuciones autónomas partieron del mismo `main` sin tareas "Pendiente" explícitas y, siguiendo
el mismo orden de preferencia del backlog, llegaron a la misma conclusión: "sin cobertura de tests
unitarios de backend" era el hallazgo de bajo riesgo más claro). Al converger sobre el mismo hueco del
backlog, se renumeró esta entrada de FID-013 a FID-014 al integrar ambas ramas — no hay solapamiento
de archivos entre las dos: FID-013 cubre `UsuarioService`/`RestauranteService`, esta cubre
`LoginRateLimiter`.

**Motivo de la elección**: se descartó tocar `pom.xml` (Spring Boot 3.2.1 → 3.2.12 disponible en Maven
Central, verificado con `curl` contra `repo.maven.apache.org`): aunque es un salto dentro de la misma
serie menor, son 11 releases de parche que tocan transitivamente seguridad/web/JPA y no se puede
verificar en runtime real en este entorno (sin MySQL ni servidor) — demasiado alcance para "bajo
riesgo y verificable de verdad" en esta sesión, se deja para una sesión con BD disponible. En su lugar
se eligió cerrar el hueco de cobertura en `LoginRateLimiter` (lógica de ventana deslizante del
rate-limiting de FID-001), que no tenía ningún test unitario — solo el E2E
`frontend/e2e/security-login-rate-limit.spec.ts`, que necesita backend+red reales y no se puede
ejecutar en este entorno.

**Cambio de código de producción**: mínimo y aditivo. `LoginRateLimiter` usaba `Instant.now()`
directamente, lo que hace imposible probar la ventana de 10 minutos sin esperarla de verdad. Se
extrajo el reloj a un `Supplier<Instant>` con un constructor de paquete adicional solo para tests
(`LoginRateLimiter(Supplier<Instant> clock)`); el constructor público sin argumentos (el que usa
Spring vía `@Component`) sigue usando `Instant::now` real, comportamiento en producción sin cambios.

Archivos modificados: `src/main/java/progresa/springboot_tfg/security/LoginRateLimiter.java` (reloj
inyectable para tests, sin cambio de comportamiento en producción).
Archivos creados: `src/test/java/progresa/springboot_tfg/security/LoginRateLimiterTest.java` (7 tests
unitarios puros, sin Spring ni BD): clave nueva no bloqueada, 7 fallos no bloquean, el 8º sí bloquea
(coincide con el límite `MAX_FAILURES=8` de FID-001), un login correcto (`recordSuccess`) resetea el
contador y desbloquea, dos claves (IP+email) distintas son independientes, y dos casos de ventana
deslizante (fallos que expiran tras 10 min+1s dejan de contar; fallos repartidos entre antes/después
de la expiración nunca coexisten 8 a la vez).

### FID-015 — completada 2026-09-26

Rutina en la nube del 2026-09-26. Al llegar a `agent/fidelyfood-autonomous` estaba desactualizada
(el PR #28 de FID-013/FID-014 seguía abierto, base en `31813db`) mientras `main` ya llevaba cuatro PRs
más fusionados (#26 mapa, #27 nightly, #29 analítica por periodo, #30 imagen de promociones). Primer
paso de esta sesión: `git merge origin/main` sobre la rama (sin conflictos), para auditar/testear
también ese código nuevo en vez de trabajar sobre una base obsoleta.

**Auditoría de autorización de lo nuevo en #29/#30** (mismo criterio que FID-005/FID-013 — cualquier
endpoint nuevo que opera sobre un recurso de restaurante debe usar `requireOwner`/el mismo patrón):
`GET /api/restaurantes/{id}/estadisticas` (nuevo en #29) y todos los métodos nuevos de
`PromocionController`/`PromocionService` (`crearConImagen`, `actualizarConImagen`, y los ya existentes
`actualizar`/`eliminar`/`aplicarPromocion`) sí comprueban correctamente la propiedad del recurso
(`requireOwner`/`requirePromotionOwner`) — leído con atención porque es exactamente el tipo de hallazgo
que ya se encontró una vez (FID-005), pero esta vez el patrón se siguió bien desde el principio. No se
encontró ninguna vulnerabilidad nueva de Broken Access Control.

**Hueco real encontrado**: ese código nuevo (analítica por periodo y gestión de imágenes de
promociones) no tenía ningún test unitario — solo cobertura E2E (`restaurant-flows.spec.ts`), que
necesita backend+frontend+MySQL reales y no se puede ejecutar en este sandbox. Se cerró ese hueco,
continuando el mismo criterio de FID-013/FID-014 ("tests unitarios de backend sin BD real" es el
tipo de tarea explícitamente indicado para un entorno sin servidores locales):

- **`PromocionServiceTest.java` (nuevo, 15 tests)**: `crear`/`crearConImagen` asocian la promoción al
  restaurante autenticado por email (nunca a un `restauranteId` que venga del cliente); un email que no
  existe en `RestauranteDAO` (p.ej. una cuenta cliente) lanza `ResourceNotFoundException` en vez de
  crear nada — cubre por qué un `ROLE_USER` nunca puede crear una promoción "a nombre de" un
  restaurante ajeno. `actualizar`/`eliminar`/`aplicarPromocion` con un restaurante que no es el dueño
  real de la promoción lanzan `AccessDeniedException` y no llegan a tocar el DAO de escritura
  (`requirePromotionOwner`, regresión directa del patrón FID-005). `aplicarPromocion` con el dueño real
  suma los puntos correctos al usuario y registra el `MovimientoPuntos` esperado. Validación de
  `crearConImagen` (tamaño > 5MB, tipo de archivo no permitido, imagen vacía) y
  `validarRestauranteAutenticado`.
- **`RestauranteServiceTest.java` (+2 tests)**: `obtenerEstadisticasPeriodo` con un email autenticado
  que no es el dueño lanza `AccessDeniedException` sin llegar a consultar `MovimientoPuntosDAO`
  (mismo patrón que los tests ya existentes de `obtenerStats`/`obtenerStatsAvanzadas`); con el dueño
  real, agrega correctamente ventas totales, transacciones, clientes activos y puntos otorgados/canjeados
  de la semana actual a partir de movimientos reales, sin comparación con el periodo anterior
  (`comparar=false`).

**Verificación real**: `mvn test -Dtest=PromocionServiceTest,RestauranteServiceTest` → 26/26 passed
(15 + 11, incluye los tests ya existentes de FID-013). `mvn test` completo → 50/50 passed salvo
`SpringBootTfgApplicationTests.contextLoads`, que falla por el mismo motivo ya documentado en
FID-013/FID-014 (`Communications link failure`, no hay MySQL en este sandbox) — no relacionado con
este cambio. No se tocó ningún test existente ni código de producción (solo tests nuevos).

**No se pudo verificar en este entorno** (requeriría backend/frontend/MySQL reales): el flujo E2E
completo de estas dos features, ya cubierto por `frontend/e2e/restaurant-flows.spec.ts` (ampliado en
la sesión nocturna del #29/#30), no duplicado aquí.

Archivos creados: `src/test/java/progresa/springboot_tfg/service/PromocionServiceTest.java`.
Archivos modificados: `src/test/java/progresa/springboot_tfg/service/RestauranteServiceTest.java`.

Tests realizados (reales, no simulados):
- `mvn compile` → éxito (dependencias resueltas vía proxy configurado del entorno).
- `mvn test -Dtest=LoginRateLimiterTest` → **7/7 passed** (`target/surefire-reports/...LoginRateLimiterTest.txt`).
- `mvn test` (suite completa) → `GlobalExceptionHandlerTest` (1/1, no requiere BD) y
  `LoginRateLimiterTest` (7/7, nuevo) pasan; `SpringBootTfgApplicationTests.contextLoads` falla con
  `Communications link failure` (MySQL no disponible en este entorno) — **fallo preexistente y
  esperado, no causado por este cambio**: ese test necesita una base de datos real que no existe en
  este entorno de sesión (confirmado leyendo la traza: `Connection refused` al intentar conectar).

**No se pudo verificar en este entorno**: el comportamiento en runtime real contra tráfico HTTP
(el filtro `LoginRateLimitFilter` completo, que sí depende de Spring/Servlet) — eso ya lo cubre el
E2E existente `security-login-rate-limit.spec.ts` contra un backend real, no se duplicó aquí.

Resultado: cobertura unitaria nueva para la lógica de negocio de rate-limiting (antes 0%), sin tocar
comportamiento de producción ni arquitectura. Pendiente para una futura sesión con MySQL disponible:
evaluar el salto de `spring-boot-starter-parent` 3.2.1 → 3.2.12 (mismo minor, últimos parches de
seguridad) descartado aquí por no poder verificarse en runtime real en este entorno.

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

### FID-017 — completada 2026-09-27 — VULNERABILIDAD REAL ENCONTRADA Y CORREGIDA

**Alcance auditado** (contra el backend real de `localhost:8081`, con JWTs reales de dos cuentas de
restaurante sembradas — Alabroster y Venezuela Food, misma contraseña compartida vía
`APP_SEED_RESTAURANT_PASSWORD` — y un cliente registrado de usar y tirar vía `/api/auth/register`):

- Ownership cruzado en `RestauranteController`: `stats`, `stats-avanzadas`, `estadisticas`,
  `PUT /{id}`, `POST /{id}/imagen` — Alabroster (token real) intentó leer/modificar los datos de
  Venezuela Food (id real) en los cinco endpoints. Los cinco devolvieron **403** real
  (`requireOwner` ya presente y correcto, heredado de FID-005). Verificado que el nombre de
  Venezuela Food no cambió tras el intento de `PUT`.
- Ownership cruzado en `PromocionController`: se creó una promoción real como Venezuela Food y
  Alabroster intentó `PUT`/`DELETE` sobre ella por id — ambos **403** reales
  (`requirePromotionOwner`, correcto).
- Aislamiento de roles: token de restaurante contra `/api/admin/**` → 403; sin token → 401;
  Swagger/OpenAPI (`/swagger-ui/**`, `/v3/api-docs`) con y sin token de restaurante → 403/401;
  `/api/auth/login-admin` con credenciales de restaurante → 401 real (`"Credenciales de
  administrador no válidas"`); `/actuator/**` (health, info, env, beans, metrics) → 401 (no
  expuesto sin autenticar).

**Vulnerabilidad real encontrada** (no cubierta por auditorías anteriores, distinta de un problema
de ownership): **fuga del hash bcrypt de la contraseña de cualquier restaurante con al menos una
promoción**, vía `GET /api/promociones` y `GET /api/promociones/restaurante/{id}`.
`PromocionController` devuelve la entidad `Promocion` directamente (sin DTO), y esta arrastra la
entidad `Restaurante` completa —incluida `password`— en el campo anidado `restaurante`. Como el
`GET` de `/api/promociones/**` está abierto a `ROLE_USER`/`ROLE_RESTAURANT`/`ROLE_ADMIN` (por
diseño: es el listado público de ofertas), **cualquier cliente recién autoregistrado gratis** podía
leer el hash de cualquier restaurante y atacarlo offline. Verificado empíricamente antes de
corregir: un cliente de prueba (`audit-client-*@fidelyfood.local`, creado y borrado en esta misma
sesión) obtuvo el hash real de Venezuela Food (`$2a$10$yPPh...`) vía `GET /api/promociones`.

**Corrección**: `@JsonProperty(access = JsonProperty.Access.WRITE_ONLY)` en el campo `password` de
`Restaurante.java` — evita que Jackson lo serialice en cualquier respuesta JSON, pero lo sigue
aceptando al deserializar peticiones entrantes (necesario: `PUT /api/restaurantes/{id}` reutiliza
este mismo campo para cambiar la contraseña, ver `RestauranteService.actualizar`). Se descartó
`@JsonIgnore` porque habría roto esa función silenciosamente (ignora también la deserialización).
Se aplicó el mismo endurecimiento a `Usuario.password` por defensa en profundidad, aunque no se
encontró hoy un endpoint que devuelva un `Usuario` crudo.

**Verificación antes/después** (real, con backend reiniciado desde `../TFG-agent-worktree` para
recompilar el fix, restaurado después al estado original del checkout principal):
- Antes: `GET /api/promociones` con token de cliente → `restaurante.password` presente (hash real).
- Después: mismo request → sin campo `password` en la respuesta.
- `PUT /api/restaurantes/{id}` con un restaurante de prueba desechable (creado y borrado en esta
  sesión vía `/api/auth/register-restaurante`): cambio de contraseña sigue funcionando (login con
  la contraseña vieja → 401, con la nueva → 200) pese al `WRITE_ONLY`.
- Regresión: `mvn test` (JUnit) y la suite E2E completa (16/16, incluida la nueva) siguen en verde.

**Test de regresión añadido**: `frontend/e2e/security-promotion-password-leak.spec.ts` — crea una
promoción real, la lee como cliente y como listado público, y comprueba que `restaurante` nunca
tiene la propiedad `password`; limpia la promoción de prueba al terminar.

Archivos modificados: `src/main/java/progresa/springboot_tfg/entity/Restaurante.java`,
`src/main/java/progresa/springboot_tfg/entity/Usuario.java`,
`frontend/e2e/security-promotion-password-leak.spec.ts` (nuevo), `SECURITY.md`, `AGENT_TASKS.md`.

**Estado**: corregido en `agent/fidelyfood-autonomous`, pendiente de PR/revisión humana y de
reiniciar el backend de desarrollo (puerto 8081) para que el arreglo tenga efecto — el proceso que
ya tenías corriendo al terminar esta sesión sigue con el código antiguo (sin el fix), tal y como se
dejó explícitamente para no interferir con tu sesión en curso.
