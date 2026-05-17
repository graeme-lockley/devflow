---
name: validate-story
version: 1.2.0
description: >-
  Verify a Devflow story card during verifying — run Test Scenarios, mark
  Acceptance Criteria, record evidence and verification summary.
outputs:
  - Executed Test Scenarios with recorded results
  - Acceptance Criteria checkboxes updated to [x] or documented waivers
  - "### Verification summary under Notes"
allowed-tools:
  - read
  - write
  - edit
  - bash
forbids:
  - git commit
  - git push
---

# Validate Story

Run every **Test Scenario**, confirm each **Acceptance Criterion**, and record
evidence in `card.md`.

**Template:** [story.template.md](../../assets/story.template.md).

**Harness contract:** Devflow owns phase transitions, locks, history, exit-script
gates, and commits. You only run scenarios, edit `card.md`, and may make
**small in-scope fixes** for failing tests. Larger gaps require the operator
to send the card back to **building** with `devflow card advance`.

## Inputs

| Input       | Required | Notes                 |
| ----------- | -------- | --------------------- |
| **Card ID** | yes      | e.g. `stories-000001` |

## Environment

| Variable            | Use                          |
| ------------------- | ---------------------------- |
| `DEVFLOW_CARD_ID`   | Card identifier              |
| `DEVFLOW_CARD_DIR`  | Absolute path to card folder |
| `DEVFLOW_REPO_ROOT` | Git root (cwd for tests)     |

## Procedure

1. **Build the matrix** — from `card.md`: every Test Scenario row, every `[ ]`
   Acceptance Criterion, plus any Risks from **Impact Analysis** that need
   manual checks.
2. **Run automated scenarios** — execute the exact commands listed; record
   `pass` / `fail` (with a short output excerpt on failure). On failure,
   attempt a minimal in-scope fix and re-run; if still failing, document in
   **Notes** and exit 1.
3. **Run manual scenarios** — execute the steps; record observed vs expected;
   attach evidence with `devflow card add-file <card-id> <path>` and reference
   it under **Attachments**.
4. **Check ACs** — for each `[ ]`: if satisfied, change to `[x]`; otherwise
   leave unchecked and add gap analysis to **Notes**.
   - **Waiver:** mark `[x] _(waived: <reason>)_` only when the operator
     explicitly approved.
5. **Repository checks (when story affects layout or invariants)** —
   `deno task test`, `./devflow validate-card <card-id>`, `./devflow validate`.
   Failures → fix or exit 1.
6. **Verification summary** — add this subsection under **`## Notes`** (never
   under **Build Notes**):

```markdown
### Verification summary (YYYY-MM-DD)

- Test scenarios: N/M pass
- Acceptance criteria: N/M checked
- Commands: deno task test (pass), devflow validate-card (pass)
```

## Out of scope

- Spec Updates close-out — owned by **finish-story** (unless an AC explicitly
  required docs during build and they were already updated)
- README finalization — owned by **finish-story**
- Marking Build Tasks — owned by **build-story**
- Large refactors or new features — send the card back to **building**
- `state.json`, commits, phase advance — owned by Devflow
