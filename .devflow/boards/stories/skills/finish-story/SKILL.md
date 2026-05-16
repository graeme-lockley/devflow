---
name: finish-story
version: 1.1.0
description: >-
  Completes the finishing phase of a Devflow story card by finalizing Spec Updates,
  README changes, Build Notes, and release readiness. Use when advancing out of
  finishing to done or when closing a verified story.
outputs:
  - Completed Spec Updates table and finalized Build Notes
  - Repository docs and README aligned with delivered behaviour
allowed-tools:
  - read
  - write
  - edit
  - bash
forbids:
  - git push
---

# Finish a Story

Executes **finishing** for a story card: close documentation loops, finalize
**Build Notes**, and confirm the repository matches the delivered work described
in [story.template.md](../../assets/story.template.md).

Verification is already done—this skill does **not** re-run the full test suite
unless a doc edit could affect behaviour or a Spec Update row requires it.

## When this skill runs

| Trigger           | Context                                               |
| ----------------- | ----------------------------------------------------- |
| Board exit script | Leaving **finishing** → **done**                      |
| Manual            | User requests story closure for a card in `finishing` |

## Canonical template

**[`.devflow/boards/stories/assets/story.template.md`](../../assets/story.template.md)**

Satisfy gates marked **finishing** or **exit finishing**.

## `card.md` section map (do not mix)

The [story template](../../assets/story.template.md) fixes **top-level `##`
headings and order**. Subsections belong only under the parent shown:

| `##` section      | Phase gates (template)              | What belongs here |
| ----------------- | ----------------------------------- | ----------------- |
| **Notes**         | optional; verify + finish subsections | Planning decisions, blockers, **`### Verification summary`** (from validate-story), **`### Finished`** (this skill) |
| **Build Notes**   | started building; complete finishing | As-built implementation log, file lists, deviations—**not** `### Finished` |
| **Spec Updates**  | planned planning; completed finishing | Table only; close statuses here |

**Critical:** `### Finished (YYYY-MM-DD)` must be added under **`## Notes`**, as a
sibling of `### Verification summary`—typically immediately after the
verification summary bullets and **before** any older planning-decision
subsections, or at the end of **`## Notes`** but still **above** `## Build Notes`.

Never place `### Finished` under **`## Build Notes`**. The exit script
`finishing-003-check-finishing-quality` reads only the **Notes** section body.

## Environment

On finishing → done: `DEVFLOW_FROM_PHASE=finishing`, `DEVFLOW_TO_PHASE=done`.

## Inputs

- **Card ID** (required): e.g. `stories-000001`

## Preconditions

1. `state.json` → `phase` is `finishing`.
2. All **Acceptance Criteria** are `[x]` (or waived with inline reason).
3. **Test Scenarios** were executed in **validate-story** (see Verification
   summary in **Notes**).

If verifying is incomplete, exit 1.

## Procedure

### 1. Reconcile delivered work with the card

1. Read `card.md`, **Build Notes**, and **Verification summary** in **Notes**.
2. `git diff` / `git status` from `DEVFLOW_REPO_ROOT`—understand what will ship
   in the transition commit.
3. Confirm **Build Tasks** remain all `[x]`.

### 2. Complete Spec Updates

For each row in **Spec Updates**:

| Planned                    | Action                                                                       |
| -------------------------- | ---------------------------------------------------------------------------- |
| `none` / N/A               | Set status `n/a`                                                             |
| `pending`                  | Apply the documented change, or mark `deferred` with reason in **Notes**     |
| Doc requires user approval | Do not edit; set status `blocked` and exit 1 unless approval is in **Notes** |

**Immutable docs** (`docs/devflow-requirements.md`, `docs/architecture.md`,
`docs/adr/*`):

- Edit only when **Spec Updates** planned a change **and** user approval is
  recorded.
- Otherwise set status `n/a` and explain in **Notes** that behaviour matches
  existing spec.

**Allowed without special approval:** `README.md`,
`docs/implementation-roadmap.md` checklist items when part of the agreed story.

After each edit:

- Set **Status** to `done` (or `n/a`).
- Add a one-line pointer in **Build Notes** (file + section).

### 3. Finalize Build Notes

Ensure **Build Notes** includes:

- Summary of shipped behaviour
- List of key files changed
- Deviations from Impact Analysis (if any)
- Known follow-ups deferred to future cards (link in **Related Cards**)

### 4. README and operator docs

Update `README.md` when:

- CLI commands, flags, or output contracts changed
- New commands or synonyms were added
- Setup or test instructions changed

Keep table style consistent with existing README CLI section.

### 5. Roadmap (optional)

If the story completes an item in `docs/implementation-roadmap.md`, mark `[x]`
only when the implementation truly matches the milestone description.

### 6. Card hygiene

- Remove stale `_placeholder_` or `_TBD_` text from any section (including
  `_To be completed in building._` under **Build Notes**).
- **Attachments**: list evidence files under `files/` with one-line
  descriptions.
- Add **`### Finished`** only under **`## Notes`** (not Build Notes):

```markdown
## Notes

### Verification summary (YYYY-MM-DD)
…existing verification content from validate-story…

### Finished (YYYY-MM-DD)

Story complete. Spec updates: <summary>. Ready for done.
```

Do **not** append `### Finished` after `### As-built summary` or
`### Spec Updates status` in **Build Notes**—those are the wrong section.

### 7. Final checks

```bash
deno test
./devflow validate-card <card-id>
```

Run only when Spec Updates touched docs or README; skip if purely cosmetic and
verification summary is recent.

Exit 0 when the card is archivable and docs match the repo.

## Quality gate (exit finishing)

Enforced by `finishing-003`, `finishing-004`, and `finishing-005` when this hop
changed docs (see [`scripts/README.md`](../scripts/README.md): no duplicate gates
from verifying or building).

- [ ] Every Spec Updates row has status `done`, `n/a`, or justified `deferred`
      in Notes
- [ ] Build Notes finalized (as-built + doc pointers)
- [ ] `### Finished` subsection in Notes
- [ ] README updated if user-facing CLI changed
- [ ] Immutable spec docs respected (AGENTS.md)
- [ ] Card.md sections match [story.template.md](../../assets/story.template.md)
      headings
- [ ] `deno test` passes only when this finishing hop changed docs or `src/`
      (`finishing-005`)

## pi-mono invocation

```bash
pi-mono run --skill .devflow/boards/stories/skills/finish-story \
  --board stories --card <card-id>
```

Non-zero exit fails the transition.

## After this skill

The board transition creates the **finishing → done** commit. The card remains
in the repo as a historical record; do not delete `card.md`.
