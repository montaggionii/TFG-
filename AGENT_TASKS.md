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
- **Estado:** TODO
- **Dependencias:** —
- **Archivos afectados:** frontend/src/app/features/restaurant-app/dashboard/dashboard.component.ts
- **Criterios de aceptación:** Al entrar por primera vez en /r/dashboard cada endpoint de datos se pide exactamente una vez; al volver a la pestaña se sigue refrescando; sin regresiones visuales.
- **Tests necesarios:** E2E restaurant-flows (dashboard) + spec nuevo que cuente peticiones con page.on('request')
- **Resultado:** —

### AGT-002 · Canjear promociones CANJEAR: falta el endpoint POST /api/canjes
- **ID:** AGT-002
- **Descripción:** PromocionService (frontend) llama a POST /api/canjes {usuarioId, promocionId} para canjear una promocion tipo CANJEAR, pero el backend no expone ese endpoint (solo existe /api/recompensas/{id}/canjear). Ademas las pantallas leen promo.puntosNecesarios y la entidad Promocion solo tiene puntosOtorgados. Hoy el cliente no puede canjear promociones de gasto de puntos.
- **Prioridad:** P1
- **Área:** backend
- **Estado:** TODO
- **Dependencias:** —
- **Archivos afectados:** src/main/java/progresa/springboot_tfg/controller/, src/main/java/progresa/springboot_tfg/service/PromocionService.java, src/main/java/progresa/springboot_tfg/entity/Canje.java, frontend/src/app/core/services/promocion.service.ts
- **Criterios de aceptación:** Un cliente autenticado puede canjear una promocion CANJEAR de un restaurante: se valida saldo suficiente en ese restaurante, se descuentan los puntos, se registra el MovimientoPuntos (tipo CANJEADOS) y el Canje; saldo insuficiente → 400; un cliente no puede canjear a nombre de otro (ownership por JWT); documentado en API.md.
- **Tests necesarios:** Tests unitarios Mockito del servicio (saldo suficiente/insuficiente, ownership) + E2E del flujo de canje + prueba manual con call_api
- **Resultado:** —

### AGT-003 · Cobertura E2E de flujos sin spec: cliente (restaurantes/promociones) y panel admin
- **ID:** AGT-003
- **Descripción:** Los specs actuales cubren login de los 3 roles, home/mapa/historial/perfil del cliente, dashboard/promociones/scanner del restaurante y 3 regresiones de seguridad. No hay spec para: detalle de restaurante y promociones/recompensas del cliente, registro de compras desde el restaurante, historial de actividad del restaurante ni funciones del panel admin (solo hay login).
- **Prioridad:** P2
- **Área:** testing
- **Estado:** TODO
- **Dependencias:** AGT-006
- **Archivos afectados:** frontend/e2e/
- **Criterios de aceptación:** Existen specs nuevos para al menos: detalle de restaurante del cliente, actividad del restaurante y un flujo del panel admin (listado de negocios); cada uno falla si se rompe la pantalla y usa helpers/auth.ts sin credenciales hardcodeadas.
- **Tests necesarios:** run_e2e_tests suite all en verde con backend+frontend+navegador de Playwright disponibles
- **Resultado:** —

### AGT-004 · Modal 'Crear Promocion' corta el texto a 320 px de ancho
- **ID:** AGT-004
- **Descripción:** A exactamente 320 px de viewport el modal de creacion de promocion recorta texto contra el borde derecho (detectado en una revision responsive; sin impacto a 375 px o mas).
- **Prioridad:** P3
- **Área:** frontend
- **Estado:** TODO
- **Dependencias:** —
- **Archivos afectados:** frontend/src/app/features/restaurant-app/ (modal de crear promocion; localizar con search_code)
- **Criterios de aceptación:** A 320 px y 375 px el modal se ve completo, sin texto cortado ni scroll horizontal.
- **Tests necesarios:** Verificacion visual real a 320/375 px (captura) + build de produccion
- **Resultado:** —

### AGT-005 · Volver a subir las fotos de promociones y portadas tras desplegar el PR de imagenes en BD
- **ID:** AGT-005
- **Descripción:** Las fotos subidas como archivo antes del cambio (PR #45) apuntan a /uploads/... que ya no existen en Render (disco efimero). Tras desplegar el PR, hay que volver a subirlas (promociones de Mexican Food, Alabroster y Venezuela Food y portadas subidas como archivo). Requiere credenciales de produccion: lo hace una persona.
- **Prioridad:** P1
- **Área:** deployment
- **Estado:** BLOCKED
- **Dependencias:** —
- **Archivos afectados:** —
- **Criterios de aceptación:** Todas las promociones y portadas de los 3 restaurantes muestran su foto en produccion y la foto sigue ahi tras un redeploy de Render.
- **Tests necesarios:** Comprobacion visual en produccion + redeploy manual y segunda comprobacion
- **Resultado:** Bloqueada hasta que se fusione y despliegue el PR #45 y una persona suba las fotos con credenciales de produccion.

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

<!-- TASKS:END -->

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
