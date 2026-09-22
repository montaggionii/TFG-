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
