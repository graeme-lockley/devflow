---
name: finish-story
version: 1.3.0
description: >-
  Completes the finishing phase — closes Spec Updates, finalizes Build Notes,
  adds Finished marker under Notes. Use when exiting finishing after verification
  passed.
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

**Philosophy:** Verification is done; finishing **closes documentation loops**
and leaves a clear handoff. Put lifecycle markers in **Notes**; keep **Build
Notes** as the as-built log.

Shared rules: [_shared/harness.md](../_shared/harness.md).

## Read this first — `card.md` section map

| `##` section     | Belongs here                                                                                                                  |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Notes**        | Planning decisions, blockers, **`### Verification summary`**, **`### Finished`**                                            |
| **Build Notes**  | As-built implementation log, file lists, deviations — **never** `### Finished` or `### Verification summary`                  |
| **Spec Updates** | Table only; close statuses here                                                                                               |

`### Finished (YYYY-MM-DD)` is a **sibling of `### Verification summary`** under
`## Notes` — typically immediately after it, always above `## Build Notes`.

## Inputs

| Input       | Required | Notes                 |
| ----------- | -------- | --------------------- |
| **Card ID** | yes      | e.g. `stories-000001` |

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

3. **Immutable docs** — change **only** when **Spec Updates** planned the
   change and user approval is recorded; otherwise set status `n/a` with a
   one-line note that behaviour matches existing spec.
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

## Anti-patterns

| DO NOT | DO INSTEAD |
| ------ | ---------- |
| Add `### Finished` under **Build Notes** | Under **`## Notes`** (exit gate reads Notes only) |
| Re-run full verification | Trust **validate-story** unless your edits change behaviour |
| Edit immutable docs without approval + Spec Updates plan | `deferred` / `blocked` + reason in Notes |
| New features or refactors | Docs and close-out only |

## Before exiting

- [ ] **Verification summary** still under **Notes** (unchanged location)
- [ ] `### Finished (YYYY-MM-DD)` is a sibling under **Notes**, above **Build Notes**
- [ ] Spec Updates rows are `done`, `n/a`, `deferred`, or `blocked` — none left `pending` without reason
- [ ] Build Notes finalized; no preparing/building placeholders remain

## Out of scope

- Re-running full verification — **validate-story**
- New product features or refactors
- `state.json`, commits, phase advance — Devflow
