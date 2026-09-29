# Informe de seguridad — FidelyFood

Auditoría real del código (no una checklist genérica). Cada hallazgo indica si ya está corregido o sigue pendiente, con la referencia a dónde se corrigió.

## Ya corregidos en esta sesión

### 1. Broken Access Control — estadísticas de restaurante expuestas
- **Riesgo**: Alto (OWASP A01:2021).
- **Ubicación**: `GET /api/restaurantes/{id}/stats` y `/stats-avanzadas`.
- **Problema**: no comprobaban que el solicitante fuera el propio restaurante. Cualquier cuenta autenticada (cliente, restaurante ajeno) podía leer la facturación e historial completo de cualquier restaurante.
- **Impacto**: fuga de datos de negocio sensibles (ingresos, ticket medio, historial de movimientos) entre restaurantes competidores o hacia cualquier cliente.
- **Solución**: `requireOwner(...)` añadido a ambos endpoints (mismo patrón ya usado en el resto del código). Verificado empíricamente antes/después del arreglo. Ver `AGENT_TASKS.md` (FID-005).
- **Estado**: corregido en `agent/fidelyfood-autonomous`, pendiente de integrar a `main` y reiniciar el backend en desarrollo.

### 2. Sin rate-limiting en login + enumeración de emails
- **Riesgo**: Medio-Alto.
- **Ubicación**: `POST /api/auth/login`, `/login-restaurante`.
- **Problema**: (a) sin límite de intentos, permitía fuerza bruta de contraseñas; (b) "email no registrado" devolvía 404 y "contraseña incorrecta" devolvía 500 — la diferencia de código HTTP permitía enumerar qué emails están registrados.
- **Impacto**: cuentas comprometibles por fuerza bruta una vez la app sea pública; reconocimiento de cuentas válidas para un atacante.
- **Solución**: `LoginRateLimitFilter` (8 fallos/10 min por IP+email → 429) + ambos casos devuelven 401 idéntico. Ver `AGENT_TASKS.md` (FID-001).
- **Estado**: corregido en `agent/fidelyfood-autonomous`, pendiente de integrar y reiniciar.

### 3. Swagger/OpenAPI público
- **Riesgo**: Bajo-Medio (divulgación de información).
- **Ubicación**: `/v3/api-docs/**`, `/swagger-ui/**`.
- **Problema**: cualquiera podía ver toda la superficie de la API sin autenticarse.
- **Solución**: restringido a `ROLE_ADMIN`.
- **Estado**: ✅ corregido y fusionado en `main`.

### 4. JWT secret de desarrollo podía llegar a producción
- **Riesgo**: Alto si ocurriera (permitiría forjar tokens de admin).
- **Ubicación**: `JwtUtil`, `application.properties`.
- **Problema**: el valor por defecto (`fidelyfood-dev-jwt-secret-change-me-2026`) está en el código fuente público del repositorio; si se olvida configurar `APP_JWT_SECRET` en producción, el backend arrancaría con ese secreto conocido.
- **Solución**: el arranque falla explícitamente si el perfil `prod` está activo y `APP_JWT_SECRET` no está definido o sigue siendo el valor por defecto.
- **Estado**: ✅ corregido y fusionado en `main`.

### 5. CORS y URLs de producción
- **Riesgo**: Bajo (bloqueaba el propio despliegue, no una vulnerabilidad activa).
- **Problema**: orígenes CORS y URL de base de datos fijos a `localhost`, sin forma de configurarlos en producción sin tocar código.
- **Solución**: externalizados vía `APP_CORS_ORIGINS` y `DB_URL`.
- **Estado**: ✅ corregido y fusionado en `main`.

### 11. Fuga del hash de contraseña de restaurantes vía el listado de promociones
- **Riesgo**: Alto (OWASP API3:2023 — Broken Object Property Level Authorization / excessive data exposure).
- **Ubicación**: `GET /api/promociones` y `GET /api/promociones/restaurante/{id}`.
- **Problema**: `PromocionController` devuelve la entidad `Promocion` directamente (sin DTO), y esta arrastra la entidad `Restaurante` completa —incluido el hash bcrypt de `password`— en el campo anidado `restaurante`. El `GET` de `/api/promociones/**` está abierto a cualquier rol autenticado (`ROLE_USER`, `ROLE_RESTAURANT`, `ROLE_ADMIN`), por diseño: es el listado público de ofertas que ve cualquier cliente.
- **Impacto**: cualquier cliente recién autoregistrado (gratis, sin fricción) podía leer el hash bcrypt real de cualquier restaurante con al menos una promoción y atacarlo offline. Verificado empíricamente antes de corregir: un cliente de prueba desechable obtuvo el hash real de una cuenta de restaurante sembrada vía `GET /api/promociones`.
- **Solución**: `@JsonProperty(access = JsonProperty.Access.WRITE_ONLY)` en `Restaurante.password` (y en `Usuario.password`, mismo patrón, defensa en profundidad) — Jackson deja de serializarlo en cualquier respuesta JSON, pero lo sigue aceptando al deserializar peticiones entrantes, necesario porque `PUT /api/restaurantes/{id}` reutiliza ese mismo campo para permitir cambiar la contraseña. Se descartó `@JsonIgnore` porque también bloquea la deserialización y habría roto esa función en silencio.
- **Estado**: corregido en `agent/fidelyfood-autonomous`, con test de regresión E2E (`security-promotion-password-leak.spec.ts`), pendiente de PR/revisión humana y de reiniciar el backend de desarrollo. Ver `AGENT_TASKS.md` (FID-017).

## Pendientes (no corregidos todavía)

### 6. Sin revocación de JWT
- **Riesgo**: Bajo-Medio.
- **Problema**: un JWT robado sigue siendo válido hasta su expiración (10h) — no hay lista de revocación ni logout server-side.
- **Impacto**: ventana de uso indebido de hasta 10h tras un robo de token.
- **Solución propuesta**: no urgente para el tamaño actual del proyecto; si se necesita, requeriría una blacklist de tokens (Redis o tabla en BD) — cambio de arquitectura, no se ha aplicado sin confirmación explícita.

### 7. Rate-limiting solo por cuenta, no por IP en solitario
- **Riesgo**: Bajo (limitación documentada del propio arreglo del punto 2).
- **Problema**: un atacante que reparte intentos entre muchas cuentas distintas desde la misma IP no se ve frenado.
- **Solución propuesta**: añadir un segundo límite, más laxo, solo por IP, si se detecta este patrón de abuso en producción.

### 8. Persistencia de `uploads/` en producción
- **Riesgo**: Medio (pérdida de datos, no confidencialidad).
- **Problema**: los ficheros subidos (fotos de perfil/restaurante) viven en disco local; la mayoría de plataformas de hosting tienen sistema de ficheros efímero.
- **Solución propuesta**: volumen persistente (Railway) o almacenamiento tipo S3-compatible antes de un despliegue serio con usuarios subiendo imágenes.

### 9. Clave de Google Maps sin restricción de dominio verificada
- **Riesgo**: Bajo (abuso de cuota, no de datos).
- **Ubicación**: `frontend/src/environments/environment.prod.ts`.
- **Problema**: la clave viaja en el bundle público del frontend (normal para Maps JS API), pero conviene confirmar que está restringida por HTTP referrer al dominio real de producción en Google Cloud Console.
- **Solución propuesta**: acción manual del usuario en Google Cloud Console — no es un cambio de código.

### 10. Vulnerabilidades XSS conocidas en la versión de Angular instalada — ✅ CORREGIDO
- **Riesgo**: Alto (`npm audit`, severidad "high", 3 CVEs/advisories de GitHub).
- **Ubicación**: `@angular/core`/`@angular/compiler`/`@angular/animations` 20.3.23 (rango afectado: `20.0.0-next.0 - 20.3.27`).
- **Problema**: sanitización insuficiente permite XSS vía property binding bidireccional, atributos de manejadores de eventos en i18n, y host bindings de directivas — las tres son parte del propio framework, no del código de la app.
- **Impacto**: si se explota, un atacante podría inyectar/ejecutar JavaScript arbitrario en el navegador de un usuario de FidelyFood.
- **Corregido**: `npm audit fix` resolvió primero 14 de 22 vulnerabilidades (dependencias de build). Las 3 restantes de Angular se corrigieron con `ng update @angular/core@20 @angular/cli@20` — sube `@angular/core` y todos los paquetes hermanos a la misma versión exacta (20.3.32), quedándose dentro de Angular 20 (sin saltar a la v21, que `ng update` sin argumentos ofrecía por defecto y habría sido un cambio de mayor riesgo). Verificado: `npm audit --omit=dev` → 0 vulnerabilidades; build de producción limpio; suite E2E completa (14/14) pasando contra el frontend reconstruido. Ver `AGENT_TASKS.md` (FID-012).

## Verificado y correcto (sin acción necesaria)

- Path traversal en `/uploads/**`: protegido correctamente (normalización + comprobación de prefijo).
- CORS: lista blanca explícita, sin comodines, `allowCredentials(false)`.
- Ownership checks en `UsuarioController`, el resto de `RestauranteController` y `PuntosController`: correctos, usan `requireOwner`/verificación de email autenticado de forma consistente.
- Ownership en `PromocionController` (`requirePromotionOwner`): verificado con JWTs reales de dos restaurantes distintos (Alabroster vs Venezuela Food) — `PUT`/`DELETE` sobre una promoción ajena devuelven 403 real, no solo por código leído.
- Aislamiento de roles: `/api/admin/**` con token de restaurante → 403 real; Swagger/OpenAPI con y sin token de restaurante → 403/401; `/api/auth/login-admin` con credenciales de restaurante → 401 real; `/actuator/**` no accesible sin autenticar (401).
- Contraseñas: hasheadas con BCrypt, nunca en texto plano en BD.
- Secretos: `.env` correctamente en `.gitignore`, nunca commiteado.
