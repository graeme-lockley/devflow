---
name: plan-story
version: 1.1.0
description: >-
  Fill planning-phase sections of a story card.md (Spec References,
  Acceptance Criteria, Impact Analysis, Test Scenarios, Build Tasks, Spec
  Updates) from repo context.
outputs:
  - card.md with planning-phase sections complete per story.template.md
allowed-tools:
  - read
  - write
  - edit
  - bash
forbids:
  - git commit
  - git push
---

# Plan Story

Turn a prepared story card into an implementable plan.

**Template:** [story.template.md](../../assets/story.template.md) — keep every
`##` heading and `<!-- phase-gate -->` comment.

**Harness contract:** Devflow owns phase transitions, locks, history, exit-script
gates, and commits. You only read context and edit `card.md`. Do not implement
code, mark Acceptance Criteria `[x]`, or modify `state.json`.

## Inputs

| Input       | Required | Notes                 |
| ----------- | -------- | --------------------- |
| **Card ID** | yes      | e.g. `stories-000001` |

## Environment

| Variable            | Use                          |
| ------------------- | ---------------------------- |
| `DEVFLOW_CARD_ID`   | Card identifier              |
| `DEVFLOW_CARD_DIR`  | Absolute path to card folder |
| `DEVFLOW_REPO_ROOT` | Git root                     |

Manual run: `./devflow card dir <card-id>` → card directory.

## Procedure

1. **Read** — `card.md`, `state.json`,
   [story.template.md](../../assets/story.template.md), `README.md`, the
   relevant `docs/devflow-requirements.md` and `docs/architecture.md` sections,
   and any ADRs implied by the objectives.
2. **Search** — `src/` for modules, commands, and tests related to the
   objectives.
3. **Fill sections** below in any order, then sanity-check that
   ACs ↔ Test Scenarios ↔ Build Tasks ↔ Spec Updates are mutually consistent.

Preserve preparing content (Description, Current State, Objectives) unless
factually wrong; if you change them, explain why in **Notes**.

## Sections

| Section                 | Requirement                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Spec References**     | All draft items resolved; mark verified items `[x]`. If no spec applies, **N/A** with reason in **Notes**.               |
| **Acceptance Criteria** | 3–7 measurable `N. [ ]` items; do not duplicate test steps; ≥1 covers automated tests when code changes.                 |
| **Impact Analysis**     | `### Scope` (≥20 chars) and `### Risks and constraints` (≥20 chars).                                                     |
| **Test Scenarios**      | Numbered table rows; ≥1 type `automated`; use `deno task test` (full suite) or `deno task test <path>` (one file); each row runnable as written. |
| **Build Tasks**         | Ordered `N. [ ]` steps mapping to Impact Analysis Scope; smallest sensible increments.                                   |
| **Spec Updates**        | One row per doc that will change, or `none` with status `n/a`. Status `pending` for planned edits.                       |
| **Notes**               | Design decisions, alternatives rejected, open questions, dependencies on other cards.                                    |
| **Related Cards**       | Update if new links discovered.                                                                                          |

Acceptance Criteria that mention docs ↔ Spec Updates rows that plan those
edits.

## Immutable docs

`docs/devflow-requirements.md`, `docs/architecture.md`, and `docs/adr/*` change
only with explicit user approval (AGENTS.md). Plan such edits in **Spec
Updates** with status `pending` and add `requires user approval` in **Notes**;
do not edit those files now.

## Out of scope

- Implementation code, test code — owned by **build-story**
- Marking Acceptance Criteria `[x]` — owned by **validate-story**
- Doc finalization — owned by **finish-story**
- `state.json`, commits, phase advance — owned by Devflow
