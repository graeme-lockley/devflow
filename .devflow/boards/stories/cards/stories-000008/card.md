# Revisit the looping solution

As a board author and Devflow operator, I want **script flow control** via the
card variable `NEXT_SCRIPT` implemented in the core CLI, so that phases can run
flat root exit scripts with explicit jumps (including build retries) **without**
`board.json` loop configuration or child step directories—while **legacy loop
blocks remain available** until removed in stories-000010.

This story is **core product only**: harness, domain, tests, and documentation
are already updated in the specification (see Spec References). **Do not**
modify `docs/devflow-requirements.md`, `docs/architecture.md`, or ADRs during
execution of this card.

## Current State

<!-- phase-gate: complete by exit preparing -->

- Exit scripts run in a single linear pass or via **legacy loop orchestration**
  when `board.phaseScripts.<phase>.loop` is configured
  ([`src/services/transition.ts`](../../../../../src/services/transition.ts),
  req §9.12).
- Card variables exist (`devflow variable get/set`) but no harness interprets
  flow-control variables (req §7).
- The **stories** board **building** phase still uses legacy loop config in
  [`board.json`](../../board.json) and steps under
  [`scripts/building/steps/`](../../scripts/building/steps/) — unchanged by this
  story.
- [`partitionLoopRootScripts`](../../../../../src/domain/script-names.ts) and
  [`runLoopBlock`](../../../../../src/services/transition.ts) implement ADR-0014
  loop semantics.

## Objectives

<!-- phase-gate: complete by exit preparing -->

1. Implement the **script flow driver** per req §9.11 and
   [ADR-0015](../../../../../docs/adr/0015-script-flow-control.md) in
   `transition.ts` / `script-names.ts` (and supporting modules).
2. Parse and validate `board.json` field `maxScriptExecutionsPerHop` (default
   100).
3. Pre-validate `NEXT_SCRIPT` on the card at advance start when set (req §11.4
   step 9c).
4. Record `nextScript` on `run.json` script records when a jump is consumed.
5. Implement `--skip` interaction with `NEXT_SCRIPT` (req §11.9): resolve jump
   to skipped script → record skip, continue at lexical successor.
6. **Preserve** legacy loop path unchanged when `phaseScripts.<phase>.loop` is
   present (req §9.11.3).
7. **`deno task test`** passes with new unit/integration coverage; no change to
   stories board scripts or `board.json` loop config.

## Spec References

<!-- phase-gate: complete by exit preparing | complete by exit planning -->

_Specification already updated; execution must implement against these anchors
only._

- [x] [`docs/devflow-requirements.md`](../../../../../../docs/devflow-requirements.md)
      — §5.4 (`maxScriptExecutionsPerHop`), §7 (`NEXT_SCRIPT` reserved), §9.8,
      §9.11 (driver), §9.11.3 (coexistence), §11.4 (steps 9c, 10b), §11.5
      (`NEXT_SCRIPT` / cap errors), §11.9 (`--skip` + `NEXT_SCRIPT`), §15.3
      (`nextScript` in run records), §18 (legacy loop env vars only).
- [x] [`docs/architecture.md`](../../../../../../docs/architecture.md) — §5.3
      transition runner, §5.4 scripts (prefix resolution), §5.7 board
      validation.
- [x] [`docs/adr/0015-script-flow-control.md`](../../../../../../docs/adr/0015-script-flow-control.md)
      — **authoritative decision** for this story.
- [x] [`docs/adr/0014-script-composition-and-loops.md`](../../../../../../docs/adr/0014-script-composition-and-loops.md)
      — legacy loop; do not alter behaviour.
- [x] [`docs/adr/0008-transition-runner-orchestration.md`](../../../../../../docs/adr/0008-transition-runner-orchestration.md)
      — runner owns orchestration.
- [x] [`README.md`](../../../../../README.md) — script flow section (already
      documents author-facing usage).

## Acceptance Criteria

<!-- phase-gate: draft by exit preparing | complete by exit planning | all [x] by exit verifying -->

1. [ ] Phases **without** `phaseScripts.<phase>.loop` use the script flow
       driver: lexical progression on exit 0 when `NEXT_SCRIPT` unset; jump when
       set and valid.
2. [ ] `NEXT_SCRIPT` prefix must match **exactly one** root exit script; zero or
       multiple matches fail the transition and **do not** clear the variable.
3. [ ] Non-zero script exit fails the transition; `NEXT_SCRIPT` is ignored.
4. [ ] Hop entry: unset `NEXT_SCRIPT` → first lexical script; set → validate,
       clear, start at resolved script (req §9.11.5).
5. [ ] After each successful script: consume `NEXT_SCRIPT` if set (clear, record
       `nextScript` in `run.json`); else advance lexically; no successor →
       exit-script pass complete → commit-message runs.
6. [ ] `maxScriptExecutionsPerHop` enforced per hop (default 100); exceed → fail
       with message citing limit, count, and last script.
7. [ ] `--skip` + `NEXT_SCRIPT` to a skipped script: skipped record, no
       execution, continue at lexical successor (req §11.9).
8. [ ] Phases **with** legacy loop config behave as before (stories building
       unchanged); `deno test` including existing loop tests still pass.
9. [ ] Advance preflight validates `NEXT_SCRIPT` when set (step 9c) before
       scripts run on the first hop.
10. [ ] `deno task test` passes.

## Impact Analysis

<!-- phase-gate: complete by exit planning -->

### Scope

| Area                                   | Change                                                                             |
| -------------------------------------- | ---------------------------------------------------------------------------------- |
| `src/domain/board.ts`                  | Parse `maxScriptExecutionsPerHop`; default 100.                                    |
| `src/domain/script-names.ts`           | `resolveExitScriptPrefix(prefix, names)` → one name or error.                      |
| `src/services/transition.ts`           | `runScriptFlowDriver`; branch in `runHopExitScripts`; preflight in `runAdvance`.   |
| `src/services/transition-logs.ts`      | Optional `nextScript?: string` on `RunScriptRecord`.                               |
| `src/domain/card.ts` / variable access | Read/clear `NEXT_SCRIPT` during driver (under transition lock).                    |
| Tests                                  | `script-names_test.ts`, `transition_test.ts` (driver, cap, skip+jump, validation). |
| `board_test.ts`                        | `maxScriptExecutionsPerHop` parsing.                                               |

**Out of scope:** stories board script migration (000009), legacy loop removal
(000010), template `board.phaseScripts.json`, ADR/requirements edits.

### Risks and constraints

- Dual paths (driver vs loop) coexist until 000010 — regression tests for both are mandatory; legacy `runLoopBlock` behaviour must not change.
- Variable clear on failed validation must not run, so operator-resume after a failed transition starts from the same `NEXT_SCRIPT`.
- `NEXT_SCRIPT` read/clear happens under the transition lock; race-free reads required.
- Execution must not touch immutable specs/ADRs (AGENTS.md); all edits land in `src/` and tests only.

## Test Scenarios

<!-- phase-gate: complete by exit planning | executed by exit verifying -->

| #  | Type      | Scenario                                                          | Expected                                |
| -- | --------- | ----------------------------------------------------------------- | --------------------------------------- |
| 1  | automated | `resolveExitScriptPrefix`: one match, zero, two matches           | one → name; zero/two → error            |
| 2  | automated | Driver: three scripts `a-001`, `a-002`, `a-003`; no `NEXT_SCRIPT` | runs 001→002→003; hop succeeds          |
| 3  | automated | Driver: `a-002` sets `NEXT_SCRIPT=a-001`; third script unset      | runs 001→002→001→003                    |
| 4  | automated | Driver: script exits 1 with `NEXT_SCRIPT` set                     | transition fails; variable unchanged    |
| 5  | automated | Driver: invalid prefix (ambiguous / unknown / wrong phase)        | fail; `NEXT_SCRIPT` not cleared         |
| 6  | automated | Driver: `NEXT_SCRIPT` targets commit-message name                 | fail before run                         |
| 7  | automated | Driver: hop entry with `NEXT_SCRIPT=a-002` preset                 | starts at 002, not 001                  |
| 8  | automated | Driver: cap `maxScriptExecutionsPerHop=3`, infinite jump          | fails on 4th execution with cap message |
| 9  | automated | Driver + `--skip a-002`: `NEXT_SCRIPT=a-002` after `a-001`        | skip record for 002; runs 003           |
| 10 | automated | Phase with `phaseScripts.loop` still uses `runLoopBlock`          | existing loop tests pass unchanged      |
| 11 | automated | `run.json` includes `nextScript` when jump consumed               | field present on prior script record    |
| 12 | automated | Advance with invalid `NEXT_SCRIPT` on card at start               | exit 1 before scripts; variable kept    |

## Build Tasks

<!-- phase-gate: complete by exit planning | all [x] by exit building -->

1. [ ] Add `resolveExitScriptPrefix` in `script-names.ts` + tests (#1).
2. [ ] Extend `BoardConfig` / `parseBoardConfig` for `maxScriptExecutionsPerHop`
       (#6, #8).
3. [ ] Extend `RunScriptRecord` with optional `nextScript` (#11).
4. [ ] Implement `runScriptFlowDriver` per §9.11.2 pseudocode in `transition.ts`
       (#2–#7, #9).
5. [ ] Branch `runHopExitScripts`: loop config → existing path; else → driver
       (#8, #10).
6. [ ] Add `NEXT_SCRIPT` preflight in `runAdvance` (#9, #12).
7. [ ] Wire `--skip` visit-without-run for `NEXT_SCRIPT` targets (#7).
8. [ ] Run `deno task test`; fix regressions.

## Spec Updates

<!-- phase-gate: complete by exit preparing — done before this card is built -->

| Document                                           | Sections                                                                       | Status           |
| -------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------- |
| `docs/devflow-requirements.md`                     | §5.4, §7, §9.8, §9.11, §9.12 (renamed legacy), §11.4, §11.5, §11.9, §15.3, §18 | done (pre-story) |
| `docs/architecture.md`                             | §5.3, §5.4, §5.7, §5.8                                                         | done (pre-story) |
| `docs/adr/0015-script-flow-control.md`             | new                                                                            | done (pre-story) |
| `docs/adr/0014-script-composition-and-loops.md`    | superseded status                                                              | done (pre-story) |
| `docs/adr/0008-transition-runner-orchestration.md` | cross-refs                                                                     | done (pre-story) |
| `docs/adr/README.md`                               | index                                                                          | done (pre-story) |
| `README.md`                                        | Board script composition                                                       | done (pre-story) |

**Execution must not edit specification or ADR files.**

## Notes

- Stories **000009** migrates the stories board off legacy loop; **000010**
  removes legacy implementation from the product.
- Self-jump and backward jump are allowed; scripts own retry limits (e.g.
  `BUILD_ROUND` in 000009).
- Driver consumes `NEXT_SCRIPT` once per successful script; preflight (req §11.4
  step 9c) runs before the first hop, then per-hop entry re-validates per
  §9.11.5.

## Build Notes

<!-- phase-gate: started by exit building | complete by exit finishing -->

_To be completed in building._

## Related Cards

<!-- phase-gate: complete or explicit none by exit preparing -->

- `stories-000009` — migrates the stories board building phase off legacy loop
  config onto the new script flow driver.
- `stories-000010` — removes legacy `runLoopBlock` and `phaseScripts.<phase>.loop`
  support from the product.

## Attachments

<!-- phase-gate: optional preparing–building | evidence by exit verifying when cited in ACs -->

_None._
