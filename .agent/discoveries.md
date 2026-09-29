# Hallazgos — FidelyFood / TFG

## Copias del proyecto encontradas en el sistema (auditoría 2026-09-22)
| Ruta | Veredicto |
|---|---|
| `projects/TFG-repaired-20260917` | **Canónica** — más completa, con trabajo activo |
| `Desktop/TFG-` | Git idéntico a la canónica en HEAD, pero `.git` corrupto por iCloud (refs duplicadas, index.lock timeout). Nada exclusivo. |
| `projects/TFG-` | Snapshot antiguo (commit `6249d68`), sin panel admin ni migración de puntos. |
| `projects/TFG-_zero_byte_backup_20260603_010401` | Backend real a 0 bytes (nombre literal). `.git` corrupto (objetos faltantes). Sin valor. |
| `projects/TFG-clean` | Snapshot muy antiguo (2 commits), solo backend base. |
| `Desktop/FidelyFood_Limpio` | Roto: `pom.xml`/`README.md` a 0 bytes, archivos duplicados de Finder (`controller 2/`, etc.), sin `.git`. |
| `Downloads/SpringBoot_TFG` | Primer commit del proyecto únicamente. |
| `Downloads/SpringBoot_TFG 2` | Casi idéntico a `TFG-clean`, sin frontend. |

## Secretos encontrados y corregidos
- `src/main/resources/application.properties`: contraseña de MySQL en texto plano (usuario `fidelyfood_app`) → movida a `${DB_PASSWORD:}`. Valor real no repetido aquí a propósito; pendiente rotarla (ver tasks.md).
- `src/main/java/.../security/JwtUtil.java`: secreto JWT hardcodeado en el código fuente → movido a `${app.jwt.secret:...}`. El valor antiguo queda invalidado (ya no se usa para firmar), no se repite aquí.

## Corrupción de git por sincronización (iCloud/Finder)
Patrón recurrente: archivos duplicados con sufijo `" 2"`/`" 3"` (p.ej. `config 3.xml`, `refs/heads/main 2`, `refs/remotes/origin/HEAD 2`, `.git/index 2`) causados por conflictos de sincronización de iCloud Drive. Encontrados y limpiados en `Desktop/TFG-` (documentado, no tocado — carpeta descartable) y en `projects/TFG-repaired-20260917` (limpiado, ya que bloqueaba `git push`/`fetch`).

## "Llamaq"
Ver `decisions.md` — es el nombre que usa el usuario para la app Claude Desktop, no un proyecto propio.

## Datos históricos de FidelyFood (investigación 2026-09-22)

**BD actual detectada**: MySQL local (`localhost:3306`, MySQL 9.6.0), base `proyectoTFG`, usuario `fidelyfood_app`. Contenido real: 1 restaurante ("Restaurante E2E", creado 2026-09-16), 1 usuario ("Test E2E"), 0 filas en el resto de tablas (promociones, movimientos_puntos, recompensas, usuario_restaurante_puntos, admin_logs, admin_reservations). Esta base de datos ya existía así antes de esta sesión — no se insertaron datos de prueba durante la consolidación.

**Fuentes históricas encontradas**:
1. `DataInitializer.java` — borrado en el PR #1, recuperado del commit `eea6193` (versión pre-consolidación). Sembraba 2 restaurantes cada vez que arrancaba el backend:
   - "Alabroster - Comida Colombiana" — email `alabroster@test.com`
   - "Venezuela Food" — email `venezuelafood@gmail.com`
   - Contraseña de ambos: variable de entorno `app.seed.restaurant.password` (sin valor por defecto real, placeholder `change-me-restaurant-password`) — NO hardcodeada como "123456".
   - También creaba un admin en `app.admin.email` (`admin@fidelyfood.local` por defecto) con password de `app.admin.password`.
2. Carpeta `uploads/` (fuera de git, con contenido real): imágenes subidas por la app entre el 9 y el 13 de mayo de 2026 (timestamp embebido en el nombre de archivo). Incluye `1778686469641_logo_restaurante mexicano.png` — confirma que existió un **tercer restaurante mexicano** que no está en `DataInitializer.java` (se creó manualmente vía la UI de registro, no por el seed). También hay `logoColombia.avif` (x2), fotos de comida venezolana (x4, re-subidas varias veces), `bandeja-paisa.webp`, `EmpanadasCol.webp`, fotos de perfil de usuarios `user_2_*` (7 archivos) y `usuario_1_*` (2 archivos), y `restaurantes/restaurant_1_*.jpeg`.
3. Dos dumps SQL (`~/Desktop/proyectoTFG.sql` del 31 de agosto, y `~/projects/TFG-/database/proyectoTFG.sql`) — **solo estructura, 0 filas de datos** (`LOCK TABLES` seguido inmediatamente de `UNLOCK TABLES` en las 5 tablas). No sirven para recuperar datos.
4. Binlogs de MySQL: `log_bin=ON`, pero con retención de 30 días (`binlog_expire_logs_seconds=2592000`) y el binlog más antiguo disponible es del 25 de agosto de 2026 — los cambios de mayo (cuando se crearon los restaurantes reales) ya fueron purgados. Vía de recuperación descartada.

**Conclusión**: las filas de datos originales (mayo 2026) no son recuperables de ningún archivo del sistema. Reconstruibles parcialmente: 2 de los 3 restaurantes conocidos vía código semilla (con contraseña nueva, no la original). El restaurante mexicano, los usuarios reales, promociones, puntos y movimientos históricos no dejaron rastro de sus valores exactos en ningún archivo — solo las imágenes como evidencia de que existieron.

**Sobre "123456" como credencial**: el único sitio del proyecto donde aparece es `docs/api-examples.json`, como ejemplo genérico de documentación de la API (`user@test.com` / `123456`), no como credencial real de ningún restaurante específico.

**Reconstrucción aplicada (2026-09-22, con confirmación del usuario)**: se creó `config/HistoricalRestaurantSeeder.java`, un `CommandLineRunner` idempotente que siembra los 3 restaurantes al arrancar el backend, si no existen ya (busca por email):
- "Alabroster - Comida Colombiana" (`alabroster@test.com`) — nombre/email originales, del código semilla recuperado.
- "Venezuela Food" (`venezuelafood@gmail.com`) — nombre/email originales, del código semilla recuperado.
- "Mexican Food" (`mexicanfood@fidelyfood.local`) — **nombre y email reconstruidos, no verificados**. El dato original solo sobrevivió como el logo `1778686469641_logo_restaurante mexicano.png`, subido en mayo de 2026; no se encontró su nombre/email real en ningún archivo.

Contraseña de los 3: nueva, generada, guardada solo en `.env` local (variable `APP_SEED_RESTAURANT_PASSWORD`, gitignored) — no es la contraseña histórica real (esa se perdió junto con la base de datos original, estaba hasheada con BCrypt).

Validado: los 3 aparecen en la BD, el login de restaurante funciona (probado con Venezuela Food), el logo del restaurante mexicano se sirve correctamente, y el dashboard de admin cuenta 4 negocios (los 3 + el de prueba E2E).

Backup de la BD tomado antes de la siembra: `backups/proyectoTFG_20260922_131229.sql` (gitignored, local).

## "Canjear puntos" es una funcionalidad completa que nunca se terminó de conectar (auditoría 2026-09-27/29)

El frontend (`restaurante-detalle-page.component.ts`, pantalla de detalle de un restaurante para
el cliente) tiene una UI completa de canje de puntos: muestra `promo.puntosNecesarios`, un saldo
`ptsRestaurante`/`saldoRestaurante` **por restaurante** (distinto del saldo global del usuario), y
al confirmar llama a `promocionService.canjearPromocion()` → `POST /api/canjes`.

**Ese endpoint no existe en el backend.** No hay controller, service ni DAO para `/api/canjes`
(confirmado con `grep` sobre todo `controller/` y `service/`). Tampoco existe el campo
`puntosNecesarios` en la entidad `Promocion` (solo existe `puntosOtorgados`), ni ningún concepto de
"saldo de puntos por restaurante" en el backend — el único saldo real es `Usuario.puntos`, global.

**Consecuencia real, verificada por lectura del código:** cualquier cliente que intente canjear una
promoción de tipo CANJEAR recibe un 404 real. El frontend lo maneja correctamente (revierte el
punto optimista, muestra un modal de error) — no finge un canje exitoso ni genera datos falsos —
pero la funcionalidad está simplemente rota de punta a punta.

**Por qué no lo implementé:** requiere diseñar un modelo de datos real (¿el saldo "por restaurante"
se calcula de `MovimientoPuntos` filtrado por restaurante, como ya hace `RestauranteService`, o es
un concepto nuevo? ¿de dónde sale `puntosNecesarios` de una promoción CANJEAR?) y lógica de
descuento de puntos con las mismas garantías de integridad que ya existen en `aplicarPromocion`
(nunca permitir gastar más de lo que se tiene, registrar el movimiento). Es una funcionalidad nueva
completa, no un bugfix rápido. Recomendado para una sesión dedicada, con producción disponible para
probar el flujo end-to-end. Actualización 29/09: ya hay promociones CANJEAR reales creadas para
Mexican Food, Alabroster y Venezuela Food (con foto propia cada una) que se gestionan bien desde el
lado del restaurante — el hueco sigue siendo únicamente el lado del canje real por el cliente.

## Causa real de la caída de producción de 45h (2026-09-27 a 2026-09-29): Aiven apaga la BD gratuita por inactividad

Durante horas se asumió (incluido por mí) que era un incidente de Render, porque coincidió con un
incidente real de plataforma en Render (status.render.com, región Oregon) el mismo día. Pero ese
incidente se resolvió en un par de horas y el backend siguió sin responder muchísimo más tiempo.

**Causa real, encontrada por el usuario en console.aiven.io**: el plan gratuito de MySQL en Aiven
(`Free-1-1gb`) **se apaga solo tras un periodo de inactividad** — la propia consola de Aiven lo
avisa explícitamente: *"Scale up your MySQL for only $5/month... prevent automatic power-offs
during inactivity"*. Cuando el servicio está en estado "Powered off", Aiven retira también el
registro DNS del host (`fidelyfood-db-fidelyfood.b.aivencloud.com`), lo que explica el
`UnknownHostException`/`NXDOMAIN` que veíamos — confirmado independientemente desde esta misma
máquina con `nslookup` (NXDOMAIN) antes de que el usuario mirara el dashboard.

**Los datos nunca estuvieron en riesgo**: la consola mostraba backups reales (548 MB, el más
reciente de hace 4 días) durante todo el apagado. Encender el servicio de nuevo (botón de acción
en la vista "Overview" del servicio en Aiven) restauró el DNS y la conexión sin pérdida de datos.
Verificado con un login real contra producción con contraseña incorrecta → "Credenciales
incorrectas" (no un error de conexión), confirmando que los datos siguen ahí.

**Lección para el futuro**: si vuelve a pasar, comprobar primero `console.aiven.io` (estado
"Powered off" del servicio MySQL) antes que el dashboard de Render — el síntoma desde Render
(`Communications link failure` / `UnknownHostException` en los logs de deploy) es idéntico sea
cual sea la causa, pero el origen real está en Aiven, no en Render. Considerar si merece la pena
pagar el plan mínimo de pago de Aiven para evitar que esto se repita en una demo o entrega del TFG.

## Inestabilidad del alias de dominio de Vercel tras un merge (2026-09-29)

El PR #41 (fotos reales en el dashboard) se fusionó correctamente a `main`, y la API de GitHub
(`commits/{sha}/status`) confirmó que Vercel completó un despliegue de producción real para ese
commit en los 3 proyectos conectados. Pese a eso, `fidelyfoodapp.vercel.app` siguió sirviendo la
build antigua durante varios minutos (confirmado que no era caché: `x-vercel-cache: MISS` con
`last-modified` actual). Se resolvió cuando el usuario entró a "Deployments" del proyecto en Vercel
y promovió manualmente el despliegue nuevo a "Production". Mismo patrón de inestabilidad del alias
ya visto en sesiones anteriores con este mismo proyecto. Comprobar siempre esa pestaña tras fusionar
algo que toque el frontend, antes de asumir que el merge no funcionó.
