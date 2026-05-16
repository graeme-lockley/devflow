# Stories board exit scripts

Scripts run in **lexical order** when a card **leaves** a phase. Each hop also
runs `<phase>.commit-message`, then creates one git commit.

## No duplicate gates across phases

**Principle:** Once an exit script in phase *P* has established a condition, a
later phase must **not** re-run the same check. Each phase owns only what it
introduces or changes.

The **only** check that may repeat every phase is **git status** (clean tree,
card-scoped changes, or allowed WIP for retries). Git is re-evaluated because each
hop produces a new commit and the working tree changes.

| Established at … | Examples (do not repeat later) |
| ---------------- | ------------------------------ |
| **planning** exit | Impact Analysis, Test Scenarios table, unchecked Build Tasks, Spec References `[x]`, Spec Updates rows present |
| **building** exit | Build Tasks `[x]`, Build Notes, AC remain `[ ]`, automated scenarios + `deno task ci`, Spec Updates vs git (pending/done), repo change scope |
| **verifying** exit | AC all `[x]`, `### Verification summary` in Notes, `devflow validate-card` |
| **finishing** exit | Spec Updates closed (`done`/`n/a`/`deferred`), `### Finished` in Notes, spec rows vs git for **done** |

Later phases may still check **merge conflict markers** in `card.md` when that
phase’s pi skill edits the card (new edits since the last commit).

Helper files (`building-lib.sh`, `*.commit-message`) are not run by Devflow as
exit scripts.
