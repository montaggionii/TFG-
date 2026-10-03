# Desarrollo — FidelyFood

Guía para arrancar y trabajar en local (macOS). Verificado en este repositorio: `./mvnw spring-boot:run` (vía `service_start`), `npm start -- --port 8100` y la suite de tests; `ionic serve` es el comando que documenta `go-local.sh` y no se ha ejecutado en esta revisión.

## Requisitos
- **JDK 17** (el `pom.xml` fija `java.version=17`). Con otro JDK por defecto (p. ej. 25) los tests con Mockito fallan; el Agent Layer detecta el JDK 17 automáticamente (`/usr/libexec/java_home -v 17`). En tu shell: `export JAVA_HOME=$(/usr/libexec/java_home -v 17)`.
- **Node 20+** (probado con 22) y npm.
- **MySQL** local con la base `proyectoTFG` y un usuario con acceso. Credenciales y secretos en `.env` (copia `.env.example`; `.env` está en `.gitignore`; nunca lo subas).
- `gh` (GitHub CLI) autenticado, solo si usas las herramientas de GitHub del agente.

## Backend (Spring Boot, puerto 8081)
```bash
set -a && source .env && set +a      # exporta DB_USERNAME, DB_PASSWORD, APP_JWT_SECRET, ...
./mvnw spring-boot:run               # comprobar: curl http://localhost:8081/ping  → pong
```
- Configuración: `src/main/resources/application.properties` (variables con valores por defecto de desarrollo). El perfil `prod` exige `APP_JWT_SECRET` y valida el entorno.
- El esquema se crea/ajusta solo al arrancar (`ddl-auto=update`); no hay migraciones.
- Documentación de la API en [API.md](API.md); Swagger solo para `ROLE_ADMIN`.

## Frontend (Angular + Ionic, puerto 8100)
```bash
cd frontend
npm ci
npx ionic serve --port 8100          # o: npm start -- --port 8100 --host 127.0.0.1
```
- La URL de la API sale de `frontend/src/environments/environment*.ts` (`apiUrl`). Local: `http://localhost:8081`. `go-local.sh` / `go-public.sh` cambian entre local y público.
- Build de producción: `npm run build -- --configuration production` → `frontend/www`.

## Con el Agent Layer
`service_start` (backend/frontend; si el puerto ya está ocupado no toca nada), `service_status`, `service_stop`, `inspect_logs`, `call_api`. Ver [AGENT_LAYER.md](AGENT_LAYER.md).

## Access Center (herramienta local)
```bash
node access-center/server.js         # http://localhost:5757 — credenciales de desarrollo y monitor del agente en /jarvis.html
```
Solo escucha en `127.0.0.1`; nunca se despliega.

## Git
- Ramas `agent/<tema>` para el agente, `fix/…`/`feat/…` para personas; crea siempre las ramas desde `origin/main` (la `main` local puede estar divergida).
- Commits pequeños y lógicos; el merge de los PR lo decide una persona. Detalle en [AGENTS.md](AGENTS.md).

## Problemas conocidos del entorno
- **Aiven (MySQL gratuito) se apaga por inactividad** → en producción aparece como `UnknownHostException` en los logs de Render; se enciende desde la consola de Aiven.
- **Render (plan gratuito) tiene disco efímero**: por eso las imágenes subidas se guardan en la BD, no en `uploads/`.
- **Playwright**: tras actualizar la dependencia hay que reinstalar el navegador (`npx playwright install chromium`).
