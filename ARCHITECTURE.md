# Arquitectura — FidelyFood

Descripción real del sistema tal como está implementado (no un diseño aspiracional). Generado a partir de la auditoría real del código, no de suposiciones.

## Visión general

```
┌─────────────────────────┐        ┌──────────────────────────┐        ┌─────────────┐
│  Frontend (Angular +     │  HTTP  │  Backend (Spring Boot)    │  JDBC  │   MySQL     │
│  Ionic + Capacitor)      │───────▶│  API REST + JWT            │───────▶│ proyectoTFG │
│  puerto 8100 (dev)       │        │  puerto 8081                │        │  puerto 3306│
└─────────────────────────┘        └──────────────────────────┘        └─────────────┘
```

Tres roles con interfaces separadas dentro de la misma SPA: `ADMIN`, `RESTAURANT`, `USER` (cliente).

## Backend

- **Stack**: Java 17, Spring Boot 3.2.1, Spring Security, Spring Data JPA/Hibernate, MySQL.
- **Capas**: Controller → Service → DAO (Repository) → Entity, siguiendo el patrón estándar de Spring.
- **Autenticación**: JWT stateless (HS256, `JwtUtil`), sin sesiones de servidor. El secreto se lee de `APP_JWT_SECRET` (obligatorio en producción — el arranque falla si el perfil `prod` está activo y no está definido, ver `JwtUtil.validateSecret()`).
- **Autorización**: doble capa.
  1. **A nivel de ruta**, en `SecurityConfig.java`: qué rol puede llamar a qué método/ruta.
  2. **A nivel de recurso**, dentro de los servicios (`UsuarioService`, `RestauranteService`): el patrón `requireOwner(...)` verifica que el email autenticado coincide con el dueño real del recurso pedido (evita que un usuario/restaurante acceda a datos de otro solo cambiando un ID en la URL).
- **Rate limiting de login**: `LoginRateLimitFilter` + `LoginRateLimiter` (en memoria, por IP+email, ver `SECURITY.md`).
- **Ficheros subidos**: disco local (`uploads/`), servidos vía `UploadController` con protección anti path-traversal. ⚠️ En producción con sistema de ficheros efímero (la mayoría de PaaS) esto se pierde en cada redeploy — pendiente de resolver con un volumen persistente o almacenamiento tipo S3 antes de un despliegue serio.
- **Base de datos**: `spring.jpa.hibernate.ddl-auto=update` (sin herramienta de migraciones tipo Flyway/Liquibase) — adecuado para el tamaño actual del proyecto, a revisar si crece.

### Controladores principales

| Controlador | Prefijo | Rol(es) |
|---|---|---|
| `AuthController` | `/api/auth` | Público (login/registro) |
| `AdminController` | `/api/admin` | `ROLE_ADMIN` |
| `UsuarioController` | `/api/usuarios` | `ROLE_USER` (+ un endpoint `ROLE_RESTAURANT` para identificar por QR) |
| `RestauranteController` | `/api/restaurantes` | Lectura: cualquier rol autenticado; escritura/stats: el propio restaurante |
| `PromocionController` | `/api/promociones` | Lectura: cualquier rol; gestión: `ROLE_RESTAURANT` |
| `RecompensaController` | `/api/recompensas` | Lectura/canje: `ROLE_USER`; gestión: `ROLE_ADMIN` |
| `PuntosController` | `/api/puntos` | Consulta: el propio usuario; asignar puntos: `ROLE_RESTAURANT` |
| `CompraController` | `/api/compras` | `ROLE_RESTAURANT` |
| `MovimientoPuntosController` | `/api/movimientos` | `ROLE_USER` (propio) |

## Frontend

- **Stack**: Angular 20 (standalone components, sin NgModules), Ionic 8, Capacitor 8 (preparado para empaquetado nativo iOS/Android, aunque el uso actual es como PWA/web).
- **Routing por rol**, tres árboles de rutas lazy-loaded completamente separados y protegidos:
  - `/u/**` — cliente (`authGuard` + `roleGuard('ROLE_USER')`)
  - `/r/**` — restaurante (`roleGuard('ROLE_RESTAURANT')`)
  - `/admin/**` — administrador (`roleGuard('ROLE_ADMIN')`)
- **Estado de sesión**: JWT en `localStorage` (`token`, `role`, `nombre`, `userId`, `currentUser`), rehidratado al arrancar por `GlobalStateService.loadInitialState()`.
- **Interceptor HTTP** (`token.interceptor.ts`): añade el JWT solo a peticiones hacia la propia API; distingue un 401 de "sesión caducada" de un 401 de "este rol no tiene permiso para este endpoint concreto" (el segundo no cierra sesión).
- **Geolocalización**: `GeolocationService` (envoltorio de `@capacitor/geolocation`, con `watchPosition` real, no una posición fija) — usado en `home` y `mapa` para restaurantes cercanos.
- **Build de producción**: `ng build --configuration production` → `frontend/www` (listo para hosting estático).

## Monitor del agente (herramienta de desarrollo local, no parte del producto)

Pipeline construido durante esta sesión para ver en tiempo real la actividad del propio asistente de IA en un widget de escritorio (Übersicht):

```
Claude Code (hooks reales: PreToolUse/PostToolUse/Stop)
   → access-center/hooks/emit-event.mjs
   → access-center/server.js (localhost:5757 — /api/agent-events, /api/agent-metrics, /api/my-work)
   → widget de escritorio (Übersicht)
```

Solo metadatos (herramienta, archivo, tipo de evento) — nunca contenido de comandos ni secretos. Vive fuera del backend/frontend de producción, es una herramienta de desarrollo local (`access-center/`), nunca se despliega.

## Persistencia de tareas del agente

- `AGENT_TASKS.md` — backlog técnico con historial de cada tarea autónoma cerrada (qué se hizo, qué se verificó, resultado).
- `.agent/state.json` / `.agent/tasks.md` — estado leído por el widget "Project Agent", actualizado con resultados reales, no estimaciones.
- Trabajo autónomo en worktree separado (`../TFG-agent-worktree`, rama `agent/fidelyfood-autonomous`) — nunca toca el directorio de trabajo principal mientras el usuario desarrolla en paralelo.
