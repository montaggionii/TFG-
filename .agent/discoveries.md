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
