<!-- story.template.md — canonical card.md for the stories board.
     Keep every ## heading and <!-- phase-gate --> comment. # title must match state.json (read-only).
     Skills: prepare-story | plan-story | build-story | validate-story | finish-story
     Placeholder: _To be completed in <phase>._ — leave until that phase's skill runs; scripts grep these strings.
-->

# {title}

<!-- phase-gate: complete by exit preparing -->

{description}

## Current State

<!-- phase-gate: complete by exit preparing -->
<!-- preparing: factual as-is; cite repo paths (src/, docs/) -->

{current_state}

## Objectives

<!-- phase-gate: complete by exit preparing -->
<!-- preparing: numbered list, 3–10 outcomes -->

{objectives}

## Spec References

<!-- phase-gate: draft by exit preparing | complete by exit planning -->
<!-- preparing: ≥1 line `- [ ] \`path\` — section`; planning: mark verified items `[x]` -->

_Specification and architecture pointers. Use paths and section anchors._

- [ ] `docs/devflow-requirements.md` — _section(s)_
- [ ] `docs/architecture.md` — _area(s)_
- [ ] `docs/adr/` — _ADR id(s), or N/A_

## Acceptance Criteria

<!-- phase-gate: draft by exit preparing | complete by exit planning | all [x] by exit verifying -->
<!-- preparing: numbered checklist `1. [ ] …` (3–10); verifying: all `[x]` -->

{acceptance_criteria}

## Impact Analysis

<!-- phase-gate: complete by exit planning -->

### Scope

_To be completed in planning._

### Risks and constraints

_To be completed in planning._

## Test Scenarios

<!-- phase-gate: complete by exit planning | executed by exit verifying -->

| # | Type      | Scenario           | Expected             |
| - | --------- | ------------------ | -------------------- |

_To be completed in planning._

## Build Tasks

<!-- phase-gate: complete by exit planning | all [x] by exit building -->

1. [ ] _To be completed in planning._

## Spec Updates

<!-- phase-gate: planned by exit planning | completed by exit finishing -->

| Document                       | Planned change | Status  |
| ------------------------------ | -------------- | ------- |
| `docs/devflow-requirements.md` | _none / §…_    | pending |
| `docs/architecture.md`         | _none / …_     | pending |
| `README.md`                    | _none / …_     | pending |

## Notes

<!-- phase-gate: optional; ongoing across phases -->
<!-- verifying: add ### Verification summary (YYYY-MM-DD) here — not under Build Notes -->
<!-- finishing: add ### Finished (YYYY-MM-DD) here — sibling of Verification summary, not under Build Notes -->

_Decisions, questions, blockers, and planning-time design notes._

## Build Notes

<!-- phase-gate: started by exit building | complete by exit finishing -->
<!-- as-built implementation only; do not put ### Finished or ### Verification summary here -->

_To be completed in building._

## Related Cards

<!-- phase-gate: complete or explicit none by exit preparing -->

_None._

## Attachments

<!-- phase-gate: optional preparing–building | evidence by exit verifying when cited in ACs -->

_Screenshots, logs, or files under `files/`._
