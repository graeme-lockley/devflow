---
name: build-story
version: 1.1.0
description: >-
  Implement a Devflow story card during building — execute Build Tasks, write
  code and tests, update Build Notes.
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

Implement the plan in `card.md`: write code, write tests, check off **Build
Tasks**, and maintain **Build Notes**.

**Template:** [story.template.md](../../assets/story.template.md).

**Harness contract:** Devflow owns phase transitions, locks, history, exit-script
gates, commits, and the build loop (`deno fmt`, `deno task ci`, automated
**Test Scenarios** run between rounds). You only read the card, write
code/tests, and update `card.md`.

## Inputs

| Input       | Required | Notes                 |
| ----------- | -------- | --------------------- |
| **Card ID** | yes      | e.g. `stories-000001` |

## Environment

| Variable            | Use                            |
| ------------------- | ------------------------------ |
| `DEVFLOW_CARD_ID`   | Card identifier                |
| `DEVFLOW_CARD_DIR`  | Absolute path to card folder   |
| `DEVFLOW_REPO_ROOT` | Git root (cwd for code, tests) |

## Procedure

1. **Re-read the plan** — `card.md`: Spec References, Impact Analysis, Test
   Scenarios, Build Tasks. Open every doc, file, and test cited.
2. **Implement in task order** — for each `[ ]` Build Task:
   1. Match existing naming, types, error handling, and module boundaries
      (`docs/architecture.md`).
   2. Prefer extending existing functions over parallel implementations.
   3. Add or update tests as listed in **Test Scenarios**.
   4. Mark the task `[x]` and append a one-line entry to **Build Notes** with
      file paths and any deviation from Impact Analysis.
3. **CLI output (when relevant)** — diagnostics → stderr, ANSI only on TTY
   (req §16.2); machine-parseable stdout has no ANSI (req §16.4); read
   ADR-0011 before changing log helpers.
4. **Tests pass** — run `deno task test` from repo root; do not mark a test-related
   task `[x]` until it passes.
5. **Stop when** all Build Tasks are `[x]` and **Build Notes** describe the
   as-built work. Leave **Acceptance Criteria** unchecked.

If blocked, document in **Notes** and stop; the operator decides next steps.

## Build Notes

Required content by exit:

- Summary of shipped behaviour
- Key files changed
- Deviations from Impact Analysis (if any)
- Follow-ups deferred to later cards (link via **Related Cards**)

Remove `_To be completed in building._` once real notes exist.

## Immutable docs

Default: defer edits to `docs/devflow-requirements.md`,
`docs/architecture.md`, and `docs/adr/*` to **finish-story**. Update
`README.md` only when CLI surface changes and an AC explicitly asks for it;
otherwise leave docs to finishing.

## Out of scope

- Marking Acceptance Criteria `[x]` — owned by **validate-story**
- Spec Updates close-out — owned by **finish-story**
- Drive-by refactors unrelated to the story
- Running the build loop yourself (`deno fmt`, `deno task ci`, automated
  scenarios) — the harness loop runs these between rounds
- `state.json`, commits, phase advance — owned by Devflow
