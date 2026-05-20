# Stories board template

Built-in template for the standard story workflow (req §5.6, §19).

## Initialize

```bash
devflow board init stories unplanned planning planned building built verifying verified finishing finished --template stories
```

## Phases

Exit scripts run when **leaving** a phase (lexical order). Each hop also runs
`<phase>.commit-message` when present, then one git commit.

| Leaving phase    | Exit scripts                                                       | Commit message             |
| ---------------- | ------------------------------------------------------------------ | -------------------------- |
| unplanned        | `unplanned-001-*`, `unplanned-002-*`                               | `unplanned.commit-message` |
| planning         | `planning-001` … `planning-005`                                    | `planning.commit-message`  |
| planned          | `planned-001-noop`                                                 | `planned.commit-message`   |
| building         | `building-001-check-entry` → loop → `building-003` / `005` / `007` | `building.commit-message`  |
| built … finished | `*-001-noop` each                                                  | `<phase>.commit-message`   |

## pi-mono

`planning-003-do-planning` invokes **pi-mono** with the `plan-story` skill when
`pi-mono` is on `PATH` and `DEVFLOW_SKIP_PI` is not set.

```bash
export DEVFLOW_SKIP_PI=1   # CI / tests without pi-mono
```

## Skills

- `plan-story` — planning via pi-mono
- `verify-planning-quality` — optional deeper review
- `create-commit-message` — reference for commit message format

Devflow does not interpret skill contents; scripts consume them.
