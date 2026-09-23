# Tareas — FidelyFood / TFG

## Hecho
- [x] Auditoría de todas las copias del proyecto y elección de base canónica.
- [x] Consolidación: commit + PR + merge de trabajo pendiente (panel admin, migración de puntos, empaquetado móvil).
- [x] Corrección de secretos hardcodeados (DB password, JWT secret).
- [x] Reparación de corrupción de refs de git (residuos de sincronización).
- [x] Estado persistente (`.agent/`) y widget de escritorio.

## Hecho (continuación)
- [x] Fase 4 — Validación real: MySQL local configurado (root rotado, usuario `fidelyfood_app` recreado con contraseña nueva en `.env` gitignored), backend y frontend compilan y arrancan, login admin + JWT + dashboard + gestión de negocios probados en navegador real con datos reales.

## Pendiente (por prioridad)
1. **Probar el resto del panel admin** (clientes, reservas, estadísticas) y el flujo normal de usuario/restaurante — solo se probó dashboard + negocios.
2. **Tests**: la cobertura es casi nula (0% en el panel admin); decidir si se añaden tests antes de seguir desarrollando encima. Instalar Chrome/Chromium si se quiere ejecutar Jasmine/Karma.
3. **Agente autónomo (Fase 7)**: diseñar cómo se ejecuta trabajo en segundo plano de verdad (sesión cloud / tarea programada) — no hay nada de esto implementado todavía, solo la base de estado persistente.
4. **Limpieza de copias antiguas**: confirmar si ya moviste a la Papelera las 7 carpetas obsoletas que se identificaron en la auditoría.
5. Si en algún momento se despliega a un entorno compartido/producción, generar una contraseña de MySQL y un JWT secret distintos de los usados en local.

## Reglas para trabajo autónomo (cuando exista)
NO debe: eliminar información importante, borrar partes grandes del proyecto, modificar credenciales/secretos, desplegar a producción, hacer cambios de arquitectura fundamentales — sin pedir autorización explícita primero.
