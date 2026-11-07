# Despliegue — FidelyFood

Estado real a fecha de hoy. **El proyecto ya está desplegado en Internet** desde el 2026-09-24 — esta
sección documenta la arquitectura real en marcha, no un plan. (Nota histórica: este documento describió
durante un tiempo un plan de despliegue en Railway que nunca llegó a ejecutarse; se sustituyó por Render
+ Vercel + Aiven, que es lo que corre hoy. El plan de Railway queda solo en el historial de git.)

## Arquitectura de producción real

- **Backend**: [Render](https://dashboard.render.com) (plan free, Docker — usa el `Dockerfile` y
  `render.yaml` del repo). URL pública: `https://fidelyfood-backend.onrender.com`. Healthcheck en `/ping`.
- **Base de datos**: MySQL en [Aiven](https://console.aiven.io) (plan gratuito `Free-1-1gb`).
- **Frontend**: [Vercel](https://vercel.com) (plan Hobby, build estático de `frontend/www` vía
  `frontend/vercel.json`). Proyecto actual: `fidelyfoodapp` → `https://fidelyfoodapp.vercel.app`
  (login de admin en `/admin/login`). El proyecto original (`tfg-glf5` → `https://tfg-glf5.vercel.app`)
  quedó en un estado corrupto en Vercel el 2026-09-24 y se abandonó sin borrar — sigue respondiendo, pero
  no es el que se mantiene activo; no usarlo como referencia para enlaces nuevos.
- **Dominio**: sin dominio propio — el usuario decidió quedarse con los subdominios gratuitos de
  Render/Vercel (ver `.agent/decisions.md` y `.agent/tasks.md`).

## Ya preparado en el código

- [x] `Dockerfile` (build multi-stage Maven → JRE), `.dockerignore` y `render.yaml` para el backend.
- [x] URL de base de datos externalizada (`DB_URL`, en vez de `localhost:3306` fijo).
- [x] Orígenes CORS configurables por variable de entorno (`APP_CORS_ORIGINS`), sin perder los de desarrollo.
- [x] El backend falla al arrancar si el perfil `prod` está activo sin `APP_JWT_SECRET` configurado (evita quedarse con el secreto de desarrollo en producción).
- [x] Swagger/OpenAPI restringido a `ROLE_ADMIN` (antes público).
- [x] `.env.example` documentando todas las variables necesarias.
- [x] Clave de Google Maps configurada en `environment.prod.ts` (pendiente de restringirla por dominio en Google Cloud Console — el usuario decidió no hacerlo por ahora, ver `.agent/tasks.md`).

## Riesgo conocido: Aiven apaga la base de datos gratuita por inactividad

El plan gratuito de MySQL en Aiven (`Free-1-1gb`) **se apaga solo tras un periodo de inactividad**, y al
apagarse retira también el registro DNS del host. Esto causó una caída real de producción de ~45 horas
(27–29 de septiembre de 2026; detalle completo en `.agent/discoveries.md`). El backend (Render) no tiene
ningún fallo en ese incidente — el síntoma desde sus logs (`Communications link failure` /
`UnknownHostException` al conectar con la BD) es idéntico sea cual sea la causa, pero el origen real
está siempre en Aiven.

**Cómo comprobarlo y recuperarlo** (sin tocar ninguna credencial):

1. Entrar en [console.aiven.io](https://console.aiven.io) y abrir el servicio MySQL del proyecto.
2. Si el estado en la vista "Overview" es **"Powered off"**, ese es el problema (no un incidente de
   Render) — confirmable también desde cualquier máquina con `nslookup <host-de-aiven>`: un `NXDOMAIN`
   mientras está apagado es consistente con este estado, no con un fallo de red distinto.
3. Pulsar el botón de encender el servicio en esa misma vista "Overview". Aiven restaura el DNS y la
   conexión sin pérdida de datos (los backups automáticos siguen intactos durante todo el apagado).
4. Verificar la recuperación con una petición real contra producción, por ejemplo un login con contraseña
   incorrecta: `POST https://fidelyfood-backend.onrender.com/api/auth/login` debe responder
   "Credenciales incorrectas" (error de aplicación, no un error de conexión/timeout) una vez el servicio
   de Aiven vuelve a estar activo. La primera petición tras despertar tanto Aiven como el propio Render
   (que también duerme por inactividad en el plan free) puede tardar hasta un minuto.

**Decisión pendiente del usuario** (no tomada por el agente, ver `.agent/tasks.md` AGT-007): si merece la
pena pasar a un plan de pago mínimo en Aiven (evita este apagado) antes de una demo o entrega del TFG, o
seguir aceptando el riesgo con el procedimiento de recuperación de arriba. Mientras no se decida, cada
periodo largo sin tráfico real puede repetir la caída — comprobar `console.aiven.io` ante cualquier
`502`/timeout sostenido de `https://fidelyfood-backend.onrender.com/ping` antes de asumir un problema de
Render o de código.

## Inestabilidad conocida del alias de dominio de Vercel tras un merge

Fusionar algo que toque `frontend/` a `main` no siempre promueve el nuevo despliegue a "Production" en
`fidelyfoodapp.vercel.app` automáticamente, incluso cuando la API de GitHub confirma que Vercel completó
el build (visto el 2026-09-29, ver `.agent/discoveries.md`). Si la build nueva no se ve tras un merge,
comprobar la pestaña "Deployments" del proyecto en Vercel y promoverlo a "Production" manualmente antes
de asumir que el merge no funcionó.

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
