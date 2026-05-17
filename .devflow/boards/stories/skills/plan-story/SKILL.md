---
name: plan-story
version: 1.2.0
description: >-
  Fills planning-phase sections of card.md (impact, tests, build tasks, spec
  updates) from repo context. Use when exiting planning or when planning
  placeholders remain in card.md.
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

**Philosophy:** Planning makes **Acceptance Criteria**, **Test Scenarios**,
**Build Tasks**, and **Spec Updates** mutually consistent. Change one row →
reconcile the others.

Shared rules: [_shared/harness.md](../_shared/harness.md).

## Inputs

| Input       | Required | Notes                 |
| ----------- | -------- | --------------------- |
| **Card ID** | yes      | e.g. `stories-000001` |

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

## Examples

**Acceptance Criterion — bad (duplicates a test step):**

```markdown
3. [ ] Run `deno task test src/foo_test.ts` and see all tests pass.
```

**Acceptance Criterion — good (observable outcome):**

```markdown
3. [ ] `deno task test src/foo_test.ts` passes; new behaviour is covered by at
   least one automated scenario in Test Scenarios.
```

**Test Scenario row — good:**

```markdown
| 1 | automated | `deno task test src/cli/commands/card/advance_test.ts` | All tests pass |
```

## Anti-patterns

| DO NOT | DO INSTEAD |
| ------ | ---------- |
| Mark ACs `[x]` | Leave unchecked for **validate-story** |
| Implement code or edit tests | **build-story** |
| Edit immutable docs without Spec Updates + Notes | `pending` + `requires user approval` |
| AC that only restates a command from Test Scenarios | AC = outcome; scenario = how |

## Before exiting

- [ ] Every AC maps to ≥1 test scenario or explicit manual check
- [ ] Every Build Task traces to Impact Analysis Scope
- [ ] Spec Updates rows exist for every doc AC or plan mentions
- [ ] All ACs and new tasks remain `[ ]`

## Out of scope

- Implementation code, test code — **build-story**
- Marking Acceptance Criteria `[x]` — **validate-story**
- Doc finalization — **finish-story**
- `state.json`, commits, phase advance — Devflow
