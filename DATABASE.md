# DATABASE — FidelyFood

> Generado desde la base de datos del entorno `local` el 2026-10-02 con `npm --prefix agent run docs`. No lo edites a mano.

## Cómo se gestiona el esquema
- Motor: MySQL. Local: `proyectoTFG`. Producción: Aiven (plan gratuito: la BD **se apaga sola por inactividad**; ver `DEPLOYMENT.md`).
- No hay herramienta de migraciones: Hibernate (`spring.jpa.hibernate.ddl-auto=update`) crea tablas y columnas nuevas al arrancar. El esquema se cambia modificando las entidades en `src/main/java/progresa/springboot_tfg/entity/`; nunca se hacen `DROP`/`TRUNCATE`/`ALTER` destructivos sin backup y aprobación.
- Acceso del agente: `query_database` (solo lectura, columnas password/token enmascaradas) y `inspect_schema`.

## Tablas (8)

### `admin_logs`

| Columna | Tipo | Nulo | Clave | Por defecto |
|---|---|---|---|---|
| id | bigint | NO | PRI |  |
| action | varchar(255) | NO |  |  |
| admin_email | varchar(255) | YES |  |  |
| created_at | datetime(6) | YES |  |  |
| description | varchar(1000) | YES |  |  |
| entity_id | bigint | YES |  |  |
| entity_type | varchar(255) | NO |  |  |
| new_data | varchar(3000) | YES |  |  |
| old_data | varchar(3000) | YES |  |  |

**Índices:** `PRIMARY` (id)

### `admin_reservations`

| Columna | Tipo | Nulo | Clave | Por defecto |
|---|---|---|---|---|
| id | bigint | NO | PRI |  |
| business_name | varchar(255) | YES |  |  |
| client_email | varchar(255) | YES |  |  |
| client_name | varchar(255) | YES |  |  |
| client_phone | varchar(255) | YES |  |  |
| created_at | datetime(6) | YES |  |  |
| date | datetime(6) | YES |  |  |
| deleted | bit(1) | YES |  |  |
| deleted_at | datetime(6) | YES |  |  |
| deleted_by_admin_email | varchar(255) | YES |  |  |
| notes | varchar(1000) | YES |  |  |
| people | int | YES |  |  |
| status | varchar(255) | YES |  |  |
| updated_at | datetime(6) | YES |  |  |
| restaurante_id | bigint | YES | MUL |  |
| usuario_id | bigint | YES | MUL |  |

**Claves foráneas:** `restaurante_id` → `restaurantes.id`, `usuario_id` → `usuarios.id`

**Índices:** `FK8mgxd5wg7hsmj4x66486adqa` (restaurante_id); `FKf7eg2ecd4h6c18q1rhis2q1d4` (usuario_id); `PRIMARY` (id)

### `movimientos_puntos`

| Columna | Tipo | Nulo | Clave | Por defecto |
|---|---|---|---|---|
| id | bigint | NO | PRI |  |
| descripcion | varchar(255) | YES |  |  |
| fecha | datetime(6) | YES |  |  |
| puntos | int | NO |  |  |
| tipo | varchar(255) | NO |  |  |
| usuario_id | bigint | NO | MUL |  |
| admin_email | varchar(255) | YES |  |  |
| monto | double | YES |  |  |
| motivo_interno | varchar(255) | YES |  |  |
| restaurante_id | bigint | YES | MUL |  |

**Claves foráneas:** `usuario_id` → `usuarios.id`, `restaurante_id` → `restaurantes.id`

**Índices:** `FKds7chwrq9awcjvftc4qynhfrv` (usuario_id); `FKt5l05hgk02k588m5m0b9mb1xn` (restaurante_id); `PRIMARY` (id)

### `promociones`

| Columna | Tipo | Nulo | Clave | Por defecto |
|---|---|---|---|---|
| id | bigint | NO | PRI |  |
| descripcion | varchar(255) | YES |  |  |
| puntos_otorgados | int | NO |  |  |
| titulo | varchar(255) | NO |  |  |
| restaurante_id | bigint | NO | MUL |  |
| activa | bit(1) | NO |  |  |
| fecha_fin | date | YES |  |  |
| fecha_inicio | date | YES |  |  |
| imagen_url | varchar(255) | YES |  |  |
| tipo | varchar(255) | NO |  |  |

**Claves foráneas:** `restaurante_id` → `restaurantes.id`

**Índices:** `FKq9jm2d4kdpcgu5nx0m2qyvqde` (restaurante_id); `PRIMARY` (id)

### `recompensas`

| Columna | Tipo | Nulo | Clave | Por defecto |
|---|---|---|---|---|
| id | bigint | NO | PRI |  |
| descripcion | varchar(255) | YES |  |  |
| nombre | varchar(255) | NO |  |  |
| puntos_necesarios | int | NO |  |  |

**Índices:** `PRIMARY` (id)

### `restaurantes`

| Columna | Tipo | Nulo | Clave | Por defecto |
|---|---|---|---|---|
| id | bigint | NO | PRI |  |
| ciudad | varchar(255) | YES |  |  |
| direccion | varchar(255) | YES |  |  |
| email | varchar(255) | NO | UNI |  |
| nombre | varchar(255) | NO |  |  |
| password | varchar(255) | NO |  |  |
| role | enum('ROLE_USER','ROLE_RESTAURANT') | NO |  |  |
| telefono | varchar(255) | YES |  |  |
| active | bit(1) | YES |  |  |
| created_at | datetime(6) | YES |  |  |
| deleted | bit(1) | YES |  |  |
| deleted_at | datetime(6) | YES |  |  |
| deleted_by_admin_email | varchar(255) | YES |  |  |
| descripcion | varchar(1200) | YES |  |  |
| foto | varchar(255) | YES |  |  |
| latitud | double | YES |  |  |
| longitud | double | YES |  |  |
| tipo | varchar(255) | YES |  |  |
| updated_at | datetime(6) | YES |  |  |
| codigo_postal | varchar(255) | YES |  |  |

**Índices:** `PRIMARY` (id); `UK_ckwbpxnlhwvoecy2bxjhwwr2e` (email)

### `usuario_restaurante_puntos`

| Columna | Tipo | Nulo | Clave | Por defecto |
|---|---|---|---|---|
| id | bigint | NO | PRI |  |
| puntos | int | NO |  |  |
| restaurante_id | bigint | NO | MUL |  |
| usuario_id | bigint | NO | MUL |  |

**Claves foráneas:** `usuario_id` → `usuarios.id`, `restaurante_id` → `restaurantes.id`

**Índices:** `FK64g8daf4inscy02sjno1qvll6` (usuario_id); `FKpfgtwvhlk20reo8e9vhgs03oy` (restaurante_id); `PRIMARY` (id)

### `usuarios`

| Columna | Tipo | Nulo | Clave | Por defecto |
|---|---|---|---|---|
| id | bigint | NO | PRI |  |
| email | varchar(255) | NO | UNI |  |
| nombre | varchar(255) | NO |  |  |
| password | varchar(255) | NO |  |  |
| puntos | int | NO |  |  |
| qr_code | varchar(255) | YES | UNI |  |
| role | enum('ROLE_USER','ROLE_RESTAURANT') | NO |  |  |
| active | bit(1) | YES |  |  |
| created_at | datetime(6) | YES |  |  |
| deleted | bit(1) | YES |  |  |
| deleted_at | datetime(6) | YES |  |  |
| deleted_by_admin_email | varchar(255) | YES |  |  |
| foto_perfil | varchar(255) | YES |  |  |
| telefono | varchar(255) | YES |  |  |
| updated_at | datetime(6) | YES |  |  |

**Índices:** `PRIMARY` (id); `UK_9elhumi5b69k08ndk0gj2anrf` (qr_code); `UK_kfsp0s1tflm1cwlj8idhqsad0` (email)

