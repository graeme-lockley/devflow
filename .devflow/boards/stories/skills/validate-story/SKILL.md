---
name: validate-story
version: 1.3.0
description: >-
  Verifies a story card during verifying — runs Test Scenarios, marks Acceptance
  Criteria, records evidence and verification summary. Use when exiting
  verifying or when scenarios lack pass/fail results.
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

**Philosophy:** Evidence beats assertion. Run what the plan says, record
**pass/fail**, check only ACs you can defend. Small in-scope fixes are allowed;
large gaps mean send the card back to **building**.

Shared rules: [_shared/harness.md](../_shared/harness.md).

## Inputs

| Input       | Required | Notes                 |
| ----------- | -------- | --------------------- |
| **Card ID** | yes      | e.g. `stories-000001` |

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
6. **Verification summary** — add under **`## Notes`** (never **Build Notes**):

```markdown
### Verification summary (YYYY-MM-DD)

- Test scenarios: N/M pass
- Acceptance criteria: N/M checked
- Commands: deno task test (pass), devflow validate-card (pass)
```

Do not proceed to exit until the summary exists in the right section.

## Anti-patterns

| DO NOT | DO INSTEAD |
| ------ | ---------- |
| Put `### Verification summary` under **Build Notes** | Under **`## Notes`** only |
| Mark AC `[x]` without evidence | Run scenario or document waiver |
| Large refactors or new features | Exit 1; operator returns to **building** |
| Close Spec Updates / finalize README | **finish-story** |
| Waive without operator approval | Leave `[ ]` and note gap |

## Before exiting

- [ ] Every Test Scenario row has `pass` or `fail` (and excerpt on fail)
- [ ] Every satisfied AC is `[x]` or `_(waived: …)_` with approval
- [ ] `### Verification summary (YYYY-MM-DD)` is under **`## Notes`**
- [ ] `deno task test` / `validate-card` run when layout or invariants changed

## Out of scope

- Spec Updates close-out — **finish-story**
- README finalization — **finish-story**
- Marking Build Tasks — **build-story**
- `state.json`, commits, phase advance — Devflow
