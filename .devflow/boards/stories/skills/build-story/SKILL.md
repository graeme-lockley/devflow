---
name: build-story
version: 1.0.0
description: >-
  Implements a Devflow story card during the building phase by executing Build Tasks,
  updating Build Notes, and producing code and tests. Use when advancing out of
  building or when implementation work is requested for a card in building phase.
outputs:
  - Production code and tests per Build Tasks
  - Updated card.md Build Tasks checkboxes and Build Notes
allowed-tools:
  - read
  - write
  - edit
  - bash
forbids:
  - git push
---

# Build a Story

Executes **building** for a story card: implement the plan in `card.md`, check
off **Build Tasks**, and maintain **Build Notes**. Follow the canonical
[story template](../../assets/story.template.md).

The agent writes and modifies production code and tests. It does **not** advance
the card phase or create git commits—Devflow transition scripts commit after
exit scripts succeed.

## When this skill runs

| Trigger           | Context                                               |
| ----------------- | ----------------------------------------------------- |
| Board exit script | Leaving **building** → **verifying**                  |
| Manual            | User requests implementation for a card in `building` |

## Canonical template

**[`.devflow/boards/stories/assets/story.template.md`](../../assets/story.template.md)**

Satisfy gates marked **building** or **exit building**. Planning sections must
already be complete.

## Environment

Same `DEVFLOW_*` variables as other transition skills (§18). On the building →
verifying hop, `DEVFLOW_FROM_PHASE=building` and `DEVFLOW_TO_PHASE=verifying`.

```bash
./devflow card dir <card-id>
cd "$(git rev-parse --show-toplevel)"   # repo root for deno test / devflow
```

## Inputs

- **Card ID** (required): e.g. `stories-000001`

## Preconditions

1. `state.json` → `phase` is `building`.
2. `card.md` has complete **planning** sections: Spec References, Acceptance
   Criteria, Impact Analysis, Test Scenarios, Build Tasks, Spec Updates
   (planned).
3. **Build Tasks** lists at least one unchecked item.

If planning is incomplete, stop with exit 1 and run **plan-story** first.

## Procedure

### 1. Re-read the plan

1. Read `card.md` and [story.template.md](../../assets/story.template.md).
2. Read every document in **Spec References** that applies.
3. Read files listed in **Impact Analysis** → Scope.
4. Open related test files (`*_test.ts`) for patterns to follow.

### 2. Implement in task order

For each **Build Task** in order:

1. Implement the step in `src/` (or docs only if the task explicitly says so).
2. Match existing naming, types, error handling, and module boundaries
   (`docs/architecture.md`).
3. Prefer extending existing functions over new parallel implementations.
4. Mark the task `[x]` in `card.md` immediately when done.
5. Append to **Build Notes**: what changed, file paths, and any deviation from
   Impact Analysis. Remove the `_To be completed in building._` placeholder line
   once real notes exist.

### 3. Tests

- Add or update `deno test` coverage as specified in **Test Scenarios**
  (automated rows).
- Run `deno test` from repository root before marking test-related build tasks
  complete.
- If a test fails, fix implementation or update **Notes** with a blocker—do not
  mark tasks complete falsely.

### 4. CLI and output contracts

When touching CLI output:

- Human-oriented diagnostics → stderr, ANSI only when TTY (req §16.2,
  `src/services/console.ts`).
- Machine-parseable commands → stdout without ANSI (req §16.4).
- Read ADR-0011 and requirements §16 before changing log helpers.

### 5. Spec and README changes during build

- **Default:** defer edits to `docs/devflow-requirements.md`,
  `docs/architecture.md`, and ADRs to **finish-story** unless the user has
  approved spec changes.
- If an AC requires doc updates and user approval exists, make minimal aligned
  edits and set **Spec Updates** status to `done` for those rows.
- Update `README.md` when CLI surface or usage visible to users changes.

### 6. Do not check acceptance criteria yet

Leave **Acceptance Criteria** as `[ ]`—**validate-story** verifies and checks
them.

### 7. Notes and blockers

- Record surprises, debt, and follow-ups in **Notes**.
- If blocked, document in **Notes**; do not advance phase. User may
  `devflow card block`.

### 8. Validation before exit

| Check       | Requirement                                                |
| ----------- | ---------------------------------------------------------- |
| Build Tasks | All `[x]`                                                  |
| Build Notes | Summarizes as-built work                                   |
| `deno test` | Passes (full suite unless Impact Analysis scopes a subset) |
| Code        | Matches objectives and Impact Analysis                     |
| Scope       | No drive-by refactors unrelated to the story               |

Exit 0 only when implementation is ready for verification.

## Quality gate (exit building)

- [ ] Every Build Task is `[x]`, or left `[ ]` only when blocked on user/spec
      approval (immutable docs) and documented in **Build Notes**
- [ ] Build Notes describe what was built and any deviations
- [ ] `deno test` passes
- [ ] No unrelated files changed
- [ ] Acceptance criteria still unchecked (verification owns them)
- [ ] Spec Updates statuses are `pending` or `done`—not left blank
- [ ] Immutable spec docs unchanged without explicit user approval

## pi invocation

Invoked by `building/steps/01-pi.sh` inside the **building** loop (`board.json`
`phaseScripts.building.loop`) when leaving **building**:

```bash
pi --skill .devflow/boards/stories/skills/build-story \
  --model "${DEVFLOW_MEDIUM_MODEL}" --print \
  "Using the skill build-story, implement <card-id>."
```

Set `DEVFLOW_SKIP_PI=1` to skip pi (runs quality gates only). Each loop round
runs `deno fmt` (same scope as `fmt:check`), then `deno task ci`, then automated
**Test Scenarios** from the card (with the same `deno test` permissions as
`deno.json`). `maxRounds` is set in
`board.json` (`phaseScripts.building.loop.maxRounds`, default 5). Non-zero exit
fails the transition.
