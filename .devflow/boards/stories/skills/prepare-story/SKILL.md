---
name: prepare-story
version: 1.2.0
description: >-
  Prepares a Devflow story card in the preparing phase using the canonical story
  template: description, objectives, draft acceptance criteria, and spec references.
  Use when a new card needs content or when advancing out of preparing.
outputs:
  - Updated card.md with preparing-phase sections per story template
allowed-tools:
  - read
  - write
  - edit
  - bash
forbids:
  - git push
---

# Prepare a Story

Populates **preparing** content for a story card from a short description and
full repository context (`README.md`, `docs/`, `src/`). Uses the canonical
[story template](../../assets/story.template.md).

This skill does **not** produce Impact Analysis, Build Tasks, or
implementation—use **plan-story**, **build-story**, **validate-story**, and
**finish-story** for later phases.

## When this skill runs

| Trigger           | Context                                           |
| ----------------- | ------------------------------------------------- |
| Manual / agent    | New card or card in `preparing` needs `card.md`   |
| Board exit script | Leaving **preparing** → **planning** (when wired) |

Phases: `preparing` → `planning` → `building` → `verifying` → `finishing` →
`done`.

## Canonical template

**[`.devflow/boards/stories/assets/story.template.md`](../../assets/story.template.md)**

Populate only sections whose gates allow **preparing** or **exit preparing**.
Leave later-phase sections in place with template placeholders where the skill
does not have enough input yet.

## Inputs

- **Card ID** (required): e.g. `stories-000001`
- **StoryDetail** (required): What the story should achieve (prose from user or
  ticket)

## Procedure

### 1. Locate the card

```bash
./devflow card dir <card-id>
```

- Directory must exist; else exit 1.
- `state.json` must exist; else exit 1.
- Read `title` from `state.json` and any existing `card.md`.

### 2. Gather context

- Read `README.md`, skim `docs/devflow-requirements.md` and
  `docs/architecture.md` for areas related to StoryDetail.
- Search `src/` for relevant commands, modules, and tests.
- Read existing `card.md` if present—preserve user edits unless StoryDetail
  overrides.

### 3. Populate preparing sections

Substitute or write content following the template structure:

| Section                 | Content                                                              |
| ----------------------- | -------------------------------------------------------------------- |
| `{title}`               | From `state.json` `title`                                            |
| `{description}`         | Beneficiary perspective: “As a … I want … so that …”                 |
| `{current_state}`       | Factual as-is behaviour with file paths                              |
| `{objectives}`          | Numbered list of outcomes (3–5)                                      |
| `{acceptance_criteria}` | Numbered `[ ]` items, measurable; reference tests/docs at high level |
| **Spec References**     | Draft bullets with best-guess doc paths/sections                     |
| **Related Cards**       | Links or `_None._`                                                   |
| **Notes**               | Open questions from analysis                                         |

**Leave for later skills** (keep template headings and placeholder guidance):

- Impact Analysis → _To be completed in planning._
- Test Scenarios → table header only or one stub row
- Build Tasks → _To be completed in planning._
- Spec Updates → table with `pending` / `none` as appropriate
- Build Notes → _To be completed in building._
- Attachments → template placeholder

### 4. Acceptance criteria rules

Generate 3–10 criteria that:

- Trace to objectives
- Include `deno test` when code changes are expected
- Mention `README.md` / `docs/` only when contracts change—details go in **Spec
  Updates** at planning time
- Stay `[ ]` unchecked

### 5. Write card.md

Write the full file so all template **headings** exist (mechanical scripts and
later skills depend on structure). Do not omit sections.

### 6. Validation

- Title line matches `state.json`
- Preparing sections have real content (no lorem ipsum)
- Acceptance criteria are testable
- Spec References has at least one bullet or explicit N/A in Notes
- Exit 0 on success

## Quality gate (exit preparing)

- [ ] Card ID valid; `card.md` and `state.json` exist
- [ ] All template section headings present per
      [story.template.md](../../assets/story.template.md)
- [ ] Objectives and acceptance criteria align
- [ ] No merge conflict markers in `card.md`
- [ ] Planning-phase sections not falsely marked complete

## pi invocation

```bash
pi --skill .devflow/boards/stories/skills/prepare-story \
  --model "${DEVFLOW_HEAVY_MODEL}" --print \
  "Using the skill prepare-story, please prepare the story <card-id>."
```

`preparing-002-do-create-story` requires `pi` on `PATH` (exit 1 if missing). Set
`DEVFLOW_SKIP_PI=1` only for CI or local testing without pi.
