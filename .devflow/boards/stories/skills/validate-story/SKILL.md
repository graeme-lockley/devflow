---
name: validate-story
version: 1.0.0
description: >-
  Verifies a Devflow story card during the verifying phase by running Test Scenarios,
  checking Acceptance Criteria, and recording evidence. Use when advancing out of
  verifying or when validation is requested for a card in verifying phase.
outputs:
  - Executed Test Scenarios with recorded results
  - Acceptance Criteria checkboxes updated to [x] or documented waivers
  - Attachments and Notes updated with verification evidence
allowed-tools:
  - read
  - write
  - edit
  - bash
forbids:
  - git push
---

# Validate a Story

Executes **verifying** for a story card: run every **Test Scenario**, confirm
**Acceptance Criteria**, and record evidence in `card.md` per the
[story template](../../assets/story.template.md).

This skill may fix **failing tests or small defects** discovered during
verification. Larger gaps require sending the card back to **building** (user
advances with `devflow card advance` after fixes)—do not silently rewrite the
plan.

## When this skill runs

| Trigger           | Context                                            |
| ----------------- | -------------------------------------------------- |
| Board exit script | Leaving **verifying** → **finishing**              |
| Manual            | User requests validation for a card in `verifying` |

## Canonical template

**[`.devflow/boards/stories/assets/story.template.md`](../../assets/story.template.md)**

Satisfy gates marked **verifying** or **exit verifying**.

## Environment

On verifying → finishing: `DEVFLOW_FROM_PHASE=verifying`,
`DEVFLOW_TO_PHASE=finishing`.

```bash
./devflow card dir <card-id>
deno test                    # from DEVFLOW_REPO_ROOT
./devflow validate           # repository-wide when appropriate
./devflow validate-card <card-id>
```

## Inputs

- **Card ID** (required): e.g. `stories-000001`

## Preconditions

1. `state.json` → `phase` is `verifying`.
2. **Build Tasks** are all `[x]` and **Build Notes** exist.
3. **Test Scenarios** and **Acceptance Criteria** are populated from planning.

If building is incomplete, exit 1.

## Procedure

### 1. Establish verification checklist

From `card.md`, build a matrix:

| Source              | Item                                                       |
| ------------------- | ---------------------------------------------------------- |
| Test Scenarios      | Each table row                                             |
| Acceptance Criteria | Each `[ ]` line                                            |
| Impact Analysis     | Risks that need explicit manual checks (TTY, stderr, etc.) |

### 2. Run automated scenarios

For each **automated** Test Scenario:

1. Run the exact command(s) listed (e.g.
   `deno test src/commands/show-board_test.ts`).
2. Record in **Notes** or extend the Test Scenarios table with a **Result**
   column:
   - `pass` / `fail` + short output excerpt on failure.
3. On failure: attempt a minimal fix if clearly within story scope; re-run. If
   still failing, document in **Notes** and exit 1.

### 3. Run manual scenarios

For each **manual** row:

1. Execute steps (include TTY vs non-TTY checks when relevant).
2. Record observed outcome vs **Expected**.
3. Attach evidence when useful (`devflow card add-file <card-id> <path>` →
   reference in **Attachments**).

### 4. Check acceptance criteria

For each **Acceptance Criteria** item:

1. Map it to one or more Test Scenarios or verification commands.
2. If satisfied, change `[ ]` → `[x]`.
3. If not satisfiable as written, do not check it—update **Notes** with gap
   analysis.

**Waiver:** If the user explicitly waives an AC, mark `[x]` only with
`_(waived: reason)_` on the same line.

### 5. Repository validation

Run when the story touches board/card layout or global invariants:

```bash
deno test
./devflow validate-card <card-id>
./devflow validate
```

Failures → fix or exit 1 with clear **Notes**.

### 6. Regression spot-check

From **Impact Analysis** → Risks, verify:

- No ANSI on machine-parseable stdout commands (req §16.4).
- Errors use stderr conventions (req §16.2) when story touched CLI messaging.
- No unrelated modules broken (`deno test`).

### 7. Update Attachments

Link screenshots, log excerpts, or files under `files/` when cited by ACs or
manual scenarios.

### 8. Do not complete Spec Updates here

Doc finalization is **finish-story** unless an AC explicitly required docs
during build and they were already updated.

### 9. Validation summary

Add a short **Notes** subsection:

```markdown
### Verification summary (YYYY-MM-DD)

- Test scenarios: N/M pass
- Acceptance criteria: N/M checked
- Commands: deno test (pass/fail), devflow validate (pass/fail)
```

Exit 0 only when all ACs are `[x]` (or waived) and all scenarios pass.

## Quality gate (exit verifying)

- [ ] All Test Scenarios executed with recorded results
- [ ] All Acceptance Criteria `[x]` or explicitly waived in line
- [ ] `deno test` passes
- [ ] `devflow validate-card` passes for this card
- [ ] Evidence attached when manual/UX ACs require it
- [ ] **Spec Updates** still accurately show pending vs done (not falsely
      closed)
- [ ] No planning or build tasks unchecked

## On failure

1. Document failures in **Notes** with reproduction steps.
2. Exit 1 so the transition does not complete.
3. Recommend: fix implementation, update Build Tasks/Notes, advance back to
   **building** if needed, then forward to **verifying** again.

## pi-mono invocation

```bash
pi-mono run --skill .devflow/boards/stories/skills/validate-story \
  --board stories --card <card-id>
```

Non-zero exit fails the transition.
