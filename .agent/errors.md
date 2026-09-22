# Errores encontrados — FidelyFood / TFG

## Resueltos
- **Corrupción de refs de git** en `projects/TFG-repaired-20260917/.git` (`refs/heads/main 2`, `refs/remotes/origin/HEAD 2` apuntando a un commit antiguo / SHA nulo). Causaba `fatal: bad object` al hacer `git push`/`fetch`. Resuelto eliminando los archivos duplicados.
- **Secretos en texto plano** en `application.properties` y `JwtUtil.java` (ver decisions.md). Resuelto moviéndolos a variables de entorno.
- **`.gitignore` de `go-local.sh`/`go-public.sh`**: estos scripts hacen `sed` sobre la línea `app.base-url=...` de `application.properties`, que había desaparecido en el refactor pendiente. Restaurada (con valor por defecto vía env var) para no romper esos scripts.

## Sin resolver / pendientes de validar
- No se ha ejecutado ningún build ni test en esta sesión (Fase 4 de validación real sigue pendiente) — no hay evidencia todavía de que el backend/frontend compilen y arranquen correctamente tras la consolidación.
- La contraseña real de MySQL que estuvo expuesta en texto plano en el working tree (antes del commit) sigue siendo la contraseña activa del servidor — hay que rotarla.
