# Stories board exit scripts

Scripts run in **lexical order** when a card **leaves** a phase. Each hop also
runs `<phase>.commit-message`, then creates one git commit.

## No duplicate gates across phases

**Principle:** Once an exit script in phase _P_ has established a condition, a
later phase must **not** re-run the same check. Each phase owns only what it
introduces or changes.

The **only** check that may repeat every phase is **git status** (clean tree,
card-scoped changes, or allowed WIP for retries). Git is re-evaluated because
each hop produces a new commit and the working tree changes.

| Established at …   | Examples (do not repeat later)                                                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **planning** exit  | Impact Analysis, Test Scenarios table, unchecked Build Tasks, Spec References `[x]`, Spec Updates rows present                               |
| **building** exit  | Build Tasks `[x]`, Build Notes, AC remain `[ ]`, automated scenarios + `deno task ci`, Spec Updates vs git (pending/done), repo change scope |
| **verifying** exit | AC all `[x]`, `### Verification summary` in Notes, `devflow validate-card`                                                                   |
| **finishing** exit | Spec Updates closed (`done`/`n/a`/`deferred`), `### Finished` in Notes, spec rows vs git for **done**                                        |

Later phases may still check **merge conflict markers** in `card.md` when that
phase’s pi skill edits the card (new edits since the last commit).

Helper files (`building-lib.sh`, `*.commit-message`) are not run by Devflow as
exit scripts.

### Building phase layout (loop)

`board.json` configures `phaseScripts.building.loop` with steps under
`scripts/building/steps/`. Root scripts use sequence bands (req §9.11.3):

| Band        | Scripts                                                                 |
| ----------- | ----------------------------------------------------------------------- |
| `001`       | Entry (e.g. `building-001-check-entry`) — run before the loop           |
| `002`       | Reserved (thin orchestrator slot; native loop uses `board.json` steps)  |
| `003`+      | Exit (e.g. `building-003`, `005`, `007`) — run after the loop succeeds  |
| loop steps  | `01-pi`, `02-fmt`, `03-gate-ci`, `04-gate-scenarios` under `building/steps/` |

Do not duplicate loop gates as separate root scripts (`building-004`,
`building-006` removed).

## Template sections vs exit scripts

Canonical layout: [../assets/story.template.md](../assets/story.template.md).

| `##` section                                                         | Exit script(s) that gate it                                      |
| -------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Current State, Objectives (preparing)                                | `planning-002`, `preparing-003` (idempotent if already prepared) |
| Spec References, Acceptance Criteria (draft)                         | `planning-002`, `planning-004`                                   |
| Impact Analysis, Test Scenarios, Build Tasks, Spec Updates (planned) | `planning-004`                                                   |
| Build Tasks `[x]`, Build Notes (substance), AC still `[ ]`           | `building-003` (exit, after loop)                                |
| `deno fmt` after pi edits                                            | `building/steps/02-fmt` (loop)                                   |
| `deno task ci` + automated Test Scenarios (retries)                  | `building/steps/03-gate-ci`, `04-gate-scenarios` (loop)          |
| pi **build-story**                                                   | `building/steps/01-pi` (loop)                                    |
| Spec Updates vs git; repo change scope                               | `building-005`, `building-007` (exit, after loop)              |
| `### Verification summary` under **Notes**                           | `verifying-003`                                                  |
| Acceptance Criteria `[x]`                                            | `verifying-003`                                                  |
| Spec Updates closed; `### Finished` under **Notes**                  | `finishing-003`, `finishing-004`                                 |

Subsections **`### Verification summary`** and **`### Finished`** must live
under **`## Notes`**, not **`## Build Notes`**. `finishing-003` fails with a
targeted message if `### Finished` appears only under Build Notes.

Immutable doc edits (`docs/devflow-requirements.md`, `docs/architecture.md`,
`docs/adr/*`) require approval language in `card.md` (`building-005`,
`finishing-004`). Recognised phrases include `user approval`, `explicitly
approved`, `authorised` / `authorises`, and `immutable doc` notes—not only the
exact string `explicitly approved`.

At **finishing** exit, a Spec Updates row may be `done` without an uncommitted
diff when the doc was committed in **building** (e.g.
`done (README.md lines
90–91)` or Build Notes records the path as done).
`finishing-004` allows that; it still requires a porcelain diff when marking
`done` for a change made only in this finishing hop.
