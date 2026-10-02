# Skill: security

## Propósito
Aplicar y verificar controles de seguridad al implementar una tarea concreta (no es una auditoría general: esas ya están en `SECURITY.md`).

## Cuándo usarla
Cuando el cambio toca autenticación, roles, ownership de recursos, subida de archivos, CORS, secretos o datos personales.

## Herramientas permitidas
`inspect_endpoint`, `inspect_api`, `search_code`, `call_api` (con cuentas de prueba), `run_unit_tests`, `run_playwright`, `read_file` (nunca `.env`).

## Procedimiento
1. `inspect_endpoint` del endpoint afectado: ¿qué rol exige `SecurityConfig` y qué hace el servicio?
2. **Ownership**: el recurso debe validarse contra el email del JWT (`requireOwner`), nunca contra un id del body/URL sin comprobar.
3. **Reproduce antes, verifica después**: con `call_api` usa un token de **otro** usuario/restaurante y confirma 403 tras el arreglo (y 200 con el dueño).
4. Respuestas: devuelve DTOs; comprueba que no salen `password`, `qr_code` ajenos ni entidades anidadas con contraseñas.
5. Login: no debe distinguir "email inexistente" de "contraseña incorrecta"; `LoginRateLimiter` limita 8 fallos/10 min por IP+email.
6. Secretos: solo por variables de entorno (`.env.example` documenta cuáles). Nunca en código, logs, tests, memoria ni commits.
7. Añade un test (unitario del servicio o E2E `security-*.spec.ts`) que falle sin el arreglo.

## Validaciones
- El test de seguridad falla sin el cambio y pasa con él.
- `run_e2e_tests` suite `security` en verde.
- Ninguna salida de herramienta contiene secretos (el Agent Layer los redacta, pero no dependas de ello).

## Riesgos
- Cambios amplios en `SecurityConfig`, CORS, JWT o credenciales de producción → **parar y pedir aprobación**.
- No uses cuentas reales de producción para pruebas.

## Resultado esperado
Control verificado con petición real antes/después, test de regresión incluido, `SECURITY.md` actualizado si cambia un riesgo documentado.
