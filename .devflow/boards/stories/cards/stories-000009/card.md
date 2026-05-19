# Migrate stories and template to new mechanism

As a stories board author, I want the **building** phase refactored to **flat
root exit scripts** and **`NEXT_SCRIPT`-driven retries**, so that the stories
workflow no longer depends on `board.json` loop configuration or
`scripts/building/steps/`—using the script flow driver delivered in
**stories-000008**.

This story is **board + template migration only**. **Do not** modify
`docs/devflow-requirements.md`, `docs/architecture.md`, or ADRs. **Do not**
remove legacy loop product code (that is stories-000010).

**Depends on:** stories-000008 complete (script flow driver in CLI).

## Current State

<!-- phase-gate: complete by exit preparing -->

- Stories [`board.json`](../../board.json) configures
  `phaseScripts.building.loop` with four steps under
  [`scripts/building/steps/`](../../scripts/building/steps/).
- Root building scripts: `building-001-check-entry`,
  `building-003-check-building-quality`, `building-005-check-spec-updates`,
  `building-007-check-git-scope`.
- Loop steps use `DEVFLOW_SCRIPT_ROUND`, `DEVFLOW_LOOP_MAX`, and
  [`building-loop-feedback.sh`](../../scripts/lib/building-loop-feedback.sh).
- [`templates/stories/`](../../../../../templates/stories/) includes
  `board.phaseScripts.json` with the same loop config.
- Other phases (planning, preparing, verifying, finishing) already use flat
  scripts only.

## Objectives

<!-- phase-gate: complete by exit preparing -->

1. **Remove** `phaseScripts.building.loop` from stories
   [`board.json`](../../board.json) and
   [`templates/stories/board.phaseScripts.json`](../../../../../templates/stories/board.phaseScripts.json)
   (delete file if loop was the only content).
2. **Flatten** loop steps into root exit scripts with a clear lexical order.
3. Implement **retry** via `NEXT_SCRIPT` + a round variable (e.g. `BUILD_ROUND`)
   in gate scripts; preserve behaviour: pi → fmt → ci → scenarios with up to
   **5** rounds, prior-round logs fed to pi on retry.
4. Update [`scripts/README.md`](../../scripts/README.md), skills
   ([`build-story/SKILL.md`](../../skills/build-story/SKILL.md)), and
   [`building-lib.sh`](../../scripts/building-lib.sh) for the flat layout.
5. **`deno task test`** passes; stories workflow integration tests updated if
   present.

## Target building script layout

Lexical order (driver default path when gates do not jump):

| Script                                | Role (from current loop / exit)                  |
| ------------------------------------- | ------------------------------------------------ |
| `building-001-check-entry`            | Entry checks (unchanged)                         |
| `building-002-pi`                     | pi build-story (was `building/steps/01-pi.sh`)   |
| `building-003-fmt`                    | fmt / lint-fix (was `02-fmt.sh`)                 |
| `building-004-gate-ci`                | `deno task ci` gate (was `03-gate-ci.sh`)        |
| `building-005-gate-scenarios`         | Test Scenarios gate (was `04-gate-scenarios.sh`) |
| `building-006-check-building-quality` | Was `building-003-*`                             |
| `building-007-check-spec-updates`     | Was `building-005-*`                             |
| `building-008-check-git-scope`        | Was `building-007-*`                             |

**Retry semantics (scripts, not harness):**

- On gate failure (CI or scenarios), if `BUILD_ROUND < 5` (read/increment via
  `devflow variable get/set`): set `NEXT_SCRIPT=building-002`, bump
  `BUILD_ROUND`, **exit 0**.
- On success through `building-005`, clear `BUILD_ROUND` (optional) and do not
  set `NEXT_SCRIPT` (lexical advance to `006`).
- `building-002-pi` uses `BUILD_ROUND` (or `DEVFLOW_*` removed) for prior-round
  feedback via logs under `DEVFLOW_RUN_DIR` (adapt `building-loop-feedback.sh`).
- `building-001` should reset `BUILD_ROUND` at hop start if appropriate.

Remove directory [`scripts/building/steps/`](../../scripts/building/steps/)
after migration.

## Spec References

<!-- phase-gate: complete by exit preparing | complete by exit planning -->

_Implement behaviour defined in these documents; do not edit them._

- [ ] [`docs/devflow-requirements.md`](../../../../../../docs/devflow-requirements.md)
      — §9.11 (driver), §9.3 (root script naming), §7 (`NEXT_SCRIPT`,
      `BUILD_ROUND` convention).
- [ ] [`docs/adr/0015-script-flow-control.md`](../../../../../../docs/adr/0015-script-flow-control.md).
- [ ] [`README.md`](../../../../../README.md) — script flow author guide.

## Acceptance Criteria

<!-- phase-gate: draft by exit preparing | complete by exit planning | all [x] by exit verifying -->

1. [ ] Stories `board.json` has **no** `phaseScripts.building.loop`.
2. [ ] No files under `scripts/building/steps/` on the stories board.
3. [ ] Flat scripts `building-002` … `building-005` exist and implement former
       loop step behaviour.
4. [ ] Failed CI/scenarios retry from `building-002` up to 5 rounds via
       `NEXT_SCRIPT` + `BUILD_ROUND`; successful build hop reaches
       `building-008` and advances.
5. [ ] `templates/stories/` matches (scripts, no loop JSON, generic paths).
6. [ ] `scripts/README.md` documents flat building layout (not loop bands).
7. [ ] `deno task test` passes.

## Impact Analysis

<!-- phase-gate: complete by exit planning -->

### Files (expected)

| Path                                                                     | Action                    |
| ------------------------------------------------------------------------ | ------------------------- |
| `.devflow/boards/stories/board.json`                                     | Remove `phaseScripts`     |
| `.devflow/boards/stories/scripts/building-002-pi` … `005-gate-scenarios` | Add (from steps)          |
| `.devflow/boards/stories/scripts/building-006-*` … `008-*`               | Renumber from 003/005/007 |
| `.devflow/boards/stories/scripts/building/steps/*`                       | Delete                    |
| `templates/stories/board.phaseScripts.json`                              | Remove or empty           |
| `templates/stories/scripts/`                                             | Mirror live board         |
| `building-lib.sh`, `lib/building-loop-feedback.sh`                       | Adapt round variable      |
| `skills/build-story/SKILL.md`                                            | Update script paths       |

### Risks

- Renumbering may break operator muscle memory — document in README section.
- Parity with 5-round loop + pi feedback requires careful port of bash gates.

## Test Scenarios

<!-- phase-gate: complete by exit planning | executed by exit verifying -->

| # | Type      | Scenario                                                             | Expected                                           |
| - | --------- | -------------------------------------------------------------------- | -------------------------------------------------- |
| 1 | automated | `deno task test` (full suite)                                        | pass                                               |
| 2 | automated | `devflow board validate stories`                                     | pass; no loop config errors                        |
| 3 | automated | Template init copies flat building scripts, no `phaseScripts` loop   | new board has 002–005, no `building/steps`         |
| 4 | manual    | Advance a card through building with intentional CI failure then fix | retries from 002; ≤5 rounds; eventual pass or fail |
| 5 | manual    | `DEVFLOW_SKIP_PI=1` path still works on `building-002-pi`            | pi skipped; gates still run                        |

## Build Tasks

<!-- phase-gate: complete by exit planning | all [x] by exit building -->

1. [ ] Remove `phaseScripts` from stories `board.json`.
2. [ ] Create flat `building-002` … `005` from step scripts; renumber 006–008.
3. [ ] Implement `BUILD_ROUND` + `NEXT_SCRIPT` retry in gate scripts.
4. [ ] Update `building-loop-feedback.sh` / pi prompt for round variable.
5. [ ] Delete `scripts/building/steps/`; update `scripts/README.md`.
6. [ ] Sync `templates/stories/` (scripts, remove `board.phaseScripts.json`
       loop).
7. [ ] Update `build-story` skill references.
8. [ ] Run `deno task test` (#1–#3).

## Spec Updates

<!-- phase-gate: complete by exit preparing — none required -->

| Document                           | Action                               |
| ---------------------------------- | ------------------------------------ |
| Requirements / architecture / ADRs | **No changes** — specified in 000008 |

## Notes

<!-- phase-gate: optional; ongoing across phases -->

- **000010** removes legacy loop code from the CLI; this story only stops using
  it on the stories board.
- Sequence renumber (`003`→`006`, etc.) is intentional; update any card or doc
  references to old numbers in the same story.

## Build Notes

<!-- phase-gate: started by exit building | complete by exit finishing -->

_To be completed in building._

## Related Cards

<!-- phase-gate: complete or explicit none by exit preparing -->

- **stories-000008** — script flow driver in CLI (dependency; must be complete).
- **stories-000010** — removes legacy loop product code from the CLI
  (follow-on; out of scope here).

## Attachments

<!-- phase-gate: optional preparing–building | evidence by exit verifying when cited in ACs -->

_Screenshots, logs, or files under `files/`._
