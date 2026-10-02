# Skill: git

## Propósito
Trabajar con Git sin pisar nunca trabajo humano: ramas del agente, commits pequeños y lógicos, y entrega vía Pull Request revisado por una persona.

## Cuándo usarla
Al inicio de cualquier tarea que modifique archivos y al terminarla.

## Herramientas permitidas
`git_status`, `git_diff`, `git_log`, `git_branch`, `git_create_branch`, `git_commit`, `github_list_prs`, `github_get_pr`. Con aprobación: `github_create_pr`, `git push`.

## Procedimiento
1. **Antes de empezar**: `git_status`. Si hay cambios sin commitear que no son tuyos, no toques esos archivos (el agente no puede sobrescribirlos sin aprobación).
2. Crea una rama `agent/<tema-corto>` con `git_create_branch` (desde `origin/main` si procede). Los commits y escrituras del agente solo se permiten en ramas `agent/*`.
3. Commits **pequeños y lógicos**: un cambio no relacionado = un commit aparte. `git_commit` solo con los archivos que tocaste; mensaje que explique el porqué.
4. Antes de terminar: `git_diff`, revisa que no hay secretos ni archivos accidentales (`.env`, `uploads/`, `agent/data/`).
5. **Nunca** push, merge, rebase, reset --hard ni borrado de ramas sin aprobación humana. La entrega es un PR (`github_create_pr`, siempre con aprobación) y lo fusiona una persona.
6. El worktree `../TFG-agent-worktree` (rama `agent/fidelyfood-autonomous`) lo usa la rutina diaria en la nube; no lo uses para tareas interactivas.

## Validaciones
- `git_status` limpio de cambios no deseados tras el commit.
- El diff contiene solo lo pedido por la tarea.
- Los tests pasaron **antes** de commitear.

## Riesgos
- La rama `main` local puede estar divergida de `origin/main`: crea ramas desde `origin/main`, no desde `main`.
- Los squash-merge cambian los hashes: un commit local puede estar ya integrado con otro hash (comprobar con `git_log`/GitHub antes de darlo por perdido).

## Resultado esperado
Una rama `agent/*` con commits limpios, tests en verde, y un PR listo (pendiente de aprobación para crearlo) con resumen de qué cambió, por qué, riesgos y siguientes pasos.
