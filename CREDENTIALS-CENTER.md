# FidelyFood Access Center

Interfaz visual local, de solo lectura, para consultar las cuentas de prueba del entorno local de FidelyFood (admin, restaurantes, clientes) — nombre, email, rol, estado y contraseña (cuando se conoce en texto plano).

## Cómo arrancarlo

```bash
./start-credentials.sh
```

o directamente:

```bash
cd access-center
npm install   # solo la primera vez
node server.js
```

Abre **http://localhost:5757** en el navegador.

El puerto es configurable con la variable de entorno `ACCESS_CENTER_PORT` en `.env` (por defecto `5757`, no choca con el backend `8081` ni el frontend `8100`).

## De dónde saca los datos

**No hay una lista de credenciales hardcodeada.** El servidor (`access-center/server.js`) en cada petición:

1. Consulta en vivo la base de datos MySQL real (`proyectoTFG`, mismas credenciales `DB_USERNAME`/`DB_PASSWORD` del `.env` que usa el backend) para obtener restaurantes y usuarios: nombre, email, rol, estado, id.
2. Cruza esos emails contra las **únicas** contraseñas en texto plano que existen realmente en el proyecto:
   - Admin: el valor por defecto de `fidelyfood.admin.password` en `AuthController.java` (o `FIDELYFOOD_ADMIN_PASSWORD` si lo defines en `.env`).
   - Los 3 restaurantes históricos reconstruidos: `APP_SEED_RESTAURANT_PASSWORD` del `.env`.
   - Cualquier otra cuenta (p. ej. usuarios registrados normalmente por la app): su contraseña real está hasheada con BCrypt en la base de datos y **no es recuperable** — la interfaz lo indica explícitamente como "no disponible (solo hash)", nunca inventa un valor.

Esto es la fuente única de verdad: la misma que usa el backend para autenticar. No hay una segunda copia de credenciales que se pueda desincronizar.

## Cómo se actualiza

La página vuelve a pedir `/api/accounts` cada 15 segundos automáticamente. Si añades, borras o desactivas una cuenta en la base de datos, se refleja solo con recargar o esperar ese refresco — no hace falta reiniciar el servidor del Access Center.

## Cómo lo usa el agente (Claude Code)

El mismo endpoint que usa la interfaz sirve como fuente para pruebas automatizadas:

```bash
curl -s http://localhost:5757/api/accounts | jq
```

Con el Access Center arrancado, el agente puede consultar ese endpoint antes de hacer un login de prueba (cliente/restaurante/admin) en vez de adivinar o hardcodear credenciales en el código de test.

## Seguridad

- El servidor escucha **solo en `127.0.0.1`** (ver `HOST` en `server.js`) — no es accesible desde otros dispositivos de tu red ni desde internet, aunque tu Mac esté en una red compartida.
- Nunca se despliega a Render/Vercel/Netlify/GitHub Pages ni ningún sitio público — es exclusivamente para correr en tu Mac.
- `access-center/node_modules/` está en `.gitignore` (regla genérica `node_modules/` ya existente).
- El propio código de `server.js`/`index.html` **no contiene ninguna contraseña real** — todas se leen en tiempo de ejecución desde `.env` (gitignored) o desde la base de datos local. Es seguro tener estos dos archivos en el repositorio.
- La interfaz es de **solo lectura**: no hay ningún endpoint que modifique la base de datos.

## Estado actual (última auditoría)

- Administradores: 1 (`admin@fidelyfood.local`, contraseña conocida)
- Restaurantes: 4 (3 históricos reconstruidos con contraseña conocida + 1 de pruebas E2E con solo hash)
- Clientes: 1 (solo hash, sin contraseña recuperable)
- Total: 6 cuentas, todas activas
