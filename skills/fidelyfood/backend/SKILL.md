# Skill: backend

## Propósito
Crear y modificar el backend Spring Boot (Java 17) respetando la arquitectura existente: controller → service → dao (Spring Data JPA) → entity, con DTOs y Spring Security/JWT.

## Cuándo usarla
Cualquier tarea que toque `src/main/java/progresa/springboot_tfg/**`: endpoints nuevos, reglas de negocio, entidades, validaciones, correcciones de errores del servidor.

## Herramientas permitidas
`inspect_api`, `inspect_endpoint`, `search_code`, `read_file`, `write_file`, `run_maven`, `run_unit_tests`, `service_start`/`inspect_logs` (reproducir), `call_api`, `query_database` (solo lectura), `git_*`.

## Procedimiento
1. `inspect_endpoint` / `search_code` para ver el controller y el servicio reales antes de escribir nada. Copia el estilo del código vecino.
2. Capas: el **controller** solo traduce HTTP (usa `SecurityUtils.email(authentication)` para saber quién llama, nunca un id que mande el cliente); la **lógica** va en `service/`; el acceso a datos en `dao/`.
3. **Autorización de recurso**: todo servicio que expone datos de un usuario/restaurante debe llamar a `requireOwner(entidad, emailAutenticado)`. Un endpoint nuevo sin este patrón es un bug.
4. Reglas de rol en `security/SecurityConfig.java` (primera regla que casa gana; `/x/**` también casa `/x`). Cambios amplios ahí requieren aprobación humana.
5. Devuelve DTOs, no entidades (ya hubo una fuga de contraseñas por devolver la entidad `Promocion` → `Restaurante`).
6. Errores: lanza `BadRequestException`, `ResourceNotFoundException`, `AccessDeniedException`; el `GlobalExceptionHandler` los traduce a HTTP.
7. Si cambias una entidad: Hibernate usa `ddl-auto=update` (no hay migraciones). Solo se añaden/ensanchan columnas; nada destructivo sin backup y aprobación.
8. Escribe tests unitarios Mockito puros en `src/test/java/.../service/` (patrón: `RestauranteServiceTest`).

## Validaciones
- `run_unit_tests` (scope backend) en verde — usa JDK 17 automáticamente (con JDK 25 Mockito falla).
- Reproducir con `service_start` + `call_api` (auth client/restaurant/admin) y comprobar código HTTP y cuerpo.
- Revisar `inspect_logs` sin excepciones nuevas.
- Si tocaste permisos: probar con un token de **otro** rol/dueño y confirmar 403.

## Riesgos
- Subir archivos a disco: el disco de Render es efímero → las imágenes se guardan como data URI en BD (`ImagenUtil`).
- `PromocionService`/`RestauranteService` son los servicios con más reglas; cambios ahí → ejecutar también sus tests.
- Nunca imprimas ni commitees contraseñas/JWT; los valores vienen de variables de entorno.

## Resultado esperado
Cambio mínimo y coherente con la arquitectura, tests unitarios nuevos o actualizados en verde, reproducción antes/después documentada, `API.md` actualizado si cambió un contrato.
