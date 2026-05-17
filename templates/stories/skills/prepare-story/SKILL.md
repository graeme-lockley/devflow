---
name: prepare-story
version: 1.5.0
description: >-
  Fills preparing-phase sections of card.md from StoryDetail and repo context.
  Use when exiting preparing, when StoryDetail is provided, or when card.md still
  has preparing placeholders.
outputs:
  - card.md with preparing sections complete per story.template.md
allowed-tools:
  - read
  - write
  - edit
  - bash
forbids:
  - git commit
  - git push
---

# Prepare Story

**Philosophy:** The card is the contract. Preparing captures **user intent** and
**repo truth** — not the implementation plan. Leave planning and building
placeholders untouched.

Shared rules: [_shared/harness.md](../_shared/harness.md).

## Inputs

| Input           | Required | Notes                                |
| --------------- | -------- | ------------------------------------ |
| **Card ID**     | yes      | e.g. `stories-000001`                |
| **StoryDetail** | yes      | Goal prose (prompt, ticket, or user) |

## Procedure

1. **Resolve** — `state.json` and `card.md` must exist; read `title` from
   `state.json`.
2. **Context** — `README.md`; skim `docs/devflow-requirements.md` and
   `docs/architecture.md`; search `src/` for modules, commands, and tests
   related to StoryDetail.
3. **Idempotent** — If preparing content already satisfies the
   [Sections](#sections) table, make no edits and exit **0**.
4. **Write `card.md`** — Start from
   [story.template.md](../../assets/story.template.md). Fill preparing sections
   only. Preserve good user edits unless StoryDetail overrides. Leave
   `_To be completed in planning._` and `_To be completed in building._`
   untouched.

## Sections

| Section                 | Content                                                  |
| ----------------------- | -------------------------------------------------------- |
| `# {title}`             | Matches `state.json` `title`                             |
| Lead paragraph          | User story: "As a … I want … so that …"                  |
| **Current State**       | Factual as-is; cite paths (`src/…`, `docs/…`); ≥40 chars |
| **Objectives**          | 3–10 numbered outcomes; ≥40 chars                        |
| **Spec References**     | ≥1 unchecked item `- [ ] <path> — <section>`             |
| **Acceptance Criteria** | 3–10 lines `N. [ ]`, testable, traced to objectives      |
| **Related Cards**       | Links or `_None._`                                       |
| **Notes**               | Open questions, assumptions                              |

All criteria and references stay unchecked at this phase. Prefer automated
checks for code changes; do not duplicate planning detail.

## Examples

**Current State — thin (avoid):**

```markdown
The CLI needs work.
```

**Current State — good:**

```markdown
`./devflow card advance` exists in `src/cli/commands/card/advance.ts` but does
not run exit scripts yet (`docs/devflow-requirements.md` §11). No board
templates under `templates/stories/`.
```

## Anti-patterns

| DO NOT                                                | DO INSTEAD                      |
| ----------------------------------------------------- | ------------------------------- |
| Write Impact Analysis, Test Scenarios, or Build Tasks | Leave for **plan-story**        |
| Check `[x]` on ACs or Spec References                 | Unchecked drafts only           |
| Paste implementation steps into Objectives            | Outcomes the user can verify    |
| `find` / search for the card by id                    | Open `DEVFLOW_CARD_MD` directly |
| Modify `state.json` or run `git commit`               | Harness owns these              |

## Before exiting

- [ ] Title matches `state.json`
- [ ] Current State cites real paths; Objectives are outcomes not tasks
- [ ] Spec References and ACs are unchecked and trace to Objectives
- [ ] Planning/building placeholders still present where required

## Out of scope

- `state.json` — owned by Devflow
- Impact Analysis, Test Scenarios, Build Tasks, Spec Updates — **plan-story**
- Build Notes — **build-story**
- Implementation, tests, doc edits, commits
