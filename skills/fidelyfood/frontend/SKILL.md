# Skill: frontend

## Propósito
Trabajar en la app Angular + Ionic (TypeScript) de `frontend/`: componentes standalone, servicios, guards, interceptors, rutas, formularios, llamadas a la API y UI.

## Cuándo usarla
Cambios en `frontend/src/app/**` (cliente en `features/user-app`, restaurante en `features/restaurant-app`, admin en `features/admin`), estilos, o integración con endpoints.

## Herramientas permitidas
`search_code`, `read_file`, `write_file`, `run_npm` (frontend: build/test), `run_playwright`/`run_e2e_tests`, `service_start`, `call_api`, `inspect_api`, `git_*`.

## Procedimiento
1. Localiza el componente/servicio con `search_code`; mira cómo lo hacen los vecinos (componentes **standalone**, `inject()`, `*ngIf`/`*ngFor` con `CommonModule`).
2. Las llamadas HTTP van en `core/services/*` (p. ej. `RestauranteService`), no en los componentes. El token lo añade `token.interceptor.ts`; no lo manipules a mano.
3. Imágenes: usa `resolverImagenUrl`/`resolvePromotionImage` y la directiva `appSafeRestaurantImage` (soporta URLs, `/uploads/...` y `data:`).
4. **Suscripciones**: toda suscripción manual a un observable de larga vida (p. ej. `AuthService.authState$`) se guarda y se cancela en `ngOnDestroy` (hubo una fuga en `ActivityHistoryComponent`).
5. Ionic dispara `ngOnInit` y `ionViewWillEnter`: no cargues datos en ambos.
6. Textos de usuario en español; nada de datos inventados ni etiquetas "demo": un estado vacío o de error real.
7. Cambios visuales: verifícalos de verdad (servir la app y mirarla, también en viewport móvil 375px y 320px).

## Validaciones
- `run_npm` project=frontend script=`build` (producción) sin errores.
- `run_e2e_tests` de la suite afectada (client/restaurant) con backend y frontend en marcha.
- Para UI: captura/inspección real del resultado; no declares "se ve bien" sin haberlo visto.

## Riesgos
- Cambios en `AuthService`/guards afectan a los 3 roles: ejecutar `login` y `client`/`restaurant` E2E.
- No toques `frontend/www`, `android`, `ios` (artefactos).
- Vercel no siempre promociona el despliegue tras un merge: lo comprueba una persona.

## Resultado esperado
Funcionalidad visible y verificada, build en verde, E2E del flujo en verde, sin datos simulados.
