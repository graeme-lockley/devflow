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

### Building phase layout (flat scripts with retry)

Building phase uses **flat root exit scripts** (no loop config) with retry via
`NEXT_SCRIPT` and `BUILD_ROUND` board variables:

| Script                                | Role                                                   |
| ------------------------------------- | ------------------------------------------------------ |
| `building-001-check-entry`            | Entry checks; resets `BUILD_ROUND=1` on clean tree     |
| `building-002-pi`                     | pi build-story (includes prior-round feedback)         |
| `building-003-fmt`                    | `deno fmt` + mechanical lint-fix (unused imports)      |
| `building-004-gate-ci`                | `deno task ci`; on fail, retries from 002 if round < 5 |
| `building-005-gate-scenarios`         | Test Scenarios; on fail, retries from 002 if round < 5 |
| `building-006-check-building-quality` | Build Notes, AC, Build Tasks gate                      |
| `building-007-check-spec-updates`     | Spec Updates vs git                                    |
| `building-008-check-git-scope`        | Repo change scope                                      |

**Retry mechanism:** Gate scripts 004 and 005 set `NEXT_SCRIPT=building-002` and
increment `BUILD_ROUND` on failure (max 5 rounds). Script 002 includes
prior-round gate logs in the pi prompt when `BUILD_ROUND > 1`.

**Round tracking:** `BUILD_ROUND` is a board variable (via
`devflow variable
get/set`), reset to 1 by `building-001` on clean-tree entry.
The driver resolves `NEXT_SCRIPT=building-002` to the full script name
`building-002-pi`.

## Template sections vs exit scripts

Canonical layout: [../assets/story.template.md](../assets/story.template.md).

| `##` section                                                         | Exit script(s) that gate it                                      |
| -------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Current State, Objectives (preparing)                                | `planning-002`, `preparing-003` (idempotent if already prepared) |
| Spec References, Acceptance Criteria (draft)                         | `planning-002`, `planning-004`                                   |
| Impact Analysis, Test Scenarios, Build Tasks, Spec Updates (planned) | `planning-004`                                                   |
| Build Tasks `[x]`, Build Notes (substance), AC still `[ ]`           | `building-006` (exit)                                            |
| `deno fmt` + mechanical unused-import fix after pi edits             | `building-003` (flat; `lib/lint-fix.ts`)                         |
| `deno task ci` + automated Test Scenarios (retries)                  | `building-004`, `building-005` (gates with retry)                |
| pi **build-story** (prior-round gate logs in prompt when round > 1)  | `building-002` (flat)                                            |
| Spec Updates vs git; repo change scope                               | `building-007`, `building-008` (exit)                            |
| `### Verification summary` under **Notes**                           | `verifying-003`                                                  |
| Acceptance Criteria `[x]`                                            | `verifying-003`                                                  |
| Spec Updates closed; `### Finished` under **Notes**                  | `finishing-003`, `finishing-004`                                 |

Subsections **`### Verification summary`** and **`### Finished`** must live
under **`## Notes`**, not **`## Build Notes`**. `finishing-003` fails with a
targeted message if `### Finished` appears only under Build Notes.

Immutable doc edits (`docs/devflow-requirements.md`, `docs/architecture.md`,
`docs/adr/*`) require approval language in `card.md` (`building-007`,
`finishing-004`). Recognised phrases include `user approval`,
`explicitly
approved`, `authorised` / `authorises`, and `immutable doc`
notes—not only the exact string `explicitly approved`.

At **finishing** exit, a Spec Updates row may be `done` without an uncommitted
diff when the doc was committed in **building** (e.g.
`done (README.md lines
90–91)` or Build Notes records the path as done).
`finishing-004` allows that; it still requires a porcelain diff when marking
`done` for a change made only in this finishing hop.
