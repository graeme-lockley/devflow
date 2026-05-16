# Devflow Implementation Roadmap

**Status:** Living document\
**Specification:** [`devflow-requirements.md`](./devflow-requirements.md)\
**Architecture:** [`architecture.md`](./architecture.md)\
**Decisions:** [`adr/README.md`](./adr/README.md)

This roadmap turns the requirements specification into a **command-ordered build
plan**. Each milestone delivers testable behaviour before the next layer depends
on it.

**Legend:** `[x]` done · `[~]` partial · `[ ]` not started

---

## Current state (baseline)

**M4 complete.** Lock registry, manual `lock release*`, `--ignore-lock` on
`variable set` / `card add-file`, signal cleanup (§14.5) via `signals.ts`.

| Area                                   | Status | Gap                                                    |
| -------------------------------------- | ------ | ------------------------------------------------------ |
| Layout                                 | `[x]`  | `.devflow/boards/<board>/`                             |
| Board file                             | `[x]`  | load/save/validate `board.json`                        |
| CLI                                    | `[x]`  | board + card + variable + block/unblock + lock release |
| Identifiers                            | `[x]`  | `^[a-z][a-z0-9_]*$`                                    |
| Git root                               | `[x]`  | Resolved via `git rev-parse`                           |
| Templates                              | `[x]`  | built-in `stories` stub; local override                |
| Repo lock on init                      | `[x]`  | `.devflow/.lock/`                                      |
| Cards, board/card locks                | `[x]`  | create/list/show/dir/rename/add-file/…                 |
| Blocking                               | `[x]`  | block / unblock; advance preconditions                 |
| `--ignore-lock`, lock release, signals | `[x]`  | —                                                      |
| Transitions (`card advance`)           | `[ ]`  | M5–M6                                                  |

Next milestone: **M5** (transition runner without git).

---

## Milestone overview

```text
M0 Foundation ──► M1 Boards ──► M2 Cards ──► M3 Blocking
                                      │
M7 Polish ◄── M6 Git ◄── M5 Advance ◄── M4 Locks
```

| Milestone | Goal                                                   | Unblocks                 |
| --------- | ------------------------------------------------------ | ------------------------ |
| **M0**    | Paths, git root, CLI parser, align `board init`        | Everything               |
| **M1**    | Board lifecycle + validation + stories template stub   | Card commands            |
| **M2**    | Card CRUD, variables, attachments                      | Blocking, locks, advance |
| **M3**    | Block / unblock                                        | Advance preconditions    |
| **M4**    | Lock acquisition, release, signal cleanup              | Safe advance             |
| **M5**    | Script runner + `card advance` (no git yet)            | Git integration          |
| **M6**    | Per-hop git commit, commit-message scripts, `--force`  | End-to-end workflow      |
| **M7**    | Console levels, full `validate`, dogfood stories board | Production use           |

---

## M0 — Foundation

**Requirements:** §4.3, §5.2, §16.0–16.1\
**Architecture:**
[`architecture.md` §2–4](./architecture.md#2-layered-structure),
[ADR-0003](./adr/0003-git-root-workspace.md),
[ADR-0004](./adr/0004-layered-module-structure.md)

### Deliverables

- [x] Resolve Git repository root before any command
      ([§4.3](./devflow-requirements.md#43-repository-workspace))
- [x] Path helpers: `.devflow/boards/<name>/`, templates, locks
      ([§4.1](./devflow-requirements.md#41-required-layout))
- [x] Identifier validation: `^[a-z][a-z0-9_]*$` for board and phase names
      ([§5.2](./devflow-requirements.md#52-identifiers))
- [x] CLI parser: object-first commands + verb-command synonyms
      ([§16.0](./devflow-requirements.md#160-command-index))
- [x] Global flags: `--verbose`, `--summary` (mutually exclusive), default
      `info` ([§16.1](./devflow-requirements.md#161-global-flags))
- [x] Ensure `.gitignore` entries for lock directories on `board init`
      ([§4.2](./devflow-requirements.md#42-git-ignore-entries))
- [x] **Realign** `board init` / `init-board`: `board.json`, `cards/` directory,
      remove legacy layout
- [x] Update tests and README to match spec layout

### Commands (M0)

| Command                                     | Spec                   | Status |
| ------------------------------------------- | ---------------------- | ------ |
| `devflow` (usage)                           | §16.0                  | `[x]`  |
| `devflow board init` / `init-board`         | §5.1, §5.2, §5.3, §5.5 | `[x]`  |
| Synonym routing for all registered commands | §16.0                  | `[x]`  |

### Done when

- `deno test` passes with new layout under a temp git repo.
- `./devflow board init stories …` creates `.devflow/boards/stories/board.json`
  per spec.
- Running outside a git repo fails with a clear error.

---

## M1 — Board lifecycle

**Requirements:** §5, §17.1\
**Architecture:** [Board store](./architecture.md#5-module-responsibilities),
[ADR-0005](./adr/0005-atomic-json-writes.md)

### Deliverables

- [x] `board.json` read/write with full schema
      ([§5.4](./devflow-requirements.md#54-board-configuration-file))
- [x] `board init`: phases, `blockedPhase`, `sequenceWidth`, `--template`
      ([§5.1](./devflow-requirements.md#51-board-creation),
      [§5.6](./devflow-requirements.md#56-board-templates))
- [x] Built-in `stories` template (minimal stub scripts/skills acceptable)
- [x] Repository-local template override: `.devflow/templates/<name>/`
      ([§5.6](./devflow-requirements.md#56-board-templates))
- [x] `board list`, `board show`
      ([§16.3](./devflow-requirements.md#163-command-reference))
- [x] `board validate` ([§17.1](./devflow-requirements.md#171-board-validation))
- [x] Repo lock on `board init`
      ([§14.3](./devflow-requirements.md#143-commands-and-locks))

### Commands (M1)

| Command                                     | Spec        | Status |
| ------------------------------------------- | ----------- | ------ |
| `devflow board init` / `init-board`         | §5.1–5.6    | `[x]`  |
| `devflow board list` / `list-boards`        | §16.3       | `[x]`  |
| `devflow board show` / `show-board`         | §5.4, §16.4 | `[x]`  |
| `devflow board validate` / `validate-board` | §17.1       | `[x]`  |

### Done when

- Can init a board from `--template stories` and validate it with exit `0`.
- `board list` prints board names one per line (no colour on stdout).

---

## M2 — Card CRUD and variables

**Requirements:** §6, §7, §8, §17.2\
**Architecture:** [Card store](./architecture.md#5-module-responsibilities),
[ADR-0005](./adr/0005-atomic-json-writes.md)

### Deliverables

- [x] `card create`: sequence allocation, board lock, atomic writes
      ([§6.2](./devflow-requirements.md#62-card-creation))
- [x] Sequence exhaustion handling
      ([§5.7](./devflow-requirements.md#57-sequence-exhaustion))
- [x] `card list` with `--phase` filter
      ([§16.3](./devflow-requirements.md#163-command-reference))
- [x] `card show`: YAML frontmatter + `card.md`
      ([§6.4](./devflow-requirements.md#64-card-state-file),
      [§16.4](./devflow-requirements.md#164-command-output-formats))
- [x] `card dir`, `card rename`, `card add-file`
      ([§6.7](./devflow-requirements.md#67-card-title-and-rename),
      [§8](./devflow-requirements.md#8-attachments))
- [x] `variable get` / `variable set`
      ([§7](./devflow-requirements.md#7-variables))
- [x] `card validate` ([§17.2](./devflow-requirements.md#172-card-validation))
- [x] History events: `created`, rename (as applicable)
      ([§6.4](./devflow-requirements.md#64-card-state-file))

### Commands (M2)

| Command                                   | Spec        | Status |
| ----------------------------------------- | ----------- | ------ |
| `devflow card create` / `create-card`     | §6.2        | `[x]`  |
| `devflow card list` / `list-cards`        | §16.3       | `[x]`  |
| `devflow card show` / `show-card`         | §6.4, §16.4 | `[x]`  |
| `devflow card dir` / `card-dir`           | §16.3       | `[x]`  |
| `devflow card rename` / `rename-card`     | §6.7        | `[x]`  |
| `devflow card add-file` / `add-card-file` | §8          | `[x]`  |
| `devflow variable get` / `get-variable`   | §7.1        | `[x]`  |
| `devflow variable set` / `set-variable`   | §7.2        | `[x]`  |
| `devflow card validate` / `validate-card` | §17.2       | `[x]`  |

### Done when

- Full create → show → set variable → add-file flow works in a temp git repo.
- Machine stdout (`card create`, `card dir`, `variable get`) has no ANSI codes.

---

## M3 — Blocking

**Requirements:** §12\
**Architecture:** [Card store](./architecture.md#5-module-responsibilities)

### Deliverables

- [x] `card block` with reason and history
      ([§12.1](./devflow-requirements.md#121-block-card))
- [x] `card unblock` restoring `previousPhase`
      ([§12.2](./devflow-requirements.md#122-unblock-card))
- [x] Reject `card advance` when card is blocked
      ([§12.3](./devflow-requirements.md#123-blocked-cards-and-advance))
- [x] Validation: blocked metadata consistency
      ([§17.2](./devflow-requirements.md#172-card-validation))

### Commands (M3)

| Command                                 | Spec  | Status |
| --------------------------------------- | ----- | ------ |
| `devflow card block` / `block-card`     | §12.1 | `[x]`  |
| `devflow card unblock` / `unblock-card` | §12.2 | `[x]`  |

### Done when

- Block → unblock returns card to prior phase; validate passes.
- Advance on blocked card exits non-zero.

---

## M4 — Locking

**Requirements:** §14, §16.1 (`--ignore-lock`)\
**Architecture:** [Lock service](./architecture.md#5-module-responsibilities),
[ADR-0006](./adr/0006-directory-locks.md),
[ADR-0010](./adr/0010-signal-forwarding.md)

### Deliverables

- [x] `mkdir`-based lock acquire/release
      ([§14.4](./devflow-requirements.md#144-lock-implementation))
- [x] Wire locks per command table
      ([§14.3](./devflow-requirements.md#143-commands-and-locks))
- [x] `--ignore-lock` only on `variable set`, `card add-file`
      ([§16.1](./devflow-requirements.md#161-global-flags))
- [x] `lock release`, `lock release-board`, `lock release-repo` with `--force`
      ([§14.6](./devflow-requirements.md#146-manual-lock-release))
- [x] Signal handlers: forward to child, release locks, exit non-zero
      ([§14.5](./devflow-requirements.md#145-lock-cleanup-and-signals))

### Commands (M4)

| Command                                             | Spec  | Status |
| --------------------------------------------------- | ----- | ------ |
| `devflow lock release` / `release-lock`             | §14.6 | `[x]`  |
| `devflow lock release-board` / `release-board-lock` | §14.6 | `[x]`  |
| `devflow lock release-repo` / `release-repo-lock`   | §14.6 | `[x]`  |

### Done when

- Concurrent `card create` on same board: second invocation fails with clear
  lock error.
- `--ignore-lock` works from a test harness simulating in-transition variable
  set.

---

## M5 — Transition runner (without Git)

**Requirements:** §9, §11, §15, §18\
**Architecture:**
[Transition runner](./architecture.md#5-module-responsibilities),
[ADR-0007](./adr/0007-script-invocation.md),
[ADR-0008](./adr/0008-transition-runner-orchestration.md)

### Deliverables

- [ ] Script discovery and lexical ordering
      ([§9.3](./devflow-requirements.md#93-script-execution-order))
- [ ] Script invocation: repo root cwd, args, `DEVFLOW_*` env
      ([§9.4](./devflow-requirements.md#94-script-arguments),
      [§18](./devflow-requirements.md#18-environment-variables-for-scripts))
- [ ] Direct executable invocation (shebang)
      ([§9.9](./devflow-requirements.md#99-script-execution-environment))
- [ ] Log capture under `logs/<timestamp>-advance-…/`
      ([§15](./devflow-requirements.md#15-logs))
- [ ] `card advance`: single-hop and multi-hop
      ([§11.3](./devflow-requirements.md#113-multi-phase-advance),
      [§11.4](./devflow-requirements.md#114-transition-algorithm))
- [ ] Failure behaviour, `transitionFailed` history
      ([§11.5](./devflow-requirements.md#115-failure-behaviour))
- [ ] Already-at-target no-op
      ([§11.6](./devflow-requirements.md#116-already-at-target-behaviour))
- [ ] Reject backward target
      ([§11.7](./devflow-requirements.md#117-backward-movement))
- [ ] Git precondition check stub (merge/rebase detection) — full behaviour in
      M6 ([§13.8](./devflow-requirements.md#138-git-preconditions))
- [ ] **Defer git commit** to M6; advance updates phase and logs only in M5
      integration tests

### Commands (M5)

| Command                                 | Spec | Status |
| --------------------------------------- | ---- | ------ |
| `devflow card advance` / `advance-card` | §11  | `[ ]`  |

### Done when

- Multi-hop advance runs scripts in order; failure stops with log path.
- Test board with fake scripts (exit 0/1) proves algorithm without git.

---

## M6 — Git integration

**Requirements:** §13\
**Architecture:** [Git service](./architecture.md#5-module-responsibilities),
[ADR-0009](./adr/0009-git-commit-boundary.md)

### Deliverables

- [ ] Per-hop: exit scripts → commit-message → state update → `git add -A` →
      `git commit` ([§13.5](./devflow-requirements.md#135-per-hop-lifecycle))
- [ ] Commit-message script handling and fallback
      ([§13.4](./devflow-requirements.md#134-commit-message-scripts))
- [ ] Git failure after state update: no history append, manual recovery message
      ([§13.7](./devflow-requirements.md#137-git-commit-failure))
- [ ] Unresolved merge/rebase guard before scripts
      ([§13.8](./devflow-requirements.md#138-git-preconditions))
- [ ] `card advance --force`: no scripts, no commit
      ([§11.8](./devflow-requirements.md#118-force-movement))
- [ ] Repo + card locks for full advance
      ([§14.1](./devflow-requirements.md#141-locking-model))

### Commands (M6)

| Command                                        | Spec     | Status |
| ---------------------------------------------- | -------- | ------ |
| `devflow card advance` / `advance-card` (full) | §11, §13 | `[ ]`  |

### Done when

- Single-hop advance creates exactly one git commit with expected message.
- Multi-hop advance creates one commit per hop; earlier hops not rolled back on
  later failure.

---

## M7 — Polish and dogfood

**Requirements:** §16.2, §17, §19\
**Architecture:** [Console output](./architecture.md#5-module-responsibilities),
[ADR-0011](./adr/0011-console-output-levels.md)

### Deliverables

- [ ] TTY colour rules; machine stdout without codes
      ([§16.2](./devflow-requirements.md#162-console-output))
- [ ] `devflow validate` (repo + all boards + all cards)
      ([§17](./devflow-requirements.md#17-validation-requirements))
- [ ] Complete built-in **stories** template (scripts + skills)
      ([§5.6](./devflow-requirements.md#56-board-templates))
- [ ] End-to-end example workflow documented in tests or `docs/`
      ([§19](./devflow-requirements.md#19-example-workflow))
- [ ] Deno permissions documented in README / `deno.json` tasks

### Commands (M7)

| Command                         | Spec  | Status |
| ------------------------------- | ----- | ------ |
| `devflow validate` / `validate` | §17   | `[ ]`  |
| All commands — output levels    | §16.2 | `[ ]`  |

### Done when

- Can run a card through the stories workflow in a real repo (manual or
  integration test).
- `deno test` covers critical paths for each milestone’s commands.

---

## Full command checklist

Cross-reference:
[§16.0 command index](./devflow-requirements.md#160-command-index).

| Command                      | Milestone | Status |
| ---------------------------- | --------- | ------ |
| `devflow`                    | M0        | `[x]`  |
| `devflow validate`           | M7        | `[ ]`  |
| `devflow board init`         | M0/M1     | `[x]`  |
| `devflow board list`         | M1        | `[x]`  |
| `devflow board show`         | M1        | `[x]`  |
| `devflow board validate`     | M1        | `[x]`  |
| `devflow card create`        | M2        | `[x]`  |
| `devflow card list`          | M2        | `[x]`  |
| `devflow card show`          | M2        | `[x]`  |
| `devflow card dir`           | M2        | `[x]`  |
| `devflow card add-file`      | M2        | `[x]`  |
| `devflow card advance`       | M5/M6     | `[ ]`  |
| `devflow card block`         | M3        | `[x]`  |
| `devflow card unblock`       | M3        | `[x]`  |
| `devflow card rename`        | M2        | `[x]`  |
| `devflow card validate`      | M2        | `[x]`  |
| `devflow variable get`       | M2        | `[x]`  |
| `devflow variable set`       | M2        | `[x]`  |
| `devflow lock release`       | M4        | `[x]`  |
| `devflow lock release-board` | M4        | `[x]`  |
| `devflow lock release-repo`  | M4        | `[x]`  |

Verb-command synonyms (`init-board`, `create-card`, …) ship with each milestone
alongside object-first forms.

---

## Testing strategy

| Layer           | Approach                                                                         |
| --------------- | -------------------------------------------------------------------------------- |
| **Unit**        | Identifiers, path helpers, script name matching, phase ordering, history append  |
| **Integration** | Temp git repo per test; real filesystem; fake scripts with `#!/usr/bin/env bash` |
| **Advance**     | Board with 2–3 phases and numbered scripts; assert logs, state, and commit count |
| **Locks**       | Parallel command tests expecting lock failure                                    |

Prefer tests that cite requirement sections in the test name or module doc
comment (e.g. `advance: stops on script failure (req §11.5)`).

---

## Out of scope (this roadmap)

- Web UI or daemon mode
- Running scripts outside `card advance`
- Automatic retry of failed scripts
- Parallel card advance in one repository
- Sandboxing board scripts

These are excluded by the requirements specification.

---

## Suggested work order

1. Complete **M0** before any new commands (avoids building on the wrong
   layout).
2. **M1 → M2 → M3 → M4** in sequence (each milestone is independently testable).
3. **M5** before **M6** to validate transition logic without git complexity.
4. **M7** last; expand the stories template while implementing M1/M5/M6 as
   needed.

Update checkbox status in this file as milestones land.
