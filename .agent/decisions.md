# Decisiones de arquitectura — FidelyFood / TFG

## 2026-09-22 — Proyecto base
**Decisión**: `/Users/montaggioni/projects/TFG-repaired-20260917` es la versión canónica del proyecto.
**Motivo**: git-idéntica en historial a `Desktop/TFG-` (el original), pero es la única con el trabajo nuevo (panel admin, migración de puntos) sin commitear. `Desktop/TFG-` está afectada por corrupción de git causada por sincronización de iCloud. El resto de copias (`projects/TFG-`, `TFG-_zero_byte_backup`, `TFG-clean`, `Downloads/SpringBoot_TFG(2)`, `Desktop/FidelyFood_Limpio`) son snapshots antiguos o están rotas, sin nada exclusivo.

## 2026-09-22 — Consolidación vía PR, no push directo a main
**Decisión**: el trabajo pendiente se commiteó en una rama nueva (`consolidacion-admin-panel-2026-09`) y se abrió un PR contra `main`, en vez de pushear directo.
**Motivo**: eran ~95 archivos de trabajo previo no producido en la sesión actual; abrir PR permite revisión antes de fusionar, más seguro que sobrescribir `main` directamente.

## 2026-09-22 — "Llamaq" = Claude Desktop app, no modificable
**Descubrimiento**: "Llamaq" (nombre usado por el usuario) se refiere a la app Claude Desktop (`/Applications/Claude.app`, bundle id `com.anthropic.claudefordesktop`) en la que se ejecutan estas sesiones. No existe ningún repositorio o instalación separada con ese nombre en el entorno.
**Decisión**: no es posible integrar un widget nativo dentro de esa app (es una aplicación cerrada y firmada de Anthropic, sin código fuente disponible). Se implementó en su lugar un widget de escritorio de macOS independiente (Übersicht), que lee el estado desde `.agent/state.json` de este proyecto.

## 2026-09-22 — Fuente de datos de uso/créditos
**Decisión**: el widget muestra una foto fija del uso (ventanas de 5h/semanal del plan Pro, tokens de contexto de sesión), tomada mediante la herramienta `get_usage` de Claude Code dentro de una sesión, y escrita a `.agent/state.json`.
**Motivo**: no existe una API pública de Anthropic que un script de shell externo (el widget) pueda consultar de forma independiente para obtener estos datos en vivo. No se muestran "créditos" como unidad separada porque esa métrica no existe/no se expone — solo porcentajes de las ventanas de límite del plan y tokens de contexto.

## Pendiente de decidir
- Arquitectura real de "modo autónomo" (Fase 7): sesión en la nube vs. tarea programada (`schedule`) vs. proceso local persistente. Requiere que el usuario defina el alcance y frecuencia antes de implementarlo.
