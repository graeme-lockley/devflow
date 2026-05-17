---
name: finish-story
version: 1.2.0
description: >-
  Complete the finishing phase of a story card — close Spec Updates, finalize
  Build Notes, add Finished marker.
outputs:
  - Completed Spec Updates table and finalized Build Notes
  - "### Finished subsection under Notes"
  - Repository docs and README aligned with delivered behaviour
allowed-tools:
  - read
  - write
  - edit
  - bash
forbids:
  - git commit
  - git push
---

# Finish Story

Close documentation loops, finalize **Build Notes**, and add the **Finished**
marker so the card can move to `done`.

**Template:** [story.template.md](../../assets/story.template.md).

**Harness contract:** Devflow owns phase transitions, locks, history, exit-script
gates, and commits. Verification has already passed. You only edit `card.md`,
`README.md`, and (with explicit approval) immutable docs. Do not re-run the
full test suite unless your edits could affect behaviour.

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

## card.md section map (do not mix)

| `##` section     | Belongs here                                                                                                                  |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Notes**        | Planning decisions, blockers, **`### Verification summary`** (from validate-story), **`### Finished`** (this skill)           |
| **Build Notes**  | As-built implementation log, file lists, deviations — **never** `### Finished` or `### Verification summary`                  |
| **Spec Updates** | Table only; close statuses here                                                                                               |

`### Finished (YYYY-MM-DD)` is a **sibling of `### Verification summary`** under
`## Notes` — typically immediately after it, always above `## Build Notes`.

## Procedure

1. **Reconcile** — read `card.md`, **Build Notes**, and the **Verification
   summary**; run `git status` / `git diff` from `DEVFLOW_REPO_ROOT` to see
   what will ship.
2. **Close Spec Updates** — for each row:

| Planned                    | Action                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------- |
| `none` / N/A               | Set status `n/a`                                                                      |
| `pending`, doc edit clear  | Apply the change; set status `done`; add a one-line pointer to **Build Notes**        |
| Pending but blocked        | Set status `deferred` with reason in **Notes**, or `blocked` if user approval missing |

3. **Immutable docs** — `docs/devflow-requirements.md`,
   `docs/architecture.md`, `docs/adr/*` change **only** when **Spec Updates**
   planned the change and user approval is recorded; otherwise set status
   `n/a` with a one-line note that behaviour matches existing spec.
4. **README** — update when CLI commands, flags, output contracts, or setup
   instructions changed; match existing table style.
5. **Finalize Build Notes** — summary of shipped behaviour, key files changed,
   deviations from Impact Analysis, and deferred follow-ups (link in
   **Related Cards**). Remove `_To be completed in building._` if still
   present.
6. **Add Finished marker** under `## Notes`:

```markdown
### Finished (YYYY-MM-DD)

Story complete. Spec updates: <summary>. Ready for done.
```

7. **Sanity** — run `deno task test` and `./devflow validate-card <card-id>` only
   when this hop touched docs or `src/`.

## Out of scope

- Re-running full verification (already done in **validate-story**)
- Adding `### Finished` under **Build Notes** (wrong section — exit gate reads
  only the **Notes** body)
- New product features or refactors
- `state.json`, commits, phase advance — owned by Devflow
