---
name: build-story
version: 1.4.0
description: >-
  Implements a story card during building — executes Build Tasks, writes code and
  tests, updates Build Notes. Use when exiting building or when Build Tasks
  remain unchecked.
outputs:
  - Production code and tests per Build Tasks
  - Updated card.md Build Tasks checkboxes and Build Notes
allowed-tools:
  - read
  - write
  - edit
  - bash
forbids:
  - git commit
  - git push
---

# Build Story

**Philosophy:** Ship the plan **one Build Task at a time** — minimal code,
passing tests, one honest line in **Build Notes**. The harness build loop runs
`deno fmt`, mechanical **lint-fix** (unused imports), `deno task ci`, and
automated scenarios between rounds; you focus on tasks and notes.

Shared rules: [_shared/harness.md](../_shared/harness.md).

## Template / dogfood board scope

When the card scopes `templates/stories/` sync, you may edit **both**:

- `templates/stories/**` (portable template shipped via JSR)
- `.devflow/boards/<board>/scripts/`, `skills/`, `assets/` (dogfood board)

`building-008` allows these paths when the card mentions them. Mirror
intentional changes into `templates/stories/` when the story requires it.

## Inputs

| Input       | Required | Notes                 |
| ----------- | -------- | --------------------- |
| **Card ID** | yes      | e.g. `stories-000001` |

## Procedure

1. **Re-read the plan** — `card.md`: Spec References, Impact Analysis, Test
   Scenarios, Build Tasks. Open every doc, file, and test cited.
2. **Retry rounds** — when the prompt includes
   `Previous build loop round
   failed`, treat that block as the primary task:
   fix every reported lint, test, or scenario failure before new Build Tasks.
   Cite the failing file and rule in **Build Notes** (e.g. removed unused import
   in `src/…`).
3. **Implement in task order** — for each `[ ]` Build Task:
   1. Match existing naming, types, error handling, and module boundaries
      (`docs/architecture.md`).
   2. Prefer extending existing functions over parallel implementations.
   3. Add or update tests as listed in **Test Scenarios**.
   4. Mark the task `[x]` and append a **one-line** entry to **Build Notes**
      with file paths and any deviation from Impact Analysis.
4. **CLI output (when relevant)** — diagnostics → stderr, ANSI only on TTY (req
   §16.2); machine-parseable stdout has no ANSI (req §16.4); read ADR-0011
   before changing log helpers.
5. **Tests pass** — run `deno task test` from repo root; do not mark a
   test-related task `[x]` until it passes.
6. **Stop when** all Build Tasks are `[x]` and **Build Notes** describe the
   as-built work. Leave **Acceptance Criteria** unchecked.

If blocked, document in **Notes** and stop; the operator decides next steps.

```
Per task:  implement → test → [x] task → one Build Notes line
Harness:   deno fmt → lint-fix → deno task ci → scenarios (between rounds)
Retry:     prompt includes prior-round gate logs when round > 1
```

## Build Notes

Required content by exit:

- Summary of shipped behaviour
- Key files changed
- Deviations from Impact Analysis (if any)
- Follow-ups deferred to later cards (link via **Related Cards**)

Remove `_To be completed in building._` once real notes exist.

## Examples

**Build Notes line — vague (avoid):**

```markdown
- Implemented the feature.
```

**Build Notes line — good:**

```markdown
- Task 2: `src/cli/commands/card/advance.ts` — invoke exit scripts; tests in
  `advance_test.ts`.
```

## Anti-patterns

| DO NOT                                   | DO INSTEAD                        |
| ---------------------------------------- | --------------------------------- |
| Mark ACs `[x]`                           | **validate-story**                |
| Close Spec Updates or add `### Finished` | **finish-story**                  |
| Drive-by refactors outside Build Tasks   | Stay on plan                      |
| Run the full harness loop yourself       | Script runs fmt/ci between rounds |
| Vague Build Notes                        | One line per task with paths      |

Default: defer edits to immutable docs to **finish-story**. Update `README.md`
only when CLI surface changes and an AC explicitly asks for it.

## Before exiting

- [ ] Every Build Task is `[x]`
- [ ] Build Notes summarize behaviour, files, deviations, deferrals
- [ ] All Acceptance Criteria still `[ ]`
- [ ] `_To be completed in building._` removed

## Out of scope

- Marking Acceptance Criteria `[x]` — **validate-story**
- Spec Updates close-out — **finish-story**
- `state.json`, commits, phase advance — Devflow
