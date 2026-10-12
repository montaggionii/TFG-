# Pruebas aisladas (backend + frontend + E2E)

`scripts/test-isolated.sh` ejecuta todas las pruebas con una base MySQL desechable en Docker y servicios en puertos de pruebas. No usa la BD de desarrollo ni el `.env` real.

```bash
scripts/test-isolated.sh                 # todo
scripts/test-isolated.sh --backend-only  # solo ./mvnw test (incluye contextLoads)
scripts/test-isolated.sh --frontend-only # build Angular + Karma
scripts/test-isolated.sh --e2e-only      # Playwright
```

Requisitos: Docker en marcha con la imagen `mysql:8`, JDK 17, Node, `openssl`. El Chromium de Playwright se instala solo si falta.

## Qué hace
- **Puertos de pruebas**: MySQL `127.0.0.1:3317`, backend `8181`, frontend `8180` (desarrollo usa 3306/8081/8100). Si alguno está ocupado, aborta sin detener nada ajeno.
- **Aislamiento**: el JDBC URL lo fija el propio script; los servicios arrancan con `env -i` (sin `DB_*`, ni `.env`). Credenciales aleatorias solo en memoria, nunca impresas. El frontend se compila con `-c e2e` (`environment.e2e.ts` apunta a `:8181`) y CORS se abre solo a `:8180`.
- **Limpieza**: al terminar (o con Ctrl+C) elimina su contenedor y detiene solo los procesos que arrancó (backend/frontend, y solo si son `java`/`node`). Nunca mata el listener del puerto de la BD: en macOS ese puerto lo escucha Docker Desktop (`com.docker.backend`), no el contenedor.
- **Informes**: `test-reports/<fecha>/` (surefire, `karma.log`, `ng-build.log`, `e2e.json`/`e2e.log`, `e2e-artifacts/` con trazas y capturas, logs de servicios). Está en `.gitignore`.

## Interpretar el resultado
Al final imprime Backend Java / Angular build / Angular tests / E2E con `OK` o `FALLO` y los recuentos, y `TODO CORRECTO` o `HAY FALLOS` (código de salida 0 / 1). Código 3: no pudo garantizar el aislamiento o falta una dependencia (no se ejecutó nada contra datos reales).

## Contraseña de administrador
El backend ya no tiene contraseña de admin por defecto: sin `FIDELYFOOD_ADMIN_PASSWORD` el login de admin responde siempre 401 y se registra un aviso. El script genera una aleatoria para las pruebas. Para usar el panel admin en desarrollo, define `FIDELYFOOD_ADMIN_PASSWORD` en tu `.env`.
