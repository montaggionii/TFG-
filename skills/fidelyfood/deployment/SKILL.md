# Skill: deployment

## Propósito
Entender y preparar el despliegue de FidelyFood sin tocar nunca producción por cuenta propia: el agente prepara y verifica; una persona despliega.

## Cuándo usarla
Cuando una tarea afecta a variables de entorno, Docker/Render, Vercel, CORS de producción o al comportamiento en producción.

## Herramientas permitidas
`read_file` (`DEPLOYMENT.md`, `Dockerfile`, `render.yaml`, `.env.example`), `search_code`, `call_api` (solo `AGENT_ENV=staging` con aprobación; producción de solo lectura), `github_list_prs`.

## Procedimiento
1. Lee `DEPLOYMENT.md` y `.env.example` (nombres de variables, nunca valores).
2. Topología real: backend en **Render** (Docker, plan gratuito), frontend en **Vercel**, MySQL en **Aiven** (plan gratuito).
3. Particularidades conocidas (ya costaron tiempo): Aiven free **apaga la BD por inactividad** (síntoma: `UnknownHostException` en Render); el disco de Render es **efímero** (nada de archivos subidos en disco); Vercel a veces no promociona el nuevo despliegue tras un merge; Render solo despliega el commit que le indiquen.
4. Si el cambio necesita variables nuevas: documentarlas en `.env.example` y `DEPLOYMENT.md`; **no** pidas ni escribas valores reales.
5. Prepara el cambio y verifícalo en local; el despliegue, las variables de producción y los redeploys manuales los hace una persona.

## Validaciones
- Build del backend (`run_maven package`) y del frontend (`run_npm build`) en verde.
- `.env.example`/`DEPLOYMENT.md` actualizados si hay variables nuevas.
- Tras el despliegue (humano): `call_api GET /ping` y el flujo afectado.

## Riesgos
- Deploy, cambio de credenciales/secretos y migraciones destructivas requieren aprobación explícita y están **bloqueados** en el entorno `production` del agente.
- Mezclar credenciales de entornos: cada entorno tiene sus propias variables (`AGENT_STAGING_*`, `AGENT_PROD_*`).

## Resultado esperado
Cambio listo para desplegar, documentado, con instrucciones claras para la persona que lo despliega y cómo verificarlo después.
