---
name: plan-story
version: 1.0.0
description: >-
  Completes the planning phase of a Devflow story card by filling Impact Analysis,
  Test Scenarios, Build Tasks, and Spec Updates from repo context and card.md.
  Use when advancing a card out of planning or when invoked by board exit scripts
  via pi-mono.
outputs:
  - Updated card.md with planning-phase sections complete per story template
allowed-tools:
  - read
  - write
  - edit
  - bash
forbids:
  - git push
---

# Plan a Story

Completes **planning** for a story card. The agent reads the card, the canonical
[story template](../../assets/story.template.md), and the repository
(`README.md`, `docs/`, `src/`), then updates `card.md` so the card can advance
to **building**.

This skill does **not** implement code. It produces an implementable plan
aligned with Devflow requirements and architecture.

## When this skill runs

| Trigger           | Context                                                                           |
| ----------------- | --------------------------------------------------------------------------------- |
| Board exit script | Leaving **planning** → **building** (e.g. `planning-003-do-planning` via pi-mono) |
| Manual            | Agent asked to plan card `stories-NNNNNN` while phase is `planning`               |

Phases on the stories board: `preparing` → `planning` → `building` → `verifying`
→ `finishing` → `done`.

## Canonical template

All story cards follow:

**[`.devflow/boards/stories/assets/story.template.md`](../../assets/story.template.md)**

Respect every `<!-- phase-gate: … -->` comment. This skill must satisfy gates
marked **planning** or **exit planning**.

## Environment (transition scripts)

When invoked from a board script, these variables are set (req §18):

| Variable                                  | Use                                    |
| ----------------------------------------- | -------------------------------------- |
| `DEVFLOW_CARD_ID`                         | Card identifier                        |
| `DEVFLOW_CARD_DIR`                        | Absolute path to card directory        |
| `DEVFLOW_BOARD` / `DEVFLOW_BOARD_DIR`     | Board name and path                    |
| `DEVFLOW_REPO_ROOT`                       | Git repository root (cwd for commands) |
| `DEVFLOW_FROM_PHASE` / `DEVFLOW_TO_PHASE` | Current hop (`planning` → `building`)  |
| `DEVFLOW_RUN_DIR`                         | Transition log directory for this hop  |

Resolve the card directory when manual:

```bash
./devflow card dir <card-id>
```

Use `devflow card add-file` and `devflow variable set` with `--ignore-lock` only
when called from inside a transition lock.

## Inputs

- **Card ID** (required): e.g. `stories-000001`
- **Board** (optional): defaults to `stories`; infer from card ID prefix when
  possible

## Preconditions

Before writing:

1. `state.json` exists and `phase` is `planning` (or you are explicitly
   re-planning with user approval).
2. `card.md` exists and includes completed **preparing** sections:
   - Title (`# …`), Description, Current State, Objectives
   - Draft **Acceptance Criteria** and **Spec References** (may be incomplete)
3. Read `state.json` for `title` and confirm it matches the `#` heading in
   `card.md`.

If preparing sections are missing or placeholder-only, stop with exit 1 and
report that **create-story** must run first.

## Procedure

### 1. Load context

1. Read `card.md`, `state.json`, and
   [story.template.md](../../assets/story.template.md).
2. Read `README.md`, relevant sections of `docs/devflow-requirements.md`,
   `docs/architecture.md`, and any ADRs referenced or implied by the objectives.
3. Search `src/` for modules, commands, and tests related to the story (use
   objectives and current state as queries).

### 2. Complete Spec References

- Replace draft bullets with concrete paths and section anchors (e.g.
  `docs/devflow-requirements.md` §16.2).
- Mark each list item `[x]` when verified against the repo.
- If no spec applies (pure chore), state **N/A** with one-line justification in
  **Notes**.

### 3. Finalize Acceptance Criteria

- Refine preparing drafts into 3–7 **measurable** outcomes.
- Each item: `[ ]` checkbox, observable behaviour, no vague “improve” without a
  check.
- **Do not** duplicate full test steps here—reference **Test Scenarios**
  instead.
- Include at least one criterion for automated tests (`deno test`) when code
  changes.
- Include doc/README criteria only when behaviour or CLI contracts change; track
  detail in **Spec Updates**.

### 4. Write Impact Analysis

Populate **Impact Analysis** with:

- **Scope**: files, modules, CLI commands, stdout vs stderr, TTY behaviour.
- **Risks**: breaking changes, ADR constraints, machine-parseable output (req
  §16.4), lock/transition interaction.

### 5. Write Test Scenarios

Add a table with at least:

- One **automated** row (`deno test`, named test file, or CLI invocation with
  expected exit/output).
- One **manual** row for TTY or UX checks if applicable.

Each row must be runnable or executable by a reviewer without guessing.

### 6. Write Build Tasks

- Ordered checklist of implementation steps (smallest sensible increments).
- Each task `[ ]`; map 1:1 to scope in Impact Analysis where possible.
- Last tasks should be “run `deno test`” and “update docs listed in Spec
  Updates” when applicable.

### 7. Plan Spec Updates

Fill **Spec Updates** table:

- List each doc that will change, or `none` with status `n/a`.
- Set **Status** to `pending` for planned edits.
- **Do not** edit `docs/devflow-requirements.md`, `docs/architecture.md`, or
  ADRs unless the user has explicitly approved spec changes (AGENTS.md immutable
  docs rule). If changes are needed, plan them here and note “requires user
  approval” in **Notes**.

### 8. Add planning Notes

Use **Notes** for design decisions, alternatives rejected, open questions, and
dependencies on other cards. Update **Related Cards** if new links are
discovered.

### 9. Preserve preparing content

Do not rewrite Description, Current State, or Objectives unless factually wrong
after repo analysis; if you change them, explain why in **Notes**.

### 10. Validation

Confirm before finishing:

| Section             | Gate                                |
| ------------------- | ----------------------------------- |
| Spec References     | Complete (`[x]` or justified N/A)   |
| Acceptance Criteria | Complete, traceable to objectives   |
| Impact Analysis     | Scope + risks filled                |
| Test Scenarios      | ≥1 automated + relevant manual rows |
| Build Tasks         | Ordered, non-empty                  |
| Spec Updates        | Planned rows with status            |
| Notes               | Design decisions captured           |

Exit 0 only when all planning gates pass.

## Quality gate (exit planning)

- [ ] Card directory and `card.md` exist
- [ ] All template sections through **Spec Updates** are present (use template
      headings exactly)
- [ ] No preparing-phase section was left as `_placeholder_` text
- [ ] Acceptance criteria are testable without interpretation
- [ ] Build tasks cover every acceptance criterion
- [ ] Test scenarios cover every acceptance criterion
- [ ] Spec Updates align with ACs that mention documentation
- [ ] No implementation code was written in this step
- [ ] `card.md` has no merge conflict markers

## pi-mono invocation

```bash
pi-mono run --skill .devflow/boards/stories/skills/plan-story \
  --board stories --card <card-id>
```

Set `DEVFLOW_SKIP_PI=1` to skip in CI. Non-zero exit fails the transition.
