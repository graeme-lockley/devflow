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

- [ ] [`docs/devflow-requirements.md`](../../../../../../docs/devflow-requirements.md)
      — delete §9.12; remove legacy refs in §5.4, §9.8, §11.4, §11.5, §11.9,
      §18; simplify §9.11.3.
- [ ] [`docs/architecture.md`](../../../../../docs/architecture.md) — remove
      legacy loop orchestration subsection.
- [ ] [`docs/adr/0014-script-composition-and-loops.md`](../../../../../../docs/adr/0014-script-composition-and-loops.md)
      — retain hierarchical layout decision only; remove loop block decision or
      mark entire ADR superseded with pointer to 0015.
- [ ] [`docs/adr/0015-script-flow-control.md`](../../../../../../docs/adr/0015-script-flow-control.md)
      — remove coexistence notes.
- [ ] [`docs/adr/0008-transition-runner-orchestration.md`](../../../../../../docs/adr/0008-transition-runner-orchestration.md)
      — remove ADR-0014 loop bullet.

## Acceptance Criteria

<!-- phase-gate: draft by exit preparing | complete by exit planning | all [x] by exit verifying -->

1. [ ] No `phaseScripts` / `loop` parsing in `board.ts` or validate-board.
2. [ ] No `runLoopBlock`, loop branch in `runHopExitScripts`, or
       `partitionLoopRootScripts` in codebase.
3. [ ] No `invokeChildScript` used only for loop (remove or narrow to dead code
       elimination).
4. [ ] `DEVFLOW_SCRIPT_ROUND`, `DEVFLOW_LOOP_MAX`, `DEVFLOW_SCRIPT_PARENT` not
       set by harness.
5. [ ] Requirements contain **no** §9.12; §9.11 is the only exit-script
       orchestration model.
6. [ ] README and architecture describe only `NEXT_SCRIPT` flow.
7. [ ] `grep -r phaseScripts.loop` in repo (excl. history/cards) returns nothing
       in product code or templates.
8. [ ] `deno task test` passes.

## Impact Analysis

<!-- phase-gate: complete by exit planning -->

### Delete / simplify

| Area                                        | Action                                                    |
| ------------------------------------------- | --------------------------------------------------------- |
| `src/services/transition.ts`                | Remove loop branch and `runLoopBlock`                     |
| `src/domain/script-names.ts`                | Remove `partitionLoopRootScripts`                         |
| `src/domain/board.ts`                       | Remove `PhaseScriptConfig`, `LoopConfig`                  |
| `src/services/scripts.ts`                   | Remove or reduce `invokeChildScript` if unused            |
| `src/services/templates.ts`                 | Remove `loadTemplatePhaseScripts` if unused               |
| Tests                                       | Remove loop-specific cases; keep driver tests from 000008 |
| `templates/stories/board.phaseScripts.json` | Delete                                                    |
| Docs                                        | Remove §9.12, legacy README/architecture                  |

### Risks

- External boards (if any) still using loop config would break — document in
  release notes / migration: use `NEXT_SCRIPT` (000009 pattern).

## Test Scenarios

<!-- phase-gate: complete by exit planning | executed by exit verifying -->

| # | Type      | Scenario                                                                | Expected                                      |
| - | --------- | ----------------------------------------------------------------------- | --------------------------------------------- |
| 1 | automated | `deno task test`                                                        | pass; no tests reference loop config          |
| 2 | automated | `rg phaseScripts` in `src/` `templates/` `docs/devflow-requirements.md` | no loop schema (ADR/history may mention)      |
| 3 | automated | `devflow board validate stories`                                        | pass without phaseScripts                     |
| 4 | automated | Board JSON with `phaseScripts.loop` rejected or ignored per final spec  | validate-board fails fast if config forbidden |

## Build Tasks

<!-- phase-gate: complete by exit planning | all [x] by exit building -->

1. [ ] Remove loop types and parsing from `board.ts` + tests.
2. [ ] Remove loop orchestration from `transition.ts` + tests.
3. [ ] Remove `partitionLoopRootScripts`, loop-only `invokeChildScript` usage.
4. [ ] Remove template `board.phaseScripts.json` loading.
5. [ ] Edit requirements (§9.12 removal, cross-ref cleanup) per Spec References.
6. [ ] Edit architecture, README, ADR-0014/0008/0015 per Spec References.
7. [ ] `deno task test`; `rg` audit (#2, #7).

## Spec Updates

<!-- phase-gate: complete by exit building | verified by exit verifying -->

| Document                                           | Action                          | Status  |
| -------------------------------------------------- | ------------------------------- | ------- |
| `docs/devflow-requirements.md`                     | Remove §9.12; clean legacy refs | pending |
| `docs/architecture.md`                             | Remove legacy loop subsection   | pending |
| `docs/adr/0014-script-composition-and-loops.md`    | Trim or mark historical         | pending |
| `docs/adr/0015-script-flow-control.md`             | Remove coexistence §            | pending |
| `docs/adr/0008-transition-runner-orchestration.md` | Drop loop bullet                | pending |
| `README.md`                                        | Remove deprecated loop section  | pending |

## Notes

- Card history in **000003** / **000005** / **000007** referenced loop blocks;
  no need to edit closed cards.
- Validate-board should **reject** unknown `phaseScripts` keys if the schema is
  removed entirely (preferred) or ignore with warning — decide in planning and
  document in requirements.

## Build Notes

<!-- phase-gate: started by exit building | complete by exit finishing -->
<!-- as-built implementation only; do not put ### Finished or ### Verification summary here -->

_To be completed in building._

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
