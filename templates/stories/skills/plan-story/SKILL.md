# plan-story

Skill for the planning exit script (`planning-003-do-planning`). Invoked by
board scripts via **pi-mono** (external; not bundled with Devflow).

## Usage

```bash
pi-mono run --skill .devflow/boards/<board>/skills/plan-story --board <board> --card <card-id>
```

Set `DEVFLOW_SKIP_PI=1` to skip pi-mono during CI or local testing.

## Purpose

Guide an agent through story planning: read `card.md`, produce or refine a plan,
and update card content via `devflow variable set` / `card add-file` with
`--ignore-lock` when called from a transition.
