# Tareas — FidelyFood / TFG

## Hecho
- [x] Auditoría de todas las copias del proyecto y elección de base canónica.
- [x] Consolidación: commit + PR + merge de trabajo pendiente (panel admin, migración de puntos, empaquetado móvil).
- [x] Corrección de secretos hardcodeados (DB password, JWT secret).
- [x] Reparación de corrupción de refs de git (residuos de sincronización).
- [x] Estado persistente (`.agent/`) y widget de escritorio.

## Pendiente (por prioridad)
1. **Validación real (Fase 4)**: instalar dependencias, build backend (`mvn clean install`) y frontend (`npm install && ng build`), arrancar ambos, comprobar conexión a MySQL, probar login/admin/puntos end-to-end, ejecutar los 3 tests existentes.
2. **Rotar la contraseña de MySQL** que estuvo en texto plano en el working tree antes del commit (usuario `fidelyfood_app` — cámbiala en el servidor MySQL y en tu `.env` local; el valor expuesto no se repite aquí a propósito).
3. **Tests**: la cobertura es casi nula; decidir si se añaden tests para el panel admin nuevo antes de seguir desarrollando encima.
4. **Agente autónomo (Fase 7)**: diseñar cómo se ejecuta trabajo en segundo plano de verdad (sesión cloud / tarea programada) — no hay nada de esto implementado todavía, solo la base de estado persistente.
5. **Limpieza de copias antiguas**: confirmar si ya moviste a la Papelera las 7 carpetas obsoletas que se identificaron en la auditoría.

## Reglas para trabajo autónomo (cuando exista)
NO debe: eliminar información importante, borrar partes grandes del proyecto, modificar credenciales/secretos, desplegar a producción, hacer cambios de arquitectura fundamentales — sin pedir autorización explícita primero.
