# API — FidelyFood

> Generado desde el código el 2026-10-04 con `npm --prefix agent run docs` (controllers + reglas de `SecurityConfig.java`). No lo edites a mano: cambia el código y regenera.

## Convenciones
- Base URL: local `http://localhost:8081`; producción en Render (ver `DEPLOYMENT.md`).
- Autenticación: JWT en la cabecera `Authorization: Bearer <token>`, obtenido en `/api/auth/login` (cliente), `/api/auth/login-restaurante` (restaurante) o `/api/auth/login-admin` (admin).
- Roles (autoridades de Spring Security): `ROLE_USER` (cliente), `ROLE_RESTAURANT`, `ROLE_ADMIN`. "authenticated (anyRequest)" = cualquier usuario autenticado cuando ninguna regla específica casa.
- Subidas multipart (máx. 5 MB; JPG/PNG/WEBP): promociones usan el campo `imagen`; la foto de restaurante usa `file`; la foto de perfil de usuario usa su propio endpoint.
- Errores: `BadRequestException` → 400, `ResourceNotFoundException` → 404, acceso denegado → 403, login incorrecto → 401, demasiados intentos de login → 429.
- Un recurso de usuario/restaurante solo es accesible por su dueño (`requireOwner` en los servicios), además de por el rol.

## Endpoints (72)

### AdminController

| Método | Ruta | Acceso | Tipo | Código |
|---|---|---|---|---|
| GET | `/api/admin/dashboard` | ROLE_ADMIN |  | AdminController.java:55 |
| GET | `/api/admin/businesses` | ROLE_ADMIN |  | AdminController.java:85 |
| GET | `/api/admin/businesses/{id}` | ROLE_ADMIN |  | AdminController.java:108 |
| PUT | `/api/admin/businesses/{id}` | ROLE_ADMIN |  | AdminController.java:126 |
| POST | `/api/admin/businesses/{id}/password` | ROLE_ADMIN |  | AdminController.java:148 |
| PATCH | `/api/admin/businesses/{id}/active` | ROLE_ADMIN |  | AdminController.java:156 |
| PATCH | `/api/admin/businesses/{id}/status` | ROLE_ADMIN |  | AdminController.java:161 |
| DELETE | `/api/admin/businesses/{id}` | ROLE_ADMIN |  | AdminController.java:173 |
| GET | `/api/admin/clients` | ROLE_ADMIN |  | AdminController.java:186 |
| GET | `/api/admin/clients/{id}` | ROLE_ADMIN |  | AdminController.java:225 |
| PUT | `/api/admin/clients/{id}` | ROLE_ADMIN |  | AdminController.java:231 |
| PATCH | `/api/admin/clients/{id}/active` | ROLE_ADMIN |  | AdminController.java:260 |
| PATCH | `/api/admin/clients/{id}/status` | ROLE_ADMIN |  | AdminController.java:265 |
| POST | `/api/admin/clients/{id}/points/add` | ROLE_ADMIN |  | AdminController.java:278 |
| POST | `/api/admin/clients/{id}/points/subtract` | ROLE_ADMIN |  | AdminController.java:283 |
| POST | `/api/admin/clients/{id}/points/set` | ROLE_ADMIN |  | AdminController.java:288 |
| GET | `/api/admin/clients/{id}/points/history` | ROLE_ADMIN |  | AdminController.java:293 |
| GET | `/api/admin/clients/{id}/activity` | ROLE_ADMIN |  | AdminController.java:308 |
| DELETE | `/api/admin/clients/{id}` | ROLE_ADMIN |  | AdminController.java:320 |
| DELETE | `/api/admin/clients/{id}/hard` | ROLE_ADMIN |  | AdminController.java:334 |
| GET | `/api/admin/reservations` | ROLE_ADMIN |  | AdminController.java:342 |
| POST | `/api/admin/reservations` | ROLE_ADMIN |  | AdminController.java:360 |
| PUT | `/api/admin/reservations/{id}` | ROLE_ADMIN |  | AdminController.java:369 |
| PATCH | `/api/admin/reservations/{id}/status` | ROLE_ADMIN |  | AdminController.java:379 |
| DELETE | `/api/admin/reservations/{id}` | ROLE_ADMIN |  | AdminController.java:393 |
| GET | `/api/admin/stats` | ROLE_ADMIN |  | AdminController.java:405 |
| GET | `/api/admin/logs` | ROLE_ADMIN |  | AdminController.java:431 |

### AuthController

| Método | Ruta | Acceso | Tipo | Código |
|---|---|---|---|---|
| POST | `/api/auth/login` | permitAll |  | AuthController.java:50 |
| POST | `/api/auth/login-restaurante` | permitAll |  | AuthController.java:66 |
| POST | `/api/auth/login-admin` | permitAll |  | AuthController.java:73 |
| POST | `/api/auth/register` | permitAll |  | AuthController.java:104 |
| POST | `/api/auth/register-restaurante` | permitAll |  | AuthController.java:131 |

### CanjeController

| Método | Ruta | Acceso | Tipo | Código |
|---|---|---|---|---|
| POST | `/api/canjes` | ROLE_USER |  | CanjeController.java:39 |

### CompraController

| Método | Ruta | Acceso | Tipo | Código |
|---|---|---|---|---|
| POST | `/api/compras` | ROLE_RESTAURANT |  | CompraController.java:37 |

### MovimientoPuntosController

| Método | Ruta | Acceso | Tipo | Código |
|---|---|---|---|---|
| GET | `/api/movimientos` | ROLE_USER |  | MovimientoPuntosController.java:38 |

### PromocionController

| Método | Ruta | Acceso | Tipo | Código |
|---|---|---|---|---|
| GET | `/api/promociones` | ROLE_USER | ROLE_RESTAURANT | ROLE_ADMIN |  | PromocionController.java:40 |
| GET | `/api/promociones/restaurante/{restauranteId}` | ROLE_USER | ROLE_RESTAURANT | ROLE_ADMIN |  | PromocionController.java:45 |
| POST | `/api/promociones` | ROLE_RESTAURANT | json | PromocionController.java:64 |
| POST | `/api/promociones` | ROLE_RESTAURANT | multipart | PromocionController.java:78 |
| PUT | `/api/promociones/{id}` | ROLE_RESTAURANT |  | PromocionController.java:89 |
| POST | `/api/promociones/{id}` | ROLE_RESTAURANT | multipart | PromocionController.java:103 |
| DELETE | `/api/promociones/{id}` | ROLE_RESTAURANT |  | PromocionController.java:114 |
| POST | `/api/promociones/{id}/aplicar` | ROLE_RESTAURANT |  | PromocionController.java:132 |

### PuntosController

| Método | Ruta | Acceso | Tipo | Código |
|---|---|---|---|---|
| GET | `/api/puntos/{usuarioId}/total` | ROLE_USER |  | PuntosController.java:36 |
| GET | `/api/puntos/{usuarioId}/{restauranteId}` | ROLE_USER |  | PuntosController.java:44 |
| POST | `/api/puntos` | ROLE_RESTAURANT |  | PuntosController.java:57 |

### RecompensaController

| Método | Ruta | Acceso | Tipo | Código |
|---|---|---|---|---|
| GET | `/api/recompensas` | ROLE_USER |  | RecompensaController.java:37 |
| GET | `/api/recompensas/{id}` | ROLE_USER |  | RecompensaController.java:50 |
| POST | `/api/recompensas` | ROLE_ADMIN |  | RecompensaController.java:63 |
| PUT | `/api/recompensas/{id}` | ROLE_ADMIN |  | RecompensaController.java:82 |
| DELETE | `/api/recompensas/{id}` | ROLE_ADMIN |  | RecompensaController.java:101 |
| POST | `/api/recompensas/{id}/canjear` | ROLE_USER |  | RecompensaController.java:120 |

### RestauranteController

| Método | Ruta | Acceso | Tipo | Código |
|---|---|---|---|---|
| GET | `/api/restaurantes` | ROLE_USER | ROLE_RESTAURANT | ROLE_ADMIN |  | RestauranteController.java:43 |
| GET | `/api/restaurantes/{id}` | ROLE_USER | ROLE_RESTAURANT | ROLE_ADMIN |  | RestauranteController.java:56 |
| GET | `/api/restaurantes/cercanos` | ROLE_USER | ROLE_RESTAURANT | ROLE_ADMIN |  | RestauranteController.java:65 |
| GET | `/api/restaurantes/{id}/stats` | ROLE_USER | ROLE_RESTAURANT | ROLE_ADMIN |  | RestauranteController.java:77 |
| GET | `/api/restaurantes/{id}/stats-avanzadas` | ROLE_USER | ROLE_RESTAURANT | ROLE_ADMIN |  | RestauranteController.java:88 |
| GET | `/api/restaurantes/{id}/estadisticas` | ROLE_USER | ROLE_RESTAURANT | ROLE_ADMIN |  | RestauranteController.java:99 |
| POST | `/api/restaurantes` | ROLE_RESTAURANT |  | RestauranteController.java:115 |
| PUT | `/api/restaurantes/{id}` | ROLE_RESTAURANT |  | RestauranteController.java:129 |
| POST | `/api/restaurantes/{id}/imagen` | ROLE_RESTAURANT | multipart | RestauranteController.java:141 |
| DELETE | `/api/restaurantes/{id}` | ROLE_RESTAURANT |  | RestauranteController.java:157 |

### TestController

| Método | Ruta | Acceso | Tipo | Código |
|---|---|---|---|---|
| GET | `/ping` | permitAll |  | TestController.java:9 |

### UploadController

| Método | Ruta | Acceso | Tipo | Código |
|---|---|---|---|---|
| GET | `/uploads/**` | permitAll |  | UploadController.java:53 |

### UsuarioController

| Método | Ruta | Acceso | Tipo | Código |
|---|---|---|---|---|
| GET | `/api/usuarios` | ROLE_ADMIN |  | UsuarioController.java:41 |
| GET | `/api/usuarios/{id}` | ROLE_USER |  | UsuarioController.java:54 |
| POST | `/api/usuarios` | ROLE_USER |  | UsuarioController.java:66 |
| PUT | `/api/usuarios/{id}` | ROLE_USER |  | UsuarioController.java:83 |
| DELETE | `/api/usuarios/{id}` | ROLE_USER |  | UsuarioController.java:99 |
| POST | `/api/usuarios/{id}/change-password` | ROLE_USER |  | UsuarioController.java:111 |
| POST | `/api/usuarios/{id}/upload-photo` | ROLE_USER | multipart | UsuarioController.java:129 |
| POST | `/api/usuarios/identificar-qr` | ROLE_RESTAURANT |  | UsuarioController.java:138 |

