# Despliegue — FidelyFood

Estado real a fecha de hoy: **DESPLEGADO Y VERIFICADO (18/11/2026)**.

## Producción en marcha

- **Frontend**: https://fidelyfoodapp.vercel.app (Vercel, plan Hobby gratis, deploy automático desde `main`)
  - Landing pública en `/`, página de descarga del APK en `/descargar`, APK en `/apk/fidelyfood-v1.0.0.apk`
- **Backend**: https://fidelyfood-backend-api.onrender.com (Render, plan Free, Docker, rama `main`)
  - `GET /ping` → `pong`; registro y login verificados en producción
- **Base de datos**: MySQL Free-1-1gb en **Aiven** (`fidelyfood-db-fidelyfood.b.aivencloud.com:19621/defaultdb`, DigitalOcean Ámsterdam)
  - El seeder del backend creó las tablas y 3 restaurantes demo

## Variables del servicio Render (Environment)

`SPRING_PROFILES_ACTIVE=prod`, `APP_BASE_URL=https://fidelyfood-backend-api.onrender.com`,
`APP_CORS_ORIGINS=https://fidelyfoodapp.vercel.app`, `APP_JWT_SECRET` (generado, secreto),
`FIDELYFOOD_ADMIN_PASSWORD` (definida por el dueño), `DB_URL` / `DB_USERNAME=avnadmin` / `DB_PASSWORD` (Aiven).

## Avisos operativos (gratis = comportamiento raro pero normal)

- **Render Free**: la instancia se apaga por inactividad; la primera petición tarda ~50 s en despertar.
- **Aiven Free**: si la cuenta entra en inactividad, el servicio se puede quedar "Powered off" → Power on en el panel (el host se conserva; basta con redeployar Render si DNS falló durante el apagón).
- **Importante**: el plan Free de MySQL de Aiven se **retira el 21/12/2026**. Antes de esa fecha migrar la BD (p. ej. Clever Cloud MySQL, o Supabase/Neon con PostgreSQL ajustando driver y dialecto en `application.properties` + `pom.xml`).

## Arquitectura de producción elegida

- **Backend**: Railway (detecta Spring Boot automáticamente / usa el `Dockerfile` del repo) + plugin MySQL de Railway (evita migrar de motor de base de datos).
- **Frontend**: Vercel o Netlify (build estático de `frontend/www`), o el propio hosting estático de Railway.
- **Motivo**: mantiene el código de acceso a datos (MySQL) sin cambios, con el menor número de piezas nuevas que aprender y el menor coste para el tamaño actual del proyecto.

## Ya preparado en el código (fusionado en `main`)

- [x] `Dockerfile` (build multi-stage Maven → JRE) y `.dockerignore` para el backend.
- [x] URL de base de datos externalizada (`DB_URL`, en vez de `localhost:3306` fijo).
- [x] Orígenes CORS configurables por variable de entorno (`APP_CORS_ORIGINS`), sin perder los de desarrollo.
- [x] El backend falla al arrancar si el perfil `prod` está activo sin `APP_JWT_SECRET` configurado (evita quedarse con el secreto de desarrollo en producción).
- [x] Swagger/OpenAPI restringido a `ROLE_ADMIN` (antes público).
- [x] `.env.example` documentando todas las variables necesarias.
- [x] Clave de Google Maps configurada en `environment.prod.ts` (pendiente de restringirla por dominio en Google Cloud Console una vez se conozca la URL final).

## Pendiente — requiere acciones manuales del usuario (no se pueden automatizar sin sus credenciales)

1. **Crear cuenta en Railway** y autenticar la CLI (`railway login` — abre un enlace que el usuario aprueba en su propio navegador).
2. Crear el proyecto Railway, añadir el plugin de MySQL, y copiar sus variables de conexión (`DB_URL`, `DB_USERNAME`, `DB_PASSWORD`) a las variables de entorno del servicio.
3. Configurar en Railway: `APP_JWT_SECRET` (nuevo, fuerte, generado — nunca el valor de desarrollo), `SPRING_PROFILES_ACTIVE=prod`, `APP_CORS_ORIGINS` (con la URL final del frontend, una vez exista).
4. Desplegar el backend y verificar `GET /ping` en la URL pública que asigne Railway.
5. Crear cuenta en Vercel/Netlify, compilar el frontend (`ionic build --prod`) con `environment.prod.ts` apuntando a la URL real del backend, y desplegar `frontend/www`.
6. Migrar los datos de la MySQL local a la de Railway — **requiere confirmación explícita antes de tocar nada** (ver regla de no ejecutar migraciones destructivas sin autorización).
7. (Opcional, después) comprar un dominio propio y apuntarlo desde Railway/Vercel.

## Cómo retomar esto

Cuando el usuario quiera continuar, los pasos 1-4 son los que desbloquean todo lo demás (sin backend público no tiene sentido desplegar el frontend). El agente puede ejecutar los comandos de cada paso, pero el login inicial en cada plataforma lo tiene que aprobar el usuario en su propio navegador.

## Subir las fotos de promociones y portadas a producción

Las imágenes se guardan en la base de datos (data URI), así que sobreviven a los redeploys de Render. Tras un cambio que las pierda (o para cargarlas por primera vez) usa el script, que empareja cada promoción por su título con una foto del plato que anuncia (`scripts/fotos-promociones.json`, fotos de Unsplash) y la sube sin tocar tipo, puntos, fechas ni estado:

```bash
# 1) Simulación (no sube nada): muestra qué foto iría a cada promoción
node scripts/subir-fotos-promociones.mjs --restaurante mexican --api https://fidelyfood-backend.onrender.com --dry-run
# 2) Subida real. La contraseña se pide por teclado (no se muestra ni se guarda) o se lee de FIDELYFOOD_PASSWORD
node scripts/subir-fotos-promociones.mjs --restaurante mexican    --api https://fidelyfood-backend.onrender.com
node scripts/subir-fotos-promociones.mjs --restaurante alabroster --api https://fidelyfood-backend.onrender.com
node scripts/subir-fotos-promociones.mjs --restaurante venezuela  --api https://fidelyfood-backend.onrender.com
```

- Es idempotente: las promociones que ya tienen su foto guardada se dejan como están (`--forzar` las sustituye).
- `--email` cambia el correo del restaurante si no es el de `fotos-promociones.json`; `--sin-portada` no toca la portada (solo Mexican Food tiene portada definida).
- La primera petición a Render puede tardar ~1 minuto si el servicio está dormido.

## Restablecer las contraseñas de los restaurantes de producción

Las contraseñas están cifradas en la base de datos (no se pueden recuperar), y solo el propio restaurante podía cambiar la suya. Si nadie la recuerda, un administrador puede restablecerla con `POST /api/admin/businesses/{id}/password` (mínimo 12 caracteres; queda registrado en el log de administración sin la contraseña). El script lo automatiza y deja el widget del escritorio al día:

```bash
# 1) Simulación: comprueba el login de administrador, qué restaurantes existen y si el backend ya tiene el endpoint
node scripts/resetear-contrasenas-restaurantes.mjs --api https://fidelyfood-backend.onrender.com --dry-run
# 2) Cambio real: genera una contraseña aleatoria por restaurante, la cambia, comprueba el login con ella y la escribe en el widget
node scripts/resetear-contrasenas-restaurantes.mjs --api https://fidelyfood-backend.onrender.com
```

- La contraseña de administrador se pide por teclado (o `FIDELYFOOD_ADMIN_PASSWORD`); las nuevas **nunca se imprimen**: solo van al widget y a `~/.fidelyfood-passwords-pendientes.json` (permisos 600), que se borra cuando todo ha ido bien.
- Se guarda una copia del widget anterior en `index.jsx.bak` (misma carpeta).
- La contraseña de administrador es la variable `FIDELYFOOD_ADMIN_PASSWORD` de Render; si cambia, actualízala allí y en el widget.

## Cambiar la contraseña de administrador de producción

La contraseña de administrador **no está en la base de datos**: la lee el backend de la variable `FIDELYFOOD_ADMIN_PASSWORD` de Render (si no existe, usa la de por defecto del código, que es pública). Para cambiarla sin que pase por pantalla ni por un chat:

```bash
node scripts/contrasena-admin.mjs preparar          # genera una nueva, la copia al portapapeles y la deja como PENDIENTE en el widget
# Render → fidelyfood-backend → Environment → FIDELYFOOD_ADMIN_PASSWORD → pegar → Save → Manual Deploy
node scripts/contrasena-admin.mjs confirmar --api https://fidelyfood-backend.onrender.com   # login real; si vale, pasa a ACTIVA en el widget
```
