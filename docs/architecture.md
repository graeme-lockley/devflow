# Devflow Architecture

**Status:** Architecture sketch\
**Specification:** [`devflow-requirements.md`](./devflow-requirements.md)\
**Decisions:** [`adr/README.md`](./adr/README.md)

This document describes how the Devflow **CLI implementation** is structured.
Behavioural rules live in the requirements specification; this document covers
**module boundaries**, **data flow**, and **dependency direction** only.

---

## 1. System context

```text
                    ┌─────────────────────────────────────┐
                    │           Operator / Agent          │
                    └─────────────────┬───────────────────┘
                                      │ devflow CLI
                                      ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                              Devflow (Deno)                              │
│  ┌────────┐   ┌─────────────┐   ┌───────────────────┐   ┌─────────────┐  │
│  │  CLI   │──►│  Commands   │──►│ Transition runner │──►│ Script exec │  │
│  └────────┘   └──────┬──────┘   └────────┬──────────┘   └─────────────┘  │
│                      │                    │                              │
│                      ▼                    ▼                              │
│               ┌──────────────┐     ┌──────────────┐                      │
│               │ Board / Card │     │ Lock + Git   │                      │
│               │   stores     │     │  services    │                      │
│               └──────┬───────┘     └──────┬───────┘                      │
└──────────────────────┼────────────────────┼──────────────────────────────┘
                       │                    │
                       ▼                    ▼
              ┌────────────────┐    ┌───────────────┐
              │  Filesystem    │    │  git / shell  │
              │  .devflow/     │    │  subprocesses │
              └────────────────┘    └───────────────┘
```

Devflow is a **single-process CLI**. There is no server, database, or background
worker. Durability is the Git-tracked filesystem under `.devflow/`.

---

## 2. Layered structure

Dependencies flow **downward** only (higher layers may not be imported by lower
layers).

```text
┌─────────────────────────────────────────┐
│  main.ts          Entry, Deno.exit      │
├─────────────────────────────────────────┤
│  cli/             Parse, dispatch, flags│
├─────────────────────────────────────────┤
│  commands/        One handler per verb  │
├─────────────────────────────────────────┤
│  services/        Transition, scripts,  │
│                   git, locks, console   │
├─────────────────────────────────────────┤
│  domain/          Board, card, history  │
│                   validation rules      │
├─────────────────────────────────────────┤
│  infra/           paths, git-root,      │
│                   atomic-io, ids        │
└─────────────────────────────────────────┘
```

| Layer        | Responsibility                           | Must not                        |
| ------------ | ---------------------------------------- | ------------------------------- |
| **cli**      | argv → command + flags; usage strings    | Implement business rules        |
| **commands** | Orchestrate one user action; exit codes  | Run scripts directly (delegate) |
| **services** | Cross-cutting workflows (advance, locks) | Parse raw argv                  |
| **domain**   | Types, validation, state transitions     | Spawn subprocesses              |
| **infra**    | Paths, I/O primitives, git root          | Know about specific commands    |

---

## 3. Repository layout (implementation)

Target layout under `src/` (evolve from current flat structure during M0):

```text
src/
  cli/
    parser.ts           # object-first + synonym routing
    flags.ts            # --verbose, --summary, --ignore-lock
    dispatch.ts         # command → handler
  commands/
    board-init.ts
    board-list.ts
    card-create.ts
    card-advance.ts
    ...
  services/
    transition.ts       # §11.4 algorithm
    scripts.ts          # discover, order, invoke, log
    git.ts              # preconditions, add, commit
    locks.ts            # mkdir locks, release, signals
    console.ts          # output levels, TTY colours
    templates.ts        # copy built-in / local templates
  domain/
    board.ts            # board.json load/save/validate
    card.ts             # state.json load/save/validate
    history.ts          # append typed events
    phases.ts           # ordering, forward-only checks
    identifiers.ts      # regex validation
  infra/
    paths.ts            # all .devflow path builders
    git-root.ts         # resolve repo root
    atomic-write.ts     # temp + rename
    subprocess.ts       # Deno.Command wrappers
  board/                # (legacy — merge into domain/ in M0)
  paths.ts              # (legacy — merge into infra/ in M0)
```

Tests live beside modules (`*_test.ts`) or under `test/` for integration
fixtures (fake boards, stub scripts).

---

## 4. Request lifecycle

Every command follows the same pipeline:

```text
argv
  → parse global flags
  → resolve git root (chdir or use absolute paths from root)
  → dispatch to command handler
  → acquire locks (if mutating)
  → read/mutate domain state via atomic writes
  → invoke services (scripts, git) when needed
  → release locks (finally)
  → exit code + stdout/stderr
```

**Git root:** All path operations are relative to the repository root
([§4.3](./devflow-requirements.md#43-repository-workspace)). The CLI may
`Deno.chdir` to root once per invocation or pass `root` into every infra helper
([ADR-0003](./adr/0003-git-root-workspace.md)).

---

## 5. Module responsibilities

### 5.1 CLI (`src/cli/`)

- Parse `devflow board init …` and `devflow init-board …` to the same handler.
- Reject unsupported flag combinations before work starts
  ([§16.1](./devflow-requirements.md#161-global-flags)).
- Set `DEVFLOW_LOG_LEVEL` for nested invocations
  ([§16.2](./devflow-requirements.md#162-console-output)).

### 5.2 Commands (`src/commands/`)

Thin adapters: validate arguments, call domain + services, map errors to exit
codes. Example:

```text
card-advance.ts
  → resolve card + board
  → reject if blocked
  → locks.acquireRepo() + locks.acquireCard()
  → transition.runAdvance(card, targetPhase, { force })
  → locks.releaseAll()
```

### 5.3 Transition runner (`src/services/transition.ts`)

Implements [§11.4](./devflow-requirements.md#114-transition-algorithm):

```text
for each single-phase hop:
  run exit scripts (scripts service) including loop orchestration if configured
  run commit-message script (scripts service) — M6
  update card phase + history (domain)
  git commit hop (git service) — M6
```

**Loop orchestration**
([§9.11](./devflow-requirements.md#911-phase-loop-blocks),
[ADR-0014](./adr/0014-script-composition-and-loops.md)):

- Reads `board.phaseScripts[phase].loop` configuration if present.
- Runs entry scripts (root exit scripts lexically before loop steps).
- Runs loop block: iterate `loop.steps` up to `maxRounds`, restarting from first
  step on any failure.
- Runs exit scripts (root exit scripts lexically after loop steps).
- Logs round boundaries at info level; records rounds in `run.json`.
- On loop exhaustion, returns structured error with round and failing step.

Owns **orchestration** only. Does not embed script-matching regex (delegates to
`scripts.ts`).

### 5.4 Script service (`src/services/scripts.ts`)

- List **root exit scripts** in `scripts/` matching phase patterns
  ([§9.3](./devflow-requirements.md#93-script-execution-order)); child scripts
  and subdirectories are not auto-discovered.
- Invoke with `Deno.Command` or direct execution per
  [ADR-0007](./adr/0007-script-invocation.md).
- **Child script invocation** (loop steps or parent-invoked):
  [ADR-0014](./adr/0014-script-composition-and-loops.md) adds
  `invokeChildScript` that sets `DEVFLOW_SCRIPT_PARENT`, `DEVFLOW_SCRIPT_ROUND`,
  `DEVFLOW_LOOP_MAX` environment variables.
- Stream stdout/stderr to console per log level; always write full transcript to
  `logs/` ([§15](./devflow-requirements.md#15-logs),
  [§16.2](./devflow-requirements.md#162-console-output)).
- Forward signals to child
  ([§14.5](./devflow-requirements.md#145-lock-cleanup-and-signals)).

### 5.5 Git service (`src/services/git.ts`)

- Detect dirty git state blocking advance
  ([§13.8](./devflow-requirements.md#138-git-preconditions)).
- `git add -A` and `git commit` after successful hop
  ([§13.5](./devflow-requirements.md#135-per-hop-lifecycle)).
- Surface git failures without rolling back card state
  ([§13.7](./devflow-requirements.md#137-git-commit-failure)).

### 5.6 Lock service (`src/services/locks.ts`)

- `mkdir` lock directories; `rmdir` on release
  ([§14.4](./devflow-requirements.md#144-lock-implementation)).
- Register signal handlers once per process
  ([ADR-0010](./adr/0010-signal-forwarding.md)).

### 5.7 Board / card stores (`src/domain/`)

- Load and validate `board.json` / `state.json`.
- **Board config validation**
  ([§5.4](./devflow-requirements.md#54-board-configuration-file)): includes
  optional `phaseScripts.<phase>.loop` schema check (steps array, maxRounds ≥ 1)
  per [ADR-0014](./adr/0014-script-composition-and-loops.md).
- Atomic write via infra ([ADR-0005](./adr/0005-atomic-json-writes.md)).
- **Single writer** for `state.json` — only Devflow commands mutate it
  ([§6.5](./devflow-requirements.md#65-ownership-of-card-files)).

### 5.8 Validation (`src/domain/validate.ts` or `commands/validate-*.ts`)

- Pure functions mirroring
  [§17](./devflow-requirements.md#17-validation-requirements).
- `validate` command aggregates board + card checks without modifying files.
- **Board validation** includes `phaseScripts` schema check: loop steps must
  reference existing executable files under `scripts/`; `maxRounds` must be ≥ 1.

### 5.9 Console output (`src/services/console.ts`)

- `info` / `verbose` / `summary` behaviour
  ([§16.2](./devflow-requirements.md#162-console-output)).
- Colour on stderr/boilerplate; plain stdout for machine-parseable command
  output.

---

## 6. Key data flows

### 6.1 Card create

```text
card create
  → lock board
  → read board.json (nextSequence, sequenceWidth)
  → allocate id, increment nextSequence
  → write card dirs + state.json + card.md (atomic)
  → write board.json (atomic)
  → unlock board
  → print card id
```

### 6.2 Card advance (normal)

```text
card advance
  → lock repo + card
  → for hop in phase range:
       run phase exit scripts → fail? stop, transitionFailed
       run commit-message script → capture message
       update state.json (phase, history)
       git add -A && git commit
  → unlock
```

### 6.3 Nested CLI from scripts

Scripts call `devflow variable set … --ignore-lock`. The child process is a
**new** Deno invocation; it must not deadlock on locks held by the parent
([§14.1](./devflow-requirements.md#141-locking-model),
[§16.1](./devflow-requirements.md#161-global-flags)).

---

## 7. Templates

Built-in templates ship with the Devflow package (location TBD:
`templates/stories/` at repo root or embedded path resolved from
`import.meta.url`).

Copy order ([§5.6](./devflow-requirements.md#56-board-templates)):

```text
1. .devflow/templates/<name>/   (repository-local)
2. built-in templates/<name>/   (shipped with Devflow)
```

`templates.ts` copies `scripts/` and `skills/` only; it does not create cards.

---

## 8. Error handling conventions

| Situation          | Exit code | Stdout                        | Stderr                                                                           |
| ------------------ | --------- | ----------------------------- | -------------------------------------------------------------------------------- |
| Success            | 0         | Machine output when specified | Optional info (grey/green)                                                       |
| Usage / flag error | non-zero  | —                             | Error + usage                                                                    |
| Validation failure | non-zero  | —                             | Red error details                                                                |
| Lock held          | non-zero  | —                             | Lock path                                                                        |
| Script failure     | non-zero  | —                             | Script name, log path ([§11.5](./devflow-requirements.md#115-failure-behaviour)) |

Use typed errors in domain/services; commands map them to messages and codes.

---

## 9. Deno runtime

| Concern      | Approach                                                                  |
| ------------ | ------------------------------------------------------------------------- |
| Entry        | `main.ts` → `runCli(Deno.args)`                                           |
| Subprocesses | `Deno.Command` for `git` and script execution                             |
| Permissions  | `--allow-read --allow-write --allow-run --allow-env` (document in README) |
| Tests        | `deno test` with temp dirs; no network                                    |

See [ADR-0001](./adr/0001-deno-runtime.md).

---

## 10. Intentional non-goals

- No plugin system beyond shell scripts in `scripts/`.
- No embedded LLM runtime (scripts invoke `pi-mono` externally).
- No caching layer over filesystem state.
- No migration tool for legacy `.devflow/<board>/` layout (M0 is a clean break
  for this repo).

---

## 11. Relation to ADRs

Architecture choices that need a recorded rationale are in
[`docs/adr/`](./adr/README.md). When implementation diverges from an ADR, update
the ADR or add a superseding ADR before changing code.
