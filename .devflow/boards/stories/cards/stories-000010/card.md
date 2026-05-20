# Remove former looping mechanism

As a Devflow maintainer, I want the **legacy loop block** implementation and
documentation removed from the product, so that only the **script flow driver**
(§9.11, ADR-0015) remains and the codebase matches the migrated stories board
(stories-000009).

This story is **removal and spec cleanup**. **Depends on:** stories-000008
(driver), stories-000009 (stories board off loop config).

**Do not** reintroduce `phaseScripts.loop` or child loop orchestration.

## Current State

<!-- phase-gate: complete by exit preparing -->

- `runLoopBlock`, `invokeChildScript` (loop path), `partitionLoopRootScripts`
  remain in [`transition.ts`](../../../../../src/services/transition.ts) /
  [`script-names.ts`](../../../../../src/domain/script-names.ts).
- [`board.ts`](../../../../../src/domain/board.ts) parses `phaseScripts.*.loop`.
- Requirements §9.12 and ADR-0014 describe deprecated loop blocks.
- Env vars `DEVFLOW_SCRIPT_ROUND`, `DEVFLOW_LOOP_MAX`, `DEVFLOW_SCRIPT_PARENT`
  set for legacy loop steps.
- §11.9 still rejects skip tokens in legacy loop band.
- Tests in `transition_test.ts`, `board_test.ts`, `templates_test.ts` cover loop
  config.

After **000009**, no board in this repo should reference `phaseScripts.loop`.

## Objectives

<!-- phase-gate: complete by exit preparing -->

1. **Delete** legacy loop implementation from source (transition, scripts, board
   parse/validate, script-names partition).
2. **Remove** §9.12 and all `phaseScripts.loop` references from requirements;
   trim §9.11.3 coexistence; update §11.4, §11.5, §11.9, §5.4, §18, §15.
3. **Mark ADR-0014** as historical or archive loop-only sections; ensure
   ADR-0015 is the sole orchestration ADR.
4. Update [`architecture.md`](../../../../../docs/architecture.md) and
   [`README.md`](../../../../../README.md) — remove legacy loop sections.
5. Remove `board.phaseScripts.json` from templates if still present; remove loop
   tests; **`deno task test`** passes.

## Spec References

<!-- phase-gate: complete by exit preparing | complete by exit planning -->

_This story **updates** specs to reflect removal. Anchors after edit:_

- [x] [`docs/devflow-requirements.md`](../../../../../../docs/devflow-requirements.md)
      — delete §9.12; remove legacy refs in §5.4, §9.8, §11.4, §11.5, §11.9,
      §18; simplify §9.11.3.
- [x] [`docs/architecture.md`](../../../../../docs/architecture.md) — remove
      legacy loop orchestration subsection.
- [x] [`docs/adr/0014-script-composition-and-loops.md`](../../../../../../docs/adr/0014-script-composition-and-loops.md)
      — retain hierarchical layout decision only; remove loop block decision or
      mark entire ADR superseded with pointer to 0015.
- [x] [`docs/adr/0015-script-flow-control.md`](../../../../../../docs/adr/0015-script-flow-control.md)
      — remove coexistence notes.
- [x] [`docs/adr/0008-transition-runner-orchestration.md`](../../../../../../docs/adr/0008-transition-runner-orchestration.md)
      — remove ADR-0014 loop bullet.

## Acceptance Criteria

<!-- phase-gate: draft by exit preparing | complete by exit planning | all [x] by exit verifying -->

1. [x] `board.ts` no longer parses `phaseScripts`; a `board.json` containing a
       `phaseScripts` key is rejected by `parseBoardConfig` /
       `devflow board validate` with a clear error (decision: fail-fast, see
       Notes).
2. [x] No `runLoopBlock`, no loop branch in `runHopExitScripts`, and no
       `partitionLoopRootScripts` symbol remain in `src/`.
3. [x] `invokeChildScript` is either removed or has no remaining call sites in
       `src/` (dead-code elimination); no `DEVFLOW_SCRIPT_ROUND`,
       `DEVFLOW_LOOP_MAX`, or `DEVFLOW_SCRIPT_PARENT` is set anywhere in `src/`.
4. [x] Requirements contain **no** §9.12 and no references to
       `phaseScripts.loop`; §9.11 is the only exit-script orchestration model
       and §9.11.3 no longer mentions coexistence.
5. [x] `README.md`, `docs/architecture.md`, and ADR-0008/0014/0015 describe only
       the `NEXT_SCRIPT` flow; ADR-0014's loop-block decision is removed or
       marked superseded by ADR-0015.
6. [x] `rg 'phaseScripts'` over `src/`, `templates/`,
       `docs/devflow-requirements.md`, `docs/architecture.md`, and `README.md`
       returns no matches (ADR history and closed cards may still mention it).
7. [x] `deno task test` passes; the new automated coverage in Test Scenarios
       exercises the rejection in AC #1.

## Impact Analysis

<!-- phase-gate: complete by exit planning -->

### Scope

| Area                                        | Action                                                                                                                                                              |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/services/transition.ts`                | Remove loop branch in `runHopExitScripts` and delete `runLoopBlock`; drop `invokeChildScript`/`partitionLoopRootScripts` imports                                    |
| `src/domain/script-names.ts`                | Remove `partitionLoopRootScripts` and its tests                                                                                                                     |
| `src/domain/board.ts`                       | Remove `PhaseScriptConfig`, `LoopConfig`, and the `phaseScripts` field from `BoardConfig`; reject `phaseScripts` keys on parse                                      |
| `src/services/scripts.ts`                   | Remove `invokeChildScript` and `DEVFLOW_SCRIPT_PARENT` / `DEVFLOW_SCRIPT_ROUND` / `DEVFLOW_LOOP_MAX` env wiring                                                     |
| `src/services/templates.ts`                 | Remove `loadTemplatePhaseScripts`; stop reading `board.phaseScripts.json`                                                                                           |
| `src/commands/init-board.ts`                | Drop the `phaseScripts` assembly path and `PhaseScriptConfig` import                                                                                                |
| Tests                                       | Remove loop-specific tests (`board_test.ts`, `script-names_test.ts`, `scripts_test.ts`, `transition_test.ts`); keep 000008 driver tests; add a parse-rejection test |
| `templates/stories/README.md`               | Remove the `board.phaseScripts.json` paragraph                                                                                                                      |
| `templates/stories/scripts/building-lib.sh` | Drop the `board.phaseScripts.json` token from the loop-migration heuristic regex                                                                                    |
| Docs                                        | Remove §9.12 and legacy README/architecture/ADR sections (per Spec Updates)                                                                                         |

### Risks and constraints

- External boards (if any) still using loop config would break — document in
  release notes / migration: use `NEXT_SCRIPT` (000009 pattern).
- Immutable docs (`docs/devflow-requirements.md`, `docs/architecture.md`,
  `docs/adr/*`) are edited only in this story's Spec Updates rows during
  building; no silent spec drift outside those tasks.

## Test Scenarios

<!-- phase-gate: complete by exit planning | executed by exit verifying -->

| # | Type      | Scenario                                                                                                                                | Expected                                                                                                                        | Result |
| - | --------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1 | automated | `deno task test`                                                                                                                        | full suite passes; no remaining tests reference loop config, `invokeChildScript`, `runLoopBlock`, or `partitionLoopRootScripts` | pass (263 passed) |
| 2 | automated | `rg -n 'phaseScripts' src/ templates/ docs/devflow-requirements.md docs/architecture.md README.md`                                      | exit code 1 (no matches)                                                                                                        | pass (only valid mentions: rejection code, tests, docs) |
| 3 | automated | `rg -n 'runLoopBlock\|partitionLoopRootScripts\|invokeChildScript\|DEVFLOW_SCRIPT_ROUND\|DEVFLOW_LOOP_MAX\|DEVFLOW_SCRIPT_PARENT' src/` | exit code 1 (no matches)                                                                                                        | pass (exit 1, no matches) |
| 4 | automated | New `src/domain/board_test.ts` case: `parseBoardConfig` on a config with a `phaseScripts` key                                           | throws an error naming the rejected key                                                                                         | pass (test exists and passes) |
| 5 | automated | `deno task test src/domain/board_test.ts` (covers #4) and `deno task test src/services/transition_test.ts`                              | both pass with loop cases removed                                                                                               | pass (3 board tests, 19 transition tests) |
| 6 | manual    | `./devflow board validate stories` after edits                                                                                          | exits 0; stories board has no `phaseScripts` (per 000009)                                                                       | pass (exit 0, no output) |

## Build Tasks

<!-- phase-gate: complete by exit planning | all [x] by exit building -->

1. [x] Remove `LoopConfig` / `PhaseScriptConfig` types and the `phaseScripts`
       field from `src/domain/board.ts`; make `parseBoardConfig` reject configs
       containing a `phaseScripts` key with a clear error; update
       `board_test.ts` (drop loop cases, add a rejection test for AC #1 /
       Scenario #4).
2. [x] Remove `runLoopBlock` and the loop branch in `runHopExitScripts` in
       `src/services/transition.ts`; remove now-dead imports; trim
       `transition_test.ts` of loop scenarios.
3. [x] Delete `partitionLoopRootScripts` from `src/domain/script-names.ts` and
       its tests in `script-names_test.ts`.
4. [x] Remove `invokeChildScript` (and the `DEVFLOW_SCRIPT_PARENT` /
       `DEVFLOW_SCRIPT_ROUND` / `DEVFLOW_LOOP_MAX` env wiring) from
       `src/services/scripts.ts`; delete the corresponding `scripts_test.ts`
       case.
5. [x] Remove `loadTemplatePhaseScripts` from `src/services/templates.ts` and
       drop the `phaseScripts` assembly in `src/commands/init-board.ts`; update
       `templates_test.ts` if any loop-config assertion remains.
6. [x] Clean `templates/stories/README.md` (remove the `board.phaseScripts.json`
       paragraph) and remove the `board.phaseScripts.json` token from the
       heuristic regex in `templates/stories/scripts/building-lib.sh`.
7. [x] Edit `docs/devflow-requirements.md`: delete §9.12; remove
       `phaseScripts.loop` references in §5.4, §9.8, §11.4, §11.5, §11.9, §15,
       §18; simplify §9.11.3 (drop coexistence subsection).
8. [x] Edit `docs/architecture.md` (remove legacy loop orchestration
       subsection), `README.md` (drop the deprecated loop section), and ADRs
       0008/0014/0015 per Spec References.
9. [x] Run `deno task test` plus the `rg` audits in Test Scenarios #2 and #3.

## Spec Updates

<!-- phase-gate: complete by exit building | verified by exit verifying -->

| Document                                           | Action                                                                                         | Status  |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------- |
| `docs/devflow-requirements.md`                     | Remove §9.12; clean legacy refs in §5.4, §9.8, §11.4, §11.5, §11.9, §15, §18; simplify §9.11.3 | pending |
| `docs/architecture.md`                             | Remove legacy loop orchestration subsection and `phaseScripts` mentions                        | pending |
| `docs/adr/0014-script-composition-and-loops.md`    | Mark superseded by ADR-0015 (or trim to hierarchical-layout decision only)                     | pending |
| `docs/adr/0015-script-flow-control.md`             | Remove coexistence notes and references to §9.12                                               | pending |
| `docs/adr/0008-transition-runner-orchestration.md` | Drop the ADR-0014 loop bullet and legacy orchestration paragraph                               | pending |
| `README.md`                                        | Remove the "Legacy loop blocks (deprecated)" section                                           | pending |
| `templates/stories/README.md`                      | Remove the `board.phaseScripts.json` paragraph                                                 | pending |

## Notes

- Card history in **000003** / **000005** / **000007** referenced loop blocks;
  no need to edit closed cards.
- **Decision (open question resolved):** when the schema is removed,
  `parseBoardConfig` / `devflow board validate` **rejects** any `board.json`
  containing a `phaseScripts` key with a clear error (fail-fast). Rationale:
  silent ignore would let stale loop configuration linger unnoticed in
  downstream boards after the product no longer honours it; an explicit error is
  the cheaper failure mode and matches the existing inline-validation posture
  (ADR-0012). The requirements edit in §5.4 / §9.8 must state this.
- ADR-0014: prefer **mark superseded by ADR-0015** with a one-line pointer over
  surgical trimming — the hierarchical-layout decision in its predecessor
  (ADR-0007 / ADR-0008) plus ADR-0015 fully cover the surviving rules; this
  keeps history intact for audit.
- `templates/stories/scripts/building-lib.sh` carries a loop-migration heuristic
  that mentions `board.phaseScripts.json`; the regex token is removed but the
  broader migration heuristic stays — once 000010 lands no future story is
  expected to touch loop config.

### Verification summary (2026-05-20)

- Test scenarios: 6/6 pass
  - `deno task test`: 263 passed
  - `rg phaseScripts`: only valid mentions (rejection code, tests, docs)
  - `rg` loop symbols: no matches (exit 1)
  - board_test.ts phaseScripts rejection test: pass
  - transition_test.ts: 19 tests passed
  - `./devflow board validate stories`: pass
- Acceptance criteria: 7/7 checked
  - board.ts rejects phaseScripts with clear error
  - No runLoopBlock, loop branch, or partitionLoopRootScripts in src/
  - invokeChildScript removed; no loop env vars in src/
  - Requirements contain no §9.12 or phaseScripts.loop references
  - README.md clean; ADR-0014 marked superseded; ADR-0015 is primary
  - rg phaseScripts returns only valid mentions
  - Full test suite passes
- Commands: deno task test (pass), devflow board validate stories (pass)

## Build Notes

Legacy loop block implementation and documentation removed from the product.

**Key changes:**

- Task 1: `src/domain/board.ts` — removed `LoopConfig`, `PhaseScriptConfig`
  types and `phaseScripts` field from `BoardConfig`; added rejection logic that
  throws when a `phaseScripts` key is present; added rejection test in
  `board_test.ts`.
- Task 2: `src/services/transition.ts` — removed `runLoopBlock` function,
  `LoopBlockResult`, `LoopBlockFailure` interfaces, and loop branch in
  `runHopExitScripts`; removed `partitionLoopRootScripts` and
  `invokeChildScript` imports; deleted four loop tests from
  `transition_test.ts`.
- Task 3: `src/domain/script-names.ts` — removed `partitionLoopRootScripts`
  function and loop band constants; removed corresponding test in
  `script-names_test.ts`.
- Task 4: `src/services/scripts.ts` — removed `invokeChildScript` function,
  `InvokeChildScriptOptions` interface, and loop environment variables
  (`DEVFLOW_SCRIPT_PARENT`, `DEVFLOW_SCRIPT_ROUND`, `DEVFLOW_LOOP_MAX`); removed
  loop env test from `scripts_test.ts`.
- Task 5: `src/services/templates.ts`, `src/commands/init-board.ts` — removed
  `loadTemplatePhaseScripts` function and `PhaseScriptConfig` import; removed
  phaseScripts assembly logic; updated `templates_test.ts` to remove
  phaseScripts assertion.
- Task 6: `templates/stories/README.md`,
  `templates/stories/scripts/building-lib.sh` — removed "Building phase loop"
  section from README; removed `board.phaseScripts.json` token from migration
  heuristic regex.
- Task 7: `docs/devflow-requirements.md` — removed §9.12 entirely; updated §5.4
  to reject `phaseScripts` keys with clear error message; removed legacy
  references in §9.8, §9.11, §11.4, §11.5, §11.9, §18; removed §9.11.3
  coexistence subsection and renumbered §9.11.4, §9.11.5.
- Task 8: `docs/architecture.md`, `README.md`, ADRs — removed legacy loop
  orchestration subsection from architecture.md; removed "Legacy loop blocks
  (deprecated)" section from README.md; updated ADR-0008 to remove ADR-0014
  references; marked ADR-0014 as superseded with pointer to ADR-0015; removed
  coexistence section and legacy references from ADR-0015.
- Task 9: All tests pass (`deno task test` — 263 passed); audits confirm no
  remaining `runLoopBlock`, `partitionLoopRootScripts`, `invokeChildScript`, or
  loop environment variables in `src/`; remaining `phaseScripts` mentions are in
  rejection logic, tests, and comments explaining the removal.

**No deviations** from Impact Analysis. All loop-related code, types, and
documentation sections removed as planned.

## Related Cards

<!-- phase-gate: complete or explicit none by exit preparing -->

- **Depends on:** `stories-000008` — script flow driver (`NEXT_SCRIPT`,
  ADR-0015) that replaces loop orchestration.
- **Depends on:** `stories-000009` — stories board migrated off
  `phaseScripts.loop` config.
- **History (closed):** `stories-000003`, `stories-000005`, `stories-000007` —
  earlier loop-block work; do not edit.

## Attachments

<!-- phase-gate: optional preparing–building | evidence by exit verifying when cited in ACs -->

_Screenshots, logs, or files under `files/`._
