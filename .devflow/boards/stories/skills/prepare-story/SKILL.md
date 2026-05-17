---
name: prepare-story
version: 1.4.0
description: >-
  Fill preparing-phase sections of a story card.md from StoryDetail and repo
  context.
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

Populate the **preparing** sections of `card.md` for one story card.

**Template:** [story.template.md](../../assets/story.template.md) — keep every
`##` heading and `<!-- phase-gate -->` comment.

**Harness contract:** Devflow owns phase transitions, locks, history, exit-script
gates, and commits. You only read context and write `card.md`. Do not run
`git commit`, `devflow card advance`, or modify `state.json`.

## Inputs

| Input           | Required | Notes                                |
| --------------- | -------- | ------------------------------------ |
| **Card ID**     | yes      | e.g. `stories-000001`                |
| **StoryDetail** | yes      | Goal prose (prompt, ticket, or user) |

## Environment

| Variable            | Use                          |
| ------------------- | ---------------------------- |
| `DEVFLOW_CARD_ID`   | Card identifier              |
| `DEVFLOW_CARD_DIR`  | Absolute path to card folder |
| `DEVFLOW_REPO_ROOT` | Git root                     |

Manual run: `./devflow card dir <card-id>` → card directory.

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
   placeholders untouched.

Read `state.json`; never modify it.

## Sections

| Section                 | Content                                                            |
| ----------------------- | ------------------------------------------------------------------ |
| `# {title}`             | Matches `state.json` `title`                                       |
| Lead paragraph          | User story: "As a … I want … so that …"                            |
| **Current State**       | Factual as-is; cite paths (`src/…`, `docs/…`); ≥40 chars            |
| **Objectives**          | 3–10 numbered outcomes; ≥40 chars                                  |
| **Spec References**     | ≥1 unchecked item `- [ ] <path> — <section>`                       |
| **Acceptance Criteria** | 3–10 lines `N. [ ]`, testable, traced to objectives                |
| **Related Cards**       | Links or `_None._`                                                 |
| **Notes**               | Open questions, assumptions                                        |

All criteria and references stay unchecked at this phase. Prefer automated
checks for code changes; do not duplicate planning detail.

## Out of scope

- `state.json` (phase, history, variables) — owned by Devflow
- Impact Analysis, Test Scenarios, Build Tasks, Spec Updates — owned by **plan-story**
- Build Notes — owned by **build-story**
- Implementation, tests, doc edits, commits, `git push`
