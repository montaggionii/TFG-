#!/usr/bin/env bash
# Ejecuta las pruebas de FidelyFood (backend Java, frontend Angular, E2E Playwright)
# con servicios y base de datos AISLADOS y desechables. Ver docs/TESTING_ISOLATED.md.
#
# Uso: scripts/test-isolated.sh [--backend-only | --frontend-only | --e2e-only]
#
# Garantias: nunca lee el .env real, nunca usa la BD de desarrollo, solo detiene lo que
# el propio script arranco y aborta si no puede garantizar el aislamiento.
set -uo pipefail

DB_PORT=3317; API_PORT=8181; WEB_PORT=8180   # puertos de PRUEBAS (los de desarrollo son 3306/8081/8100)
DB_NAME=proyectoTFG_isolated_test
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
REPORTS="$ROOT/test-reports/$STAMP"
CONTAINER="fidelyfood-test-$$-$STAMP"
RUN_BACKEND=1; RUN_FRONTEND=1; RUN_E2E=1
case "${1:-}" in
  --backend-only) RUN_FRONTEND=0; RUN_E2E=0 ;;
  --frontend-only) RUN_BACKEND=0; RUN_E2E=0 ;;
  --e2e-only) RUN_BACKEND=0; RUN_FRONTEND=0 ;;
  "") ;;
  *) echo "Uso: $0 [--backend-only|--frontend-only|--e2e-only]"; exit 2 ;;
esac

MY_PIDS=(); STARTED_CONTAINER=0; PORTS_OWNED=()
RES_JAVA="-"; RES_JAVA_N=""; RES_NG="-"; RES_KARMA="-"; RES_E2E="-"; RES_E2E_N=""; EXIT=0

die() { echo "ABORTADO (aislamiento no garantizado o dependencia ausente): $*" >&2; exit 3; }
listener() { lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null | head -1; }

cleanup() {
  # Solo los puertos de servicios que arrancamos nosotros (backend/frontend), y solo si el listener es java/node.
  # NUNCA el puerto de la BD: en macOS lo escucha com.docker.backend (Docker Desktop), no el contenedor.
  for port in "${PORTS_OWNED[@]:-}"; do
    [ -n "$port" ] || continue; pid="$(listener "$port")"; [ -n "$pid" ] || continue
    case "$(ps -o comm= -p "$pid" 2>/dev/null)" in *java|*node) kill "$pid" 2>/dev/null ;; esac
  done
  for pid in "${MY_PIDS[@]:-}"; do [ -n "$pid" ] && kill "$pid" 2>/dev/null; done
  [ "$STARTED_CONTAINER" = 1 ] && docker rm -f "$CONTAINER" >/dev/null 2>&1
  true
}
trap cleanup EXIT INT TERM

echo "== Comprobando dependencias y aislamiento"
command -v node >/dev/null || die "node no encontrado"
command -v openssl >/dev/null || die "openssl no encontrado"
JAVA_HOME="$(/usr/libexec/java_home -v 17 2>/dev/null)" || die "JDK 17 no encontrado"
export JAVA_HOME
for p in $DB_PORT $API_PORT $WEB_PORT; do
  [ -z "$(listener $p)" ] || die "el puerto de pruebas $p ya esta en uso (no se detiene nada ajeno)"
  [ "$p" = "$DB_PORT" ] || PORTS_OWNED+=("$p")
done
if [ "$RUN_BACKEND" = 1 ] || [ "$RUN_E2E" = 1 ]; then
  docker info >/dev/null 2>&1 || die "Docker no responde"
  docker image inspect mysql:8 >/dev/null 2>&1 || die "falta la imagen mysql:8 (docker pull mysql:8)"
fi
mkdir -p "$REPORTS"

# Credenciales desechables, solo en memoria de este proceso (nunca se imprimen ni se guardan).
DB_PASS="$(openssl rand -hex 16)"
export SEED_PW="Seed$(openssl rand -hex 8)!" ADMIN_PW="Adm$(openssl rand -hex 8)!"
# Entorno LIMPIO para los servicios: no hereda DB_*, .env ni variables de desarrollo.
clean_env() { env -i PATH="$PATH" HOME="$HOME" JAVA_HOME="$JAVA_HOME" LANG=C.UTF-8 \
  DB_URL="jdbc:mysql://127.0.0.1:$DB_PORT/$DB_NAME?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true" \
  DB_USERNAME=fftest DB_PASSWORD="$DB_PASS" APP_SEED_RESTAURANT_PASSWORD="$SEED_PW" FIDELYFOOD_ADMIN_PASSWORD="$ADMIN_PW" \
  APP_CORS_ORIGINS="http://localhost:$WEB_PORT" APP_BASE_URL="http://localhost:$API_PORT" "$@"; }

if [ "$RUN_BACKEND" = 1 ] || [ "$RUN_E2E" = 1 ]; then
  echo "== Arrancando MySQL desechable ($CONTAINER, 127.0.0.1:$DB_PORT)"
  docker run -d --name "$CONTAINER" --label fidelyfood-test=1 -p 127.0.0.1:$DB_PORT:3306 \
    -e MYSQL_ROOT_PASSWORD="$DB_PASS" -e MYSQL_DATABASE="$DB_NAME" -e MYSQL_USER=fftest -e MYSQL_PASSWORD="$DB_PASS" mysql:8 >/dev/null \
    || die "no se pudo crear el contenedor"
  STARTED_CONTAINER=1
  ok=0; for _ in $(seq 1 60); do
    docker exec "$CONTAINER" mysqladmin ping -uroot -p"$DB_PASS" --silent >/dev/null 2>&1 && docker exec "$CONTAINER" mysql -ufftest -p"$DB_PASS" -e "select 1" "$DB_NAME" >/dev/null 2>&1 && { ok=1; break; }
    sleep 2
  done
  [ "$ok" = 1 ] || die "MySQL de pruebas no arranco"
fi

if [ "$RUN_BACKEND" = 1 ]; then
  echo "== Backend Java (./mvnw test, incluye contextLoads) contra la BD aislada"
  (cd "$ROOT" && clean_env ./mvnw -B test) > "$REPORTS/backend-mvn.log" 2>&1
  rc=$?
  rm -rf "$REPORTS/surefire-reports"; cp -R "$ROOT/target/surefire-reports" "$REPORTS/surefire-reports" 2>/dev/null
  RES_JAVA_N="$(grep -E "^\[(INFO|ERROR|WARNING)\] Tests run:" "$REPORTS/backend-mvn.log" | tail -1 | sed -E 's/^\[[A-Z]+\] //')"
  [ $rc -eq 0 ] && RES_JAVA="OK" || { RES_JAVA="FALLO"; EXIT=1; }
fi

if [ "$RUN_FRONTEND" = 1 ] || [ "$RUN_E2E" = 1 ]; then
  [ -d "$ROOT/frontend/node_modules" ] || { echo "== npm ci"; (cd "$ROOT/frontend" && npm ci --no-audit --no-fund) > "$REPORTS/npm-ci.log" 2>&1 || die "npm ci fallo (ver $REPORTS/npm-ci.log)"; }
  CHROME="$(find "$HOME/Library/Caches/ms-playwright" "$HOME/.cache/ms-playwright" -type f \( -name chrome-headless-shell -o -name headless_shell \) 2>/dev/null | head -1)"
  if [ -z "$CHROME" ]; then
    echo "== Instalando Chromium de Playwright (herramienta ya existente)"; (cd "$ROOT/frontend" && npx playwright install chromium) > "$REPORTS/playwright-install.log" 2>&1
    CHROME="$(find "$HOME/Library/Caches/ms-playwright" "$HOME/.cache/ms-playwright" -type f \( -name chrome-headless-shell -o -name headless_shell \) 2>/dev/null | head -1)"
  fi
  [ -n "$CHROME" ] || die "no hay navegador Chromium para las pruebas"
fi

if [ "$RUN_FRONTEND" = 1 ]; then
  echo "== Frontend: compilacion Angular"
  (cd "$ROOT/frontend" && npx ng build -c development) > "$REPORTS/ng-build.log" 2>&1 && RES_NG="OK" || { RES_NG="FALLO"; EXIT=1; }
  echo "== Frontend: tests unitarios (Karma)"
  (cd "$ROOT/frontend" && CHROME_BIN="$CHROME" npx ng test --watch=false --browsers=ChromeHeadless) > "$REPORTS/karma.log" 2>&1 && RES_KARMA="OK" || { RES_KARMA="FALLO"; EXIT=1; }
  RES_KARMA="$RES_KARMA ($(grep -Eo 'TOTAL: [0-9]+ SUCCESS|TOTAL: [0-9]+ FAILED' "$REPORTS/karma.log" | tail -1))"
fi

if [ "$RUN_E2E" = 1 ]; then
  echo "== Arrancando backend de pruebas (:$API_PORT)"
  (cd "$ROOT" && clean_env ./mvnw -B -q spring-boot:run -Dspring-boot.run.arguments=--server.port=$API_PORT) > "$REPORTS/e2e-backend.log" 2>&1 &
  MY_PIDS+=($!)
  echo "== Arrancando frontend de pruebas (:$WEB_PORT, apunta a :$API_PORT)"
  (cd "$ROOT/frontend" && exec npx ng serve -c e2e --port $WEB_PORT --host 127.0.0.1) > "$REPORTS/e2e-frontend.log" 2>&1 &
  MY_PIDS+=($!)
  up=0; for _ in $(seq 1 90); do
    [ "$(curl -s -o /dev/null -w '%{http_code}' localhost:$API_PORT/api/promociones)" != 000 ] && [ "$(curl -s -o /dev/null -w '%{http_code}' localhost:$WEB_PORT/)" = 200 ] && { up=1; break; }
    sleep 3
  done
  [ "$up" = 1 ] || { RES_E2E="NO ARRANCO (ver $REPORTS/e2e-*.log)"; EXIT=1; }
  if [ "$up" = 1 ]; then
    echo "== E2E Playwright"
    (cd "$ROOT/frontend" && E2E_BASE_URL="http://localhost:$WEB_PORT" E2E_API_URL="http://localhost:$API_PORT" \
      APP_SEED_RESTAURANT_PASSWORD="$SEED_PW" FIDELYFOOD_ADMIN_PASSWORD="$ADMIN_PW" \
      PLAYWRIGHT_JSON_OUTPUT_NAME="$REPORTS/e2e.json" npx playwright test --reporter=list,json --output="$REPORTS/e2e-artifacts") > "$REPORTS/e2e.log" 2>&1
    rc=$?
    RES_E2E_N="$(grep -E '^\s+[0-9]+ (passed|failed|skipped|flaky)' "$REPORTS/e2e.log" | sed -E 's/^ +//' | paste -sd, -)"
    [ $rc -eq 0 ] && RES_E2E="OK" || { RES_E2E="FALLO"; EXIT=1; }
  fi
fi

echo
echo "================= RESULTADO ================="
[ "$RUN_BACKEND" = 1 ]  && echo "Backend Java   : $RES_JAVA  ${RES_JAVA_N}"
[ "$RUN_FRONTEND" = 1 ] && echo "Angular build  : $RES_NG" && echo "Angular tests  : $RES_KARMA"
[ "$RUN_E2E" = 1 ]      && echo "E2E Playwright : $RES_E2E  ${RES_E2E_N}"
echo "Informes       : $REPORTS"
[ $EXIT -eq 0 ] && echo "TODO CORRECTO" || echo "HAY FALLOS (ver informes)"
exit $EXIT
