# Skip Action

As a developer advancing a card, I want to skip selected exit-action scripts
during a `devflow card advance` so that I can work around a known-broken or
temporarily inapplicable action (e.g. an LLM-backed `do-*` step or a strict
quality check) without resorting to `--force`, which bypasses the entire exit
sequence for that hop.

## Current State

<!-- phase-gate: complete by exit preparing -->

- `devflow card advance` is implemented in
  [`src/commands/card-advance.ts`](../../../../../src/commands/card-advance.ts)
  and flag-parsed in
  [`src/cli/advance-flags.ts`](../../../../../src/cli/advance-flags.ts). Today
  it accepts only `<card-id> <target-phase>` and the boolean `--force`.
- Exit-action scripts are root files in a board's `scripts/` directory matching
  `^<phase>-[0-9]{3}-[a-z0-9][a-z0-9-]*$` and are executed in lexical order by
  the transition runner (see `src/services/transition.ts` and
  `docs/devflow-requirements.md` §9.3, §11.4).
- `--force` currently skips the **entire** exit-script sequence for a hop
  (`phaseChangedEvent(..., "force")` in `src/services/transition.ts`). There is
  no mechanism for the operator to skip a single action while still running the
  rest of the sequence, and skipped actions are not recorded in card history.
- Requirements (§9.2) already define the canonical action identifier shape
  `<phase>-<sequence>-<action-name>`; users routinely refer to actions by their
  `<phase>-<sequence>` prefix in logs and error messages.

## Objectives

<!-- phase-gate: complete by exit preparing -->

1. Add a `--skip` option to `devflow card advance` that accepts one or more
   action identifiers in the form `<phase>-<sequence>` (e.g. `planning-003`),
   comma-separated.
2. During each single-phase hop of the advance, the transition runner must omit
   any root exit script whose `<phase>-<sequence>` prefix matches a value in
   `--skip`, and must execute all other scripts in their normal lexical order.
3. Validate `--skip` entries: each entry must match `^[a-z][a-z0-9]*-[0-9]{3}$`,
   refer to a real script discoverable in the relevant board's `scripts/`
   directory for the hop being executed, and produce a clear error when it does
   not.
4. Record each skipped action in card history (and emit operator-visible
   boilerplate per §1531-style grey output) so that downstream auditing can see
   which actions were intentionally bypassed and by whom.
5. Keep `--force` semantics unchanged; `--skip` is an additive, finer-grained
   alternative and the two flags may be combined only if behaviour is clearly
   defined (resolved during planning).

## Spec References

<!-- phase-gate: draft by exit preparing | complete by exit planning -->

_Specification and architecture pointers. Use paths and section anchors._

- [ ] `docs/devflow-requirements.md` — §9.2 (script naming), §9.3 (execution
      order), §11.1–§11.4 (transition model and exit-action semantics), and the
      `devflow card advance` row in the CLI table around line 1468.
- [ ] `docs/architecture.md` — CLI layer (`src/cli/advance-flags.ts`),
      commands layer (`src/commands/card-advance.ts`), and transition runner
      (`src/services/transition.ts`).
- [ ] `docs/adr/` — review existing ADRs on the transition runner / locks for
      compatibility; a new ADR may be required if `--skip` materially changes
      exit-action guarantees (decision deferred to planning).

## Acceptance Criteria

<!-- phase-gate: draft by exit preparing | complete by exit planning | all [x] by exit verifying -->

1. [ ] `devflow card advance <card-id> <phase> --skip planning-003` runs all
       discovered `planning-*` exit scripts **except** the one whose name
       begins with `planning-003-` and completes the hop successfully.
2. [ ] `--skip planning-003,planning-005` skips both named actions in a single
       hop; order of values does not matter.
3. [ ] An entry that does not match `^<phase>-[0-9]{3}$` (e.g. `planning_003`,
       `planning-3`, `do-planning`) causes the command to exit non-zero before
       any script runs, with a descriptive error naming the bad token.
4. [ ] An entry that matches the shape but does not correspond to any real
       script for the hop being executed causes the command to exit non-zero
       with an error naming the missing identifier; the card phase is
       unchanged.
5. [ ] In a multi-phase advance, `--skip` entries apply only to hops whose
       phase prefix matches; unrelated hops execute their exit scripts in
       full.
6. [ ] Each skipped action is appended to the card's `history` in `state.json`
       with enough information (action id, hop, timestamp) to identify it
       later, and is reported in the command's stdout/boilerplate output.
7. [ ] `deno test` passes, including new tests covering: flag parsing for
       `--skip`, runner skip behaviour for single- and multi-phase advances,
       validation errors, and history recording.

## Impact Analysis

<!-- phase-gate: complete by exit planning -->

_To be completed in planning._

### Scope

_Modules, commands, files, and user-visible behaviour affected._

### Risks and constraints

_Breaking changes, TTY vs machine output, locks, performance, dependencies._

## Test Scenarios

<!-- phase-gate: complete by exit planning | executed by exit verifying -->

| # | Type      | Scenario                                                       | Expected                                      |
| - | --------- | -------------------------------------------------------------- | --------------------------------------------- |
| 1 | automated | `deno test` covering `--skip` parsing and runner skip logic    | pass                                          |

## Build Tasks

<!-- phase-gate: complete by exit planning | all [x] by exit building -->

1. [ ] _To be completed in planning._

## Spec Updates

<!-- phase-gate: planned by exit planning | completed by exit finishing -->

| Document                       | Planned change                                              | Status  |
| ------------------------------ | ----------------------------------------------------------- | ------- |
| `docs/devflow-requirements.md` | Document `--skip` in CLI + transition model (§9, §11)       | pending |
| `docs/architecture.md`         | Note skip handling in CLI flags + transition runner shape   | pending |
| `README.md`                    | Add `--skip` example to advance command usage               | pending |

## Notes

<!-- phase-gate: optional; ongoing across phases -->
<!-- verifying: add ### Verification summary (YYYY-MM-DD) here — not under Build Notes -->
<!-- finishing: add ### Finished (YYYY-MM-DD) here — sibling of Verification summary, not under Build Notes -->

Open questions for planning:

- Interaction with `--force`: forbid combining, or let `--force` win and make
  `--skip` a no-op when present together?
- Should `--skip` accept the **full** action name (`planning-003-do-planning`)
  in addition to the `<phase>-<sequence>` prefix, for symmetry with log
  output?
- Behaviour when a skipped script is part of a loop block (§9.11) — does
  skipping a loop step skip the whole loop iteration, or just that step?
- Machine-readable output (`--json` style) representation of skipped actions,
  if any of the existing commands already use that pattern.

## Build Notes

<!-- phase-gate: started by exit building | complete by exit finishing -->
<!-- as-built implementation only; do not put ### Finished or ### Verification summary here -->

_To be completed in building._

## Related Cards

<!-- phase-gate: complete or explicit none by exit preparing -->

_None._

## Attachments

<!-- phase-gate: optional preparing–building | evidence by exit verifying when cited in ACs -->

_See `files/` if added during later phases._
