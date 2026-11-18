# AGENT_WORK_LOG — Sesión autónoma 2026-09-27

Registro cronológico de la sesión autónoma iniciada tras la instrucción del usuario
("trabaja como agente autónomo de desarrollo y QA durante ~6 horas, sin esperar
confirmación entre tareas"). Formato: Hora / Tarea / Problema / Solución / Archivos / Tests / Resultado.

---

## 16:10 — Punto de partida

**Contexto heredado de esta misma sesión (antes de la instrucción de autonomía):**
- Backend local (`:8081`) y frontend local (`:8100`) levantados y verificados sanos.
- Producción (Render, plan free) caída por un incidente confirmado en status.render.com
  ("Observing service instability from our upstream provider AWS in Oregon region" —
  el nivel gratuito seguía afectado cuando el resto de Render ya se había recuperado).
  Sondeo en segundo plano esperando recuperación.
- PR #31 abierto (info-card real del mapa; se retiró un indicador "Abierto/Cerrado"
  que habría mentido siempre "Cerrado" porque `RestauranteDTO` no tiene ese campo).
- PR #28 abierto desde la rutina nocturna (tests unitarios), revisado y recomendado,
  pendiente de confirmación de fusión del usuario.
- El usuario pidió explícitamente: no escribir "demo" en nada visible del producto;
  todo debe presentarse como real. En curso: limpieza de `MexicanFoodDemoSeeder`.

**Restaurantes reales confirmados (ninguno inventado):**
1. Restaurante E2E — fixture de QA/Playwright, NO se trata como restaurante de cara al público.
2. Alabroster - Comida Colombiana
3. Venezuela Food
4. Mexican Food

No existe "Colombia Food" como restaurante independiente.

---

## 16:20 — Limpieza de etiquetas "demo"

**Tarea:** el usuario pidió explícitamente que ningún contenido visible mencione "demo".

**Problema:** `MexicanFoodDemoSeeder` generaba descripciones `[DEMO] Compra en Mexican Food`
(visibles en "Actividad Reciente") y clientes sintéticos `demo.clienteN@fidelyfood.local`.

**Solución:** se quitó el prefijo `[DEMO]`, los emails ahora son `nombre.apellido@fidelyfood.local`,
y se añadió `LegacyLabelCleanupRunner` (idempotente) para corregir — sin borrar nada — las filas
que ya se habían creado en producción con la etiqueta antigua (identificadas por su propio
`motivo_interno`).

**Archivos:** `MexicanFoodDemoSeeder.java`, `LegacyLabelCleanupRunner.java` (nuevo), `MovimientoPuntosDAO.java`.

**Tests:** `mvn test` 2/2 OK. Verificado en local: reinicio → `CLEANUP: 221 movimientos... corregidos`.

**Resultado:** PR #32 abierto (https://github.com/montaggionii/TFG-/pull/32), checks en verde,
**no fusionado** — el clasificador de auto-mode bloquea que yo mismo fusione PRs ("Merge Without
Review"); queda listo para que el usuario lo apruebe.

---

## 16:35 — Bug real: "Historial de Actividad" mostraba datos 100% inventados

**Hallazgo (durante el barrido de `console.log`):** `activity-history.component.ts` tenía una
función `useMockData()` que se activaba en 3 casos — sin sesión tras 2s, respuesta real vacía, o
cualquier error de red — mostrando siempre las mismas cifras fijas (1.245,50€, 84 clientes,
"Juan Pérez", "Maria García"...) sin ninguna indicación de que fueran falsas. El gráfico
"Rendimiento Diario" también era un array fijo `[20,45,30,70,55,90,65]`, nunca datos reales.

**Por qué importa:** viola directamente la instrucción explícita del usuario de que todo sea real,
y es el tipo de "pantalla que miente" que el propio usuario pidió evitar (FASE 21: estados
loading/empty/error reales, nunca datos falsos tapando un error).

**Solución:**
- Se elimina `useMockData()` por completo. Vacío real → estado vacío ya existente. Error real →
  nuevo estado de error con botón "Reintentar".
- El gráfico ahora reutiliza el endpoint real de estadísticas por periodo (el mismo que ya usa el
  dashboard).
- Se descubrió que `MovimientoPuntosDTO` nunca exponía `monto` ni el nombre del cliente (aunque la
  entidad sí los tiene) — hasta las operaciones REALES se veían como "Cliente" sin importe. Se
  añaden ambos campos al DTO y se actualizan los 3 sitios donde se construye.
- Bug menor: botón "Ver hoy" saltaba a una fecha hardcodeada (2026-05-12) en vez del día actual.

**Archivos:** `MovimientoPuntosDTO.java`, `RestauranteService.java`, `MovimientoPuntosService.java`,
`activity-history.component.ts`, `activity-history.component.html`.

**Tests:** `mvn test` 2/2 OK. `ng build --configuration production` sin errores. Verificado
visualmente en el navegador: tras reiniciar el backend, el historial de Mexican Food muestra
facturación/puntos reales, nombres de cliente reales (Diego Torres, Marco Ibáñez) e importes reales.

**Resultado:** PR #33 abierto (https://github.com/montaggionii/TFG-/pull/33), sin fusionar (mismo
motivo que arriba).

---

## 16:40 — Auditoría de seguridad delegada (subagente `fidelyfood-qa-security`)

Lanzada en paralelo mientras trabajaba en lo anterior, sobre `../TFG-agent-worktree`
(rama `agent/fidelyfood-autonomous`) para no pisar mi propio checkout. Duración ~21 min,
124 llamadas a herramientas.

### 🔴 P0 — Vulnerabilidad real encontrada y corregida: fuga del hash bcrypt de contraseñas

**Qué:** `GET /api/promociones` y `GET /api/promociones/restaurante/{id}` devuelven la entidad
`Promocion` sin pasar por un DTO, y esta arrastra la entidad `Restaurante` completa —incluido el
campo `password` (hash bcrypt)— en el JSON de respuesta. Cualquier usuario autenticado con
ROLE_USER (incluido uno recién autoregistrado gratis) podía leer el hash real de la contraseña de
cualquier restaurante con promociones activas y atacarlo offline.

**Prueba (antes del fix, agente):**
```
GET /api/promociones  (Authorization: Bearer <token de cliente>)
→ [...{"restaurante": {..., "password": "$2a$10$yPPhx...", ...}}]
```

**Corrección:** `@JsonProperty(access = JsonProperty.Access.WRITE_ONLY)` en `Restaurante.password`
y `Usuario.password` (defensa en profundidad en el segundo caso). Se descartó `@JsonIgnore` porque
también bloquea la deserialización y habría roto en silencio `PUT /api/restaurantes/{id}` (que
reutiliza ese campo para cambiar la contraseña).

**Verificación (agente):** E2E completa 16/16 (incluye nuevo test
`security-promotion-password-leak.spec.ts`), `mvn test` OK, `PUT` con cambio de contraseña
verificado (password vieja → 401, nueva → 200).

**Ownership/roles revisado sin hallazgos nuevos:** Alabroster con su JWT real no puede leer/
modificar/borrar datos de Venezuela Food (403 real en 7 endpoints probados); `/api/admin/**` sin
rol admin → 403/401; `/api/auth/login-admin` con credenciales de restaurante → 401; Swagger y
Actuator no expuestos sin autenticar.

**Estado:** commit incluido en **PR #28** (https://github.com/montaggionii/TFG-/pull/28, junto con
los tests unitarios FID-013 a FID-016 de la rutina diaria). **NO fusionado** — ni por el subagente
(tiene prohibido fusionar esa rama) ni por mí (bloqueado por el clasificador de auto-mode).

**⚠️ URGENTE para cuando el usuario vuelva:** esta vulnerabilidad sigue viva en producción hasta que
se fusione este PR y se redespliegue — ahora mismo no es explotable porque producción está caída
(incidente de Render, ver arriba), pero en cuanto se recupere, cualquier cliente registrado puede
volcar hashes de contraseñas de restaurantes vía `/api/promociones`. Recomiendo fusionar PR #28 en
cuanto sea posible, con prioridad sobre cualquier otra tarea de este informe.

**Nota del propio subagente:** al editar `Usuario.java`, su herramienta normalizó el fichero de
CRLF/LF mixto a LF puro (no cambia contenido, solo hace el diff más grande de lo necesario) — lo
dejó así porque compila y todos los tests pasan.

---

## 17:15 — Higiene: tokens JWT y estado de sesión en el log de la consola

**Hallazgo (durante el barrido de `console.log`):** `AuthService` imprimía un fragmento del JWT
(15 caracteres) en cada login, y `GlobalStateService` imprimía el **estado de usuario completo —
incluido el token entero—** en cada `setState()`. Ninguno es explotable a distancia (son logs del
propio navegador del usuario), pero es una mala práctica real: cualquier captura de pantalla de la
consola, o una extensión de terceros que lea `console.log`, podría filtrar sesiones.

**Solución:** se retiran todos los `console.log` narrativos de login/registro/logout y los que
volcaban el estado/token; se mantienen los `console.error` de fallo real de red.

**Archivos:** `auth.service.ts`, `global-state.service.ts`.

**Tests:** `ng build --configuration production` sin errores. Verificado en el navegador: login,
persistencia de sesión tras recarga y dashboard siguen funcionando igual.

**Resultado:** PR #34 (https://github.com/montaggionii/TFG-/pull/34), sin fusionar.

---

## 17:35 — FASE 13: pruebas responsive (320/375px)

Probado el dashboard y "Mis Promociones" a 320px y 375px. A 375px (ancho de referencia real,
la mayoría de móviles actuales) todo se ve correcto, sin overflow ni texto cortado.

**Hallazgo P3 (no corregido, documentado):** a exactamente 320px (iPhone SE de 1ª generación,
prácticamente inexistente en 2026), el modal "Crear Promoción" corta el texto del `ion-select`
"Tipo de Promoción" y del placeholder de la descripción contra el borde derecho del modal — el
formulario sigue siendo 100% funcional (los valores se seleccionan/envían bien), es solo un
recorte visual en el ancho de pantalla más pequeño y menos relevante que existe. No lo he
corregido: es P3 según la regla de prioridad de esta sesión (P0 > P1 > P2 > P3) y hay hallazgos
de severidad mayor pendientes (la vulnerabilidad de PR #28, producción caída). Si se quiere pulir
en el futuro: revisar `form-promocion.component.scss` (`.saas-input`, clase de `ion-select`/
`ion-textarea`) para forzar `width: 100%` explícito en esos campos dentro de `.input-content`.

---

## 18:10 — 🔴 Hallazgo grave: el panel de admin simulaba un "agente IA" trabajando, sin nada real detrás

**Cómo lo encontré:** barriendo el frontend en busca de otros patrones "mock/fake" tras el bug del
historial de actividad, apareció `app/core/agent/` (4 ficheros) y `app/shared/components/agent-widget/`,
usados en `admin-layout.component.html`.

**Qué hacía:** `AgentWidgetComponent` se renderiza SIEMPRE en el panel de administrador y en
`ngOnInit()` llama sin condición a `AgentMockSource.start()`. Esa clase reproduce, en bucle infinito
(cada ejecución completa dura ~10s, luego 14s de "IDLE" y vuelve a empezar), un guion fijo con
`setTimeout`: "Auditoría diaria de FidelyFood" → "Consultando /api/admin/businesses" → "Verificando
integridad de puntos" → "Generando informe"... con barra de progreso y todo. **Nada de eso ocurre de
verdad** — es una animación de teatro que cualquier persona que entre al panel de admin (incluido
quien evalúe este TFG) vería como si un agente autónomo estuviera trabajando de verdad en el
proyecto, de forma continua, sin parar nunca.

**Por qué es el hallazgo más importante de "que todo sea real" hasta ahora:** a diferencia del bug
del historial (que solo mostraba datos falsos en casos límite: sin sesión, vacío, error), este
widget muestra teatro fabricado el 100% de las veces, de forma incondicional, en una pantalla que
un evaluador probablemente vería.

**Solución:** se quita `<app-agent-widget>` de `admin-layout.component.html` y su import — dejan de
arrancar el mock y de mostrarse. No se borra `AgentStateService`/`agent-event.types.ts` (arquitectura
ya pensada para una fuente de eventos real vía SSE/WebSocket más adelante, documentado en el propio
código) — solo se deja de simular que esa fuente ya existe.

**Verificación:** `ng build --configuration production` sin errores; `grep -r` sobre todo `www/`
confirma que ninguna cadena del guion simulado ni el componente siguen en el bundle final.

**Resultado:** PR #35 (https://github.com/montaggionii/TFG-/pull/35), sin fusionar.

---

## 18:35 — FASE 9: flujo cliente + otro dato inventado encontrado

Al probar el flujo de cliente (login → Inicio) encontré otro caso del mismo patrón: cada tarjeta
de "restaurantes cercanos" mostraba una insignia fija "+10 pts" (`ptsPerEuro: 10`) sin respaldo real
— el backend no tiene ningún campo de "puntos por euro" configurable por restaurante, y la única
lógica real (el seeder de Mexican Food) usa 1 punto por euro, no 10.

**Solución:** se retira el valor inventado (la insignia deja de renderizarse hasta que exista un
dato real que mostrar). De paso, un fallo de red al cargar restaurantes cercanos hacía desaparecer
la sección en silencio (array de "mocks mejorados" ya vacío de una sesión anterior) — se añade un
estado de error real con botón "Reintentar", igual que el aviso de geolocalización ya existente.

**Archivos:** `home.component.ts`, `home.component.html`.

**Tests:** `ng build --configuration production` sin errores. Verificado en el navegador con un
cliente de prueba local (login → Inicio funcionando, saldo real en 0, sin insignia inventada).

**Resultado:** PR #36 (https://github.com/montaggionii/TFG-/pull/36), sin fusionar.

---

## 19:00 — FASE 26: dependencias

`npm audit --omit=dev` → **0 vulnerabilidades** (lo que realmente se envía al navegador del
usuario está limpio). `npm audit` completo (incluyendo devDependencies) → 11 avisos, todos en
herramientas de build que nunca llegan a producción: `postcss`/`vite`/`webpack-dev-server`
(usadas solo por `ng serve`/`ng build` en la máquina del desarrollador). El más relevante
("NTLMv2 hash disclosure", "path traversal en `server.fs.deny`") es específico de Windows y de
un dev-server expuesto, que no es nuestro caso.

No ejecuté `npm audit fix`: podría subir `webpack-dev-server`/`vite` a versiones que el propio
Angular CLI pineado no soporte, y la instrucción explícita de esta sesión es no actualizar
versiones principales sin verificar antes que no rompen el proyecto. Documentado, no corregido —
riesgo real bajo (dev-only), beneficio incierto sin poder probar el `ng serve` resultante a fondo
ahora mismo.

---

## 19:05 — Confirmación de una funcionalidad rota de punta a punta (documentado, no implementado)

Revisando el flujo de "canjear puntos" del cliente until encontré que usa `promo.puntosNecesarios`
y un saldo `ptsRestaurante` por restaurante — ninguno de los dos existe en el backend — y llama a
`POST /api/canjes`, que tampoco existe (ya documentado en sesiones anteriores como hueco conocido,
pero ahora con el detalle completo). El frontend maneja el fallo correctamente (revierte el estado
optimista, muestra error real, no finge un canje exitoso), pero la funcionalidad de canjear puntos
está simplemente inutilizable hoy para cualquier cliente real. Detalle completo, con la razón de
por qué no lo implementé ahora (requiere diseñar el modelo de datos del saldo por restaurante, no
es un bugfix rápido), en `.agent/discoveries.md`.

---

## 19:15 — FASE 17: regresión con la suite E2E completa

`npx playwright test` contra el stack local (backend+frontend con todos los cambios de esta
sesión aplicados): **15/15 passed** (13.6s) — login × 3 roles, rate-limit de login, aislamiento de
stats entre restaurantes, flujos completos de cliente (home/mapa/historial/perfil+logout) y de
restaurante (dashboard/promociones/scanner/flujo completo crear-promo→ajustes). Confirma que
ninguno de los 6 fixes de esta sesión (dashboard, historial de actividad, home del cliente, auth
service, admin-layout) rompió nada existente.

---

## 2026-09-29 — FASE 27: CI/CD

No existía ningún workflow de GitHub Actions — los PRs solo mostraban los previews de Vercel, sin
ejecutar `mvn test` ni verificar que el frontend compila. Se añadió `.github/workflows/ci.yml` con
dos jobs (backend con MySQL efímero real vía servicio de Actions, frontend con `ng build`),
ninguno despliega nada. PR #40, sin fusionar. Su propio primer run en GitHub sirve de validación
real de la configuración (no hay `act` instalado localmente para probarlo antes).

---

## 2026-09-29 — Widget de escritorio actualizado

Actualizado `.agent/state.json` (que el widget `project-agent` lee en vivo) con el estado real:
producción caída (>30h), los 9 PRs abiertos de la sesión, resultados de build/tests. Añadido al
widget `project-agent` un indicador de estado de producción (rojo si está caída) y corregido el
enlace "Ver PR" (apuntaba al PR #1, obsoleto) para ir al listado de PRs. Añadido al widget
`fidelyfood-credentials` un banner rojo avisando de que producción está caída. PR #39.

---

## 2026-09-29 — Intento de integración con OpenAI rechazado por el clasificador de seguridad

El usuario pidió montar una integración MCP con la API de OpenAI usando una clave que pegó en
texto plano en el chat. Se le avisó de que esa clave queda comprometida por el simple hecho de
haberse compartido así, y de que el "club oficial" mencionado en un vídeo de TikTok no es nada
reconocible como producto real de Anthropic. El usuario insistió en usarla igualmente. Al intentar
montarlo (búsqueda en el registro de npm, luego crear una carpeta local para un servidor MCP
propio), el clasificador de auto-mode de Claude Code bloqueó ambos pasos independientemente
("Third-Party Attack" y "Credential Leakage") — una capa de seguridad de la plataforma, no una
decisión mía, así que no se insistió por otra vía. No se llegó a usar la clave para nada. Si el
usuario quiere esto de verdad, necesita una clave nueva (tras revocar la expuesta) entregada fuera
del chat.

---

**Actualización:** el primer run real del workflow de CI (PR #40) pasó ambos jobs — backend 1m4s,
frontend 51s — confirmando que el arranque completo del backend con una base de datos MySQL
totalmente vacía (Hibernate `ddl-auto=update` + los 3 seeders/runners) funciona correctamente sin
intervención manual.

---

## 2026-09-29 13:21 — 🟢 PRODUCCIÓN RECUPERADA — causa real: Aiven, no Render

Tras ~45h caída, el usuario encontró la causa real revisando `console.aiven.io` (yo solo tenía
acceso a Render, que no mostraba nada útil más allá del `Communications link failure` genérico):
el plan gratuito de MySQL en Aiven **se apaga solo por inactividad**. El `UnknownHostException`
que veíamos en los logs de Render era porque Aiven retira el DNS del host mientras está apagado —
confirmado también desde esta máquina con `nslookup` → NXDOMAIN, antes de que el usuario mirara el
dashboard. No fue un fallo de Render (aunque coincidió con un incidente real y no relacionado de su
plataforma el 27/09, lo que despistó durante horas).

El usuario encendió el servicio manualmente en Aiven. Datos intactos (backups de 4-5 días visibles
todo el tiempo, 548 MB). Verificado por mí con una llamada real: login con contraseña incorrecta
contra producción → "Credenciales incorrectas" (no un error de conexión), confirmando que la BD
está viva con los datos reales.

Actualizado `.agent/state.json`, `.agent/tasks.md` y `.agent/discoveries.md` con la causa real y la
prioridad ahora más urgente: fusionar PR #28, cuya vulnerabilidad (fuga de hash de contraseñas)
vuelve a ser explotable en vivo ahora que producción ha vuelto.

---

## 2026-09-29 13:40 — Mexican Food: fotos reales por promoción + 4 promociones nuevas de canje

El usuario notó que las 4 promociones de Mexican Food mostraban todas la misma foto. Causa real
(no un bug, comportamiento honesto del fallback): todas tenían `imagenUrl: null`, así que el
frontend (`resolvePromotionImage`) caía de vuelta a la foto del propio restaurante para las 4.

Acción tomada contra producción real (ya recuperada):
- Subida una foto de portada real para Mexican Food (pedida explícitamente por el usuario, con
  aviso previo de que es de un blog de terceros sin licencia verificada — el usuario asumió el
  riesgo para su proyecto de TFG no comercial).
- Las 4 promociones existentes (GANAR) actualizadas con una foto real y distinta cada una, acorde
  a su descripción (tacos para "Martes de Tacos", burrito para "Especial Burrito Grande", etc.),
  sacadas de Unsplash (licencia libre verificada). De paso se corrigió `tipo` (estaba vacío `""`,
  ahora `"GANAR"` explícito) y `activa` (estaba `false` en el backend pese a mostrarse como activa
  en la UI — ahora es `true` real).
- 4 promociones nuevas creadas, tipo CANJEAR (petición explícita del usuario: quería promociones
  de "perder puntos", no solo de ganar): Happy Hour Mexicano (40 pts, nachos gratis 20:00-21:00),
  Postre de la Casa (30 pts, churros o flan), Bebida Refrescante (20 pts, horchata/agua fresca),
  Menú Degustación Gratis (150 pts, salsas+guacamole+totopos). Cada una con su propia foto temática.

Verificado: las 8 promociones devueltas por `GET /api/promociones/restaurante/3` con tipo/puntos/
activa/imagenUrl correctos, y una imagen comprobada como públicamente accesible (200 OK).

**Nota honesta pendiente**: crear estas promociones con `tipo=CANJEAR` las hace aparecer
correctamente en "Mis Promociones" (gestión, lado restaurante), pero el canje real por parte de un
cliente sigue sin funcionar — `POST /api/canjes` no existe en el backend (ver hallazgo ya
documentado en `discoveries.md`). No se ha fingido lo contrario.

---

## 2026-09-29 13:55 — Rediseño visual: "Tus Ofertas Activas" con fotos reales

El usuario pidió que esa sección se viera "más dinámica, más colorida" (mostraba un icono de regalo
genérico repetido en todas las tarjetas). Cargué la skill `frontend-design` antes de tocar nada.

Causa real: el componente ni siquiera leía `promo.imagenUrl` al cargar las promociones del
dashboard — copiaba el array crudo del backend sin resolver la imagen (a diferencia de "Mis
Promociones", que sí usa `resolvePromotionImage`). Corregido, y rediseñada la tarjeta mini para que
la foto real sea la protagonista, con una insignia de puntos verde/roja superpuesta (mismos colores
que ya usa el resto del dashboard para GANADOS/CANJEADOS — coherencia visual, no una paleta nueva).

Verificado visualmente en local con datos de prueba reales (tacos/nachos), capturas confirmando el
resultado, datos de prueba borrados después. E2E 15/15 sin regresiones. PR #41.

---

## 2026-09-29 14:20 — Alabroster y Venezuela Food: 8 promociones reales cada uno, con fotos propias

Mismo tratamiento que Mexican Food, contra producción real:

**Alabroster - Comida Colombiana** (partía de 0 promociones):
- GANAR: Bandeja Paisa Completa (100pts), Empanadas Criollas x6 (40pts), Arepa Especial (35pts),
  Sancocho de la Casa (60pts)
- CANJEAR: Bebida Típica Gratis (20pts), Postre Colombiano (30pts), Happy Hour Empanadas 18-19h
  (40pts), Bandeja Paisa Gratis (180pts)

**Venezuela Food** (partía de 0 promociones):
- GANAR: Pabellón Criollo (100pts), Tequeños x10 (40pts), Arepa Reina Pepiada (35pts), Cachapa con
  Queso (45pts)
- CANJEAR: Papelón con Limón Gratis (20pts), Postre Venezolano/Quesillo (30pts), Happy Hour
  Tequeños 18-19h (40pts), Pabellón Gratis (180pts)

Cada una con foto propia y distinta sacada de Unsplash (licencia libre). Nota de proceso: varias
búsquedas de Unsplash para platos muy específicos (tequeños, pabellón) devolvieron fotos claramente
mal etiquetadas — un cartel real de una taquería con gente identificable, un hotel en Niza, comida
completamente distinta — descartadas todas tras verificación visual antes de subir nada; se
reintentó con términos más genéricos hasta encontrar fotos reales y correctas para las 16.

Verificado con `GET /api/promociones/restaurante/{1,2}`: 8/8 en cada uno, tipo/puntos/imagen
correctos. Mismo aviso que con Mexican Food: el canje real desde el cliente sigue sin funcionar
(`/api/canjes` no existe), estas promociones se gestionan bien pero no se pueden canjear de verdad
todavía.

---

## 2026-09-29 14:35 — Diagnóstico: PR #41 fusionado pero producción no lo mostraba

El usuario fusionó el PR #41 pero `fidelyfoodapp.vercel.app` seguía sirviendo la build antigua.
Diagnóstico real (no caché, cabeceras `x-vercel-cache: MISS` con `last-modified` actual):

- `git log origin/main` confirmó el merge real en `main`.
- La API de GitHub (`commits/{sha}/status`) confirmó que Vercel SÍ completó un despliegue de
  producción real para ese commit exacto en los 3 proyectos conectados (fidelyfood, fidelyfoodapp,
  tfg-glf5).
- Pese a eso, el dominio servía otra build — mismo patrón de inestabilidad del alias de dominio de
  Vercel ya visto en sesiones anteriores. Se resolvió cuando el usuario promovió manualmente el
  despliegue a "Production" desde el dashboard de Vercel.

**Lección para la próxima vez que esto pase**: comprobar primero `Deployments` del proyecto en
Vercel y la etiqueta "Production" en el más reciente, antes de asumir que el merge no funcionó.

---

## 2026-09-29 14:35 — Avatares reales en "Actividad Reciente" e "Historial de Actividad"

El usuario pidió quitar cualquier resto de "[DEMO]" (ya arreglado en el PR #32, pendiente de fusión
— esto explica por qué seguía apareciendo en la captura que envió) y hacer estas dos listas más
dinámicas, con una foto pequeña por movimiento en vez de un icono genérico repetido.

- `MovimientoPuntosDTO` gana `usuarioFotoPerfil` (dato real, ya existía en `Usuario`, nunca se
  exponía) — actualizado en los 3 sitios donde se construye.
- Ambas listas muestran ahora la foto real del cliente (o el placeholder ya existente si no tiene
  una subida — mismo mecanismo que el perfil del cliente, nada inventado) con una insignia de color
  verde/rojo superpuesta.
- El título de cada fila del dashboard pasa a ser el nombre real del cliente.

Verificado visualmente en local con los 221 movimientos reales de Mexican Food. `mvn test` y E2E
completo (15/15) sin regresiones. Commit añadido a la rama existente del PR #33 (no se abrió un PR
nuevo, para no fragmentar más).

---
