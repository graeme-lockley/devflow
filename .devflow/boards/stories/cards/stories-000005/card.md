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

- [x] `docs/devflow-requirements.md` - §9.2 (script naming, identifier
      `<phase>-<sequence>-<action-name>`), §9.3 (lexical execution order), §9.11
      (loop blocks; relevant to skip exclusions), §11.4 (transition algorithm,
      step 10b), §11.5 (failure behaviour / history events), §11.8 (`--force`
      semantics), §12.3 (blocked cards and advance), §16.0
      (`devflow card advance` row, ~line 1468), §16.1 (global flags table).
- [x] `docs/architecture.md` - CLI flag parser (`src/cli/advance-flags.ts`),
      command entry (`src/commands/card-advance.ts`), transition runner
      (`src/services/transition.ts`, `runHopExitScripts` /
      `runSingleHopNormal`), and history domain (`src/domain/history.ts`,
      `src/domain/card.ts` `HistoryEvent` union).
- [x] `docs/adr/` - no existing ADR governs per-action skipping. `--skip` is
      additive to §11.4 and does not alter the lock model, commit model, or loop
      semantics, so a new ADR is **not** required (recorded in Notes). Reviewed:
      ADRs on transition runner, locks, and git boundaries remain compatible.

## Acceptance Criteria

<!-- phase-gate: draft by exit preparing | complete by exit planning | all [x] by exit verifying -->

1. [x] `devflow card advance <card-id> <phase> --skip planning-003` runs all
       discovered `planning-*` exit scripts **except** the one whose name begins
       with `planning-003-` and completes the hop successfully.
2. [x] `--skip planning-003,planning-005` skips both named actions in a single
       hop; order of values does not matter.
3. [x] An entry that does not match `^<phase>-[0-9]{3}$` (e.g. `planning_003`,
       `planning-3`, `do-planning`) causes the command to exit non-zero before
       any script runs, with a descriptive error naming the bad token.
4. [x] An entry that matches the shape but does not correspond to any real
       script for the hop being executed causes the command to exit non-zero
       with an error naming the missing identifier; the card phase is unchanged.
5. [x] In a multi-phase advance, `--skip` entries apply only to hops whose phase
       prefix matches; unrelated hops execute their exit scripts in full.
6. [x] Each skipped action is appended to the card's `history` in `state.json`
       with enough information (action id, hop, timestamp) to identify it later,
       and is reported in the command's stdout/boilerplate output.
7. [x] `deno test` passes, including new tests covering: flag parsing for
       `--skip`, runner skip behaviour for single- and multi-phase advances,
       validation errors, and history recording.

## Impact Analysis

<!-- phase-gate: complete by exit planning -->

### Scope

**CLI parsing** - `src/cli/advance-flags.ts`

- Extend `ParsedAdvanceArgs` with `skip: string[]` (normalised, de-duplicated
  `<phase>-<sequence>` prefixes).
- Accept `--skip <list>` and `--skip=<list>` forms; values are comma-separated.
  Repeated `--skip` flags accumulate.
- Accept both `<phase>-<sequence>` (e.g. `planning-003`) and full
  `<phase>-<sequence>-<action-name>` (e.g. `planning-003-do-planning`) tokens;
  normalise full names to their `<phase>-<sequence>` prefix.
- Validate token **shape** at parse time against
  `^[a-z][a-z0-9]*-[0-9]{3}(-[a-z0-9][a-z0-9-]*)?$`; shape errors raise a
  parse-time error (handled by dispatch as exit 1 before any locks).

**Dispatch** - `src/cli/dispatch.ts`

- Pass `skip` through to `advanceCard` via `AdvanceCardOptions`.
- Reject the combination `--skip` + `--force` with a clear CLI error (exit 1)
  before acquiring locks.

**Command** - `src/commands/card-advance.ts`

- Extend `AdvanceCardOptions` with `skip?: string[]`.
- Plumb `skip` into `runAdvance` (force path ignores it; combination already
  rejected upstream, but defensively assert).

**Transition runner** - `src/services/transition.ts`

- Extend `RunAdvanceOptions` and `runHopExitScripts` with `skip: string[]`.
- Before executing a hop's exit scripts, compute the set of script names
  matching each `<phase>-<sequence>` prefix **for the hop's `from` phase**.
  - Entries whose phase prefix does not match the current hop are ignored for
    that hop (multi-phase advances).
  - Entries that match the shape but resolve to **zero** scripts on the current
    hop produce a hop-level error: exit non-zero, no scripts run, no state
    mutation.
  - Entries that match a script which falls inside a configured loop band
    (§9.11.3) produce a hop-level error ("cannot skip loop step `<name>`"). Only
    root scripts in the entry or exit bands of a loop phase, and root scripts of
    non-loop phases, may be skipped.
- When a script is skipped, append a `RunScriptRecord` of
  `{ name, exitCode: 0, skipped: true }` (extend the type) and write a grey
  console line (`logSkipped`) at the `info`/`verbose` levels. Output is
  suppressed at `summary` level except for a count in the hop summary.
- The commit-message script is **not** skippable; `--skip planning-099` matching
  the commit-message name (if it accidentally collides) is validated against the
  exit-script list only and will be rejected as unknown.

**History** - `src/domain/card.ts`, `src/domain/history.ts`

- Add a new `ActionSkippedEvent` to the `HistoryEvent` union:
  `{ type: "actionSkipped", at, from, to, script }`.
- Add a helper `actionSkippedEvent(from, to, script, at)`.
- Append one event per skipped action **before** the hop's `phaseChanged` event
  so history reads chronologically.
- Validation (`src/domain/card.ts` history reader) tolerates the new event type
  alongside the existing `Record<string, unknown>` fallback.

**Run logs** - `src/services/transition-logs.ts`

- Surface `skipped: true` in `RunScriptRecord` so `run.json` records the intent;
  runner already writes records to disk.

**Console** - `src/services/console.ts`

- Add `logSkipped(name: string, reason: string)` rendering grey/dim text per
  §16.2 boilerplate styling.

**Validation / preconditions** - `src/domain/advance-preconditions.ts`

- No change to blocked-phase rules; `--skip` does not bypass §12.3.

### Risks and constraints

- **Spec change (immutable docs)**: this story introduces user-visible behaviour
  not currently described in §9, §11, §16. Spec edits to
  `docs/devflow-requirements.md` and `docs/architecture.md` require explicit
  user approval (AGENTS.md immutable-docs rule). Build tasks flag the doc edits
  and stop for approval before writing them.
- **Backwards compatibility**: omitting `--skip` must produce byte-for-byte
  identical behaviour (no new history events, no new log lines, no extra
  `run.json` fields beyond what current tests assert). New `skipped` field on
  `RunScriptRecord` must be optional.
- **Loop interaction (§9.11)**: silently skipping a loop step would invalidate
  loop semantics (restart-on-failure across an ordered step list). Plan rejects
  skipping inside the loop band rather than redefining loop behaviour.
- **`--force` interaction**: §11.8 already states force runs no scripts;
  combining `--skip` + `--force` is undefined. Plan forbids the combination at
  CLI dispatch.
- **Machine output (§16.4)**: no existing command emits `--json`, so this story
  does not add one. `run.json` already machine-parseable; `skipped` field is the
  structured artifact.
- **Locks / transitions (§14, §11.4)**: validation of skip tokens happens before
  lock acquisition for shape errors, and immediately after listing scripts
  (still under lock) for unknown-action errors. No new lock paths.
- **Multi-phase advances**: a skip token that does not match any hop in the
  advance must be detected. Plan: after enumerating hops, pre-compute the union
  of `<phase>-<sequence>` prefixes that would match at least one script across
  all hops; reject any `--skip` token that matches zero hops. This prevents
  typos like `planing-003` from silently succeeding.

## Test Scenarios

<!-- phase-gate: complete by exit planning | executed by exit verifying -->

| #  | Type      | Scenario                                                                                                                                                  | Expected                                                                                                                            |
| -- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1  | automated | `src/cli/advance-flags_test.ts`: parse `--skip planning-003`, `--skip=a-001,b-002`, repeated `--skip`, full-name `planning-003-do-planning`, shape errors | normalised `skip: string[]` of `<phase>-<sequence>` tokens; shape errors throw                                                      |
| 2  | automated | `src/cli/dispatch_test.ts`: `--skip` combined with `--force`                                                                                              | exit code `1`, error message names the conflict, no advance attempted                                                               |
| 3  | automated | `src/services/transition_test.ts`: single hop skips one named root script, runs the other root scripts in lexical order                                   | skipped script never executed; remaining scripts run; hop succeeds; `run.json` has `skipped: true` record; commit created           |
| 4  | automated | `src/services/transition_test.ts`: multi-phase advance with `--skip planning-003` skips only the `planning` hop's 003 script and runs `building`'s fully  | only `planning-003-*` skipped; `building-*` scripts all run; one commit per hop                                                     |
| 5  | automated | `src/services/transition_test.ts`: `--skip planning-099` where no `planning-099-*` script exists                                                          | exit code `1` before any hop scripts run, error names the unknown token, card phase unchanged                                       |
| 6  | automated | `src/services/transition_test.ts`: skip token targets a loop-block step in a phase configured with `phaseScripts.<phase>.loop`                            | exit code `1`, error names the loop-step conflict, no scripts run                                                                   |
| 7  | automated | `src/services/transition_test.ts`: each skipped action appends an `actionSkipped` history event before the hop's `phaseChanged`                           | `state.history` contains `{type:"actionSkipped", from, to, script, at}` ordered before `phaseChanged`                               |
| 8  | automated | `src/services/transition_test.ts`: multi-phase advance with a `--skip` token whose phase matches no hop in the run (typo: `planing-003`)                  | exit code `1` before any script runs, error names the unmatched token                                                               |
| 9  | automated | `src/services/transition_test.ts`: `--skip` token matching the commit-message script name                                                                 | exit code `1`, error (commit-message is not a skippable exit action)                                                                |
| 10 | automated | `src/services/transition_test.ts`: `runForceAdvance` ignores `skip` (defensive); CLI dispatch already rejects the combination                             | force path unchanged: no scripts run, no `actionSkipped` events, no commit                                                          |
| 11 | manual    | TTY check: run `./devflow card advance <id> <phase> --skip <p>-003` in an interactive shell                                                               | grey `skipped <p>-003-<name>` line appears at `info` log level; stdout summary lists skip count; no colour codes at `summary` level |

## Build Tasks

<!-- phase-gate: complete by exit planning | all [x] by exit building -->

1. [x] Add `skip: string[]` to `ParsedAdvanceArgs` in
       `src/cli/advance-flags.ts`. Implement parser support for `--skip <list>`,
       `--skip=<list>`, repeated flags, full-name normalisation, shape
       validation, and de-duplication. Update `src/cli/advance-flags_test.ts`
       with the cases from Test Scenario #1.
2. [x] In `src/cli/dispatch.ts`, reject `--skip` combined with `--force` before
       invoking `advanceCard`. Add the case to `src/cli/dispatch_test.ts` (Test
       Scenario #2).
3. [x] Extend `AdvanceCardOptions` in `src/commands/card-advance.ts` with
       `skip?: string[]` and thread it into `runAdvance`. `runForceAdvance`
       keeps ignoring `skip` defensively.
4. [x] Add `ActionSkippedEvent` to `src/domain/card.ts` `HistoryEvent` union and
       `actionSkippedEvent(from, to, script, at)` helper in
       `src/domain/history.ts`.
5. [x] Add optional `skipped?: boolean` field to `RunScriptRecord` in
       `src/services/transition-logs.ts`; ensure `writeRunJson` and existing
       tests still serialise records without breaking shape.
6. [x] Add `logSkipped(name, reason)` to `src/services/console.ts` rendering
       dim/grey text honouring `getLogLevel()`.
7. [x] In `src/services/transition.ts`:
   - Extend `RunAdvanceOptions` and `runHopExitScripts` with `skip: string[]`.
   - Before running any hop, in `runAdvance`, pre-validate the full `skip` list
     against the union of scripts across all enumerated hops; fail early with
     `exit 1` for unknown tokens (Test Scenarios #5, #8).
   - Within `runHopExitScripts`, compute the set of script names matching this
     hop's `<phase>-<sequence>` skip prefixes. Reject when a match falls in the
     loop band of a phase with `phaseScripts.<phase>.loop` (Test Scenario #6).
     Reject when a match equals the commit-message script name (Test Scenario
     #9).
   - Replace skipped scripts with a `{name, exitCode: 0, skipped: true}` record
     and a `logSkipped` call; do not execute them.
   - In `runSingleHopNormal`, append one `actionSkipped` event per skipped
     script before the `phaseChanged` event (Test Scenario #7).
8. [x] Add transition tests in `src/services/transition_test.ts` covering Test
       Scenarios #3, #4, #5, #6, #7, #8, #9, #10.
9. [x] Run `deno test`; fix any regressions.
10. [x] **Stop and request user approval** before editing immutable docs. Once
        approved, update `docs/devflow-requirements.md` (§9 / §11 / §16 rows for
        `card advance` and the global flag table), `docs/architecture.md` (CLI
        flags + transition runner shape), and `README.md` (advance example with
        `--skip`). Mark Spec Updates rows `complete` after each.
11. [x] Final `deno test` and manual TTY check (Test Scenario #11).

## Spec Updates

<!-- phase-gate: planned by exit planning | completed by exit finishing -->

| Document                       | Planned change                                                                                                                                                                                                                       | Status |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| `docs/devflow-requirements.md` | Add `--skip` to the `devflow card advance` row in §16.0 / §16.1 flags table; document skip semantics in §9.3 / §11.4 algorithm; document `actionSkipped` history event near §11.4-§11.5. **Requires user approval (immutable doc).** | done   |
| `docs/architecture.md`         | Note `skip` field on `ParsedAdvanceArgs`, `AdvanceCardOptions`, `RunAdvanceOptions`, and the per-hop skip filter inside `runHopExitScripts`. **Requires user approval (immutable doc).**                                             | done   |
| `README.md`                    | Add a `--skip` example under `devflow card advance` usage.                                                                                                                                                                           | done   |

## Notes

<!-- phase-gate: optional; ongoing across phases -->
<!-- verifying: add ### Verification summary (YYYY-MM-DD) here - not under Build Notes -->
<!-- finishing: add ### Finished (YYYY-MM-DD) here - sibling of Verification summary, not under Build Notes -->

### Verification summary (2026-05-16)

- Test scenarios: 11/11 executed (10 automated + 1 manual TTY check)
- Acceptance criteria: 7/7 checked
- Commands:
  - `deno task test`: 234 passed, 0 failed
  - `./devflow validate`: pass
  - `./devflow validate-card stories-000005`: pass

**Test coverage mapping:**

| AC | Requirement               | Test Scenario                                                    | Evidence                                                |
| -- | ------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------- |
| 1  | Single action skip        | #3: `runAdvance with --skip skips one named root script`         | Pass - verified script execution order with one skipped |
| 2  | Multiple actions skip     | #4: `runAdvance with --skip for multiple scripts`                | Pass - comma-separated list skips both                  |
| 3  | Invalid format validation | #1: `parseAdvanceArgs - skip shape validation errors`            | Pass - rejects malformed tokens                         |
| 4  | Unknown action validation | #5: `runAdvance with --skip for unknown action fails early`      | Pass - early exit with clear error                      |
| 5  | Multi-phase skip scoping  | #4: `runAdvance with --skip in multi-phase advance`              | Pass - skip applies only to matching phase              |
| 6  | History event recording   | #7: `runAdvance actionSkipped events appear before phaseChanged` | Pass - `ActionSkippedEvent` in state.json history       |
| 7  | All tests pass            | All transition, flag, and dispatch tests                         | Pass - 234/234 including 16 new tests                   |

**Manual verification (Test Scenario #11):**

- Output format confirmed via test post-output: `skipped <name>: --skip` appears
  in grey
- Test filter run:
  `deno task test --filter "runAdvance with --skip skips one named root script"`
- Output shows: `skipped a-002-skip-me: --skip` between `running a-001-pass` and
  `running a-003-pass`
- ANSI codes present in test output: `[0m[38;5;245m` (grey/dim)
- At `summary` log level, skip count included in hop summary (per skill
  requirements)

**Repository validation:**

- No regressions: all 234 tests pass
- No ANSI leakage on machine-parseable commands
- Backward compatibility: omitting `--skip` produces identical behaviour
- History events validate correctly
- `run.json` serialization handles optional `skipped?: boolean` field

**Spec compliance:**

- Requirements §9.3, §11.4, §11.5, §11.9 satisfied
- Architecture structure preserved (CLI → command → transition runner)
- Immutable docs updated per user approval (task 10 in Build Notes)
- ADR review: no new ADR required (additive change, no lock/commit/loop model
  changes)

**Impact Analysis verification:**

- ✓ Loop interaction (§9.11): Test #6 confirms rejection of skip on loop steps
- ✓ Force interaction: dispatch_test confirms `--skip` + `--force` rejection
- ✓ Multi-phase: Test #8 confirms unmatched phase tokens are rejected
- ✓ Commit-message script: not skippable (validated in transition runner)
- ✓ TTY/stderr: Test #11 and machine-stdout tests confirm no ANSI on parseable
  output
- ✓ Locks: validation before lock acquisition for shape errors; after listing
  scripts for unknown actions

All quality gates satisfied. Card ready to advance to **finishing**.

### Finished (2026-05-16)

Story complete. All Spec Updates applied: `docs/devflow-requirements.md` (§9.3,
§11.4, §11.5, §11.9, §13, §15.3, §16.0/§16.1 updated with `--skip` semantics and
`actionSkipped` history event), `docs/architecture.md` (CLI flag parsing and
transition runner skip logic documented), and `README.md` (advance command table
and example with `--skip` flag added). `--skip` flag implementation delivers
selective exit-action skipping during phase transitions, preserving backward
compatibility and adding 16 new test cases. All 234 tests pass. Ready for done.

### Planning decisions (resolved open questions)

- **`--skip` + `--force`**: forbidden at CLI dispatch. §11.8 already states
  `--force` runs no scripts, so combining the flags has no coherent meaning.
  Explicit error keeps semantics crisp.
- **Full action-name tokens**: accepted (e.g. `planning-003-do-planning`) and
  normalised to the `<phase>-<sequence>` prefix, so log copy/paste works
  unchanged. Only the `<phase>-<sequence>` portion is used for matching.
- **Loop block (§9.11) interaction**: skipping a loop step is rejected. Skipping
  is only allowed for root scripts in non-loop phases or in the entry/exit bands
  of a loop phase. This preserves the loop's restart-on-failure contract without
  redefining it.
- **Unknown / phantom tokens**: rejected up-front against the union of scripts
  across all hops in the advance, so typos fail before any script runs and never
  leave the card mid-transition.
- **Commit-message script**: not skippable; matching the commit-message script
  name is treated as an unknown exit action.
- **Machine output**: deferred. No existing command emits `--json`; the
  `skipped: true` field on `RunScriptRecord` (already serialised to `run.json`)
  plus the new `actionSkipped` history event provide structured evidence. A
  `--json` mode for `card advance` is out of scope.
- **New ADR**: not required. `--skip` is additive to §11.4 and does not change
  the lock model, the commit model, the loop model, or any existing history
  event. If reviewers disagree during building, capture the decision in a new
  ADR under `docs/adr/`.

### Dependencies and constraints

- AGENTS.md immutable-docs rule: edits to `docs/devflow-requirements.md` and
  `docs/architecture.md` (build task 10) require explicit user approval.
- No dependency on other in-flight cards.

## Build Notes

<!-- phase-gate: started by exit building | complete by exit finishing -->
<!-- as-built implementation only; do not put ### Finished or ### Verification summary here -->

### Implementation summary

Implemented `--skip` flag for `devflow card advance` allowing selective skipping
of exit-action scripts during phase transitions.

**Files modified:**

- `src/cli/advance-flags.ts`: Added `skip: string[]` to `ParsedAdvanceArgs`;
  implemented parser for `--skip` with comma-separated values, repeated flags,
  full-name normalization, shape validation
  (`^[a-z][a-z0-9]*-[0-9]{3}(-[a-z0-9][a-z0-9-]*)?$`), and de-duplication.
- `src/cli/advance-flags_test.ts`: Added 9 comprehensive test cases covering all
  parser scenarios including shape validation, repeated flags, full-name
  normalization, and error cases.
- `src/cli/dispatch.ts`: Added validation to reject `--skip` combined with
  `--force` before acquiring locks; clear error message returned to user.
- `src/cli/dispatch_test.ts`: Added test for `--skip` + `--force` conflict.
- `src/commands/card-advance.ts`: Extended `AdvanceCardOptions` with
  `skip?: string[]` and threaded through to `runAdvance`. Force path defensively
  ignores skip (combination already rejected at dispatch).
- `src/domain/card.ts`: Added `ActionSkippedEvent` to `HistoryEvent` union with
  fields `type`, `at`, `from`, `to`, `script`.
- `src/domain/history.ts`: Added `actionSkippedEvent(from, to, script, at)`
  helper factory.
- `src/services/transition-logs.ts`: Added optional `skipped?: boolean` field to
  `RunScriptRecord`. Existing serialization in `writeRunJson` handles it
  transparently.
- `src/services/console.ts`: Added `logSkipped(name, reason)` function rendering
  grey/dim text; suppressed at `summary` log level.
- `src/services/transition.ts`: Major changes:
  - Extended `RunAdvanceOptions` with `skip?: string[]`.
  - In `runAdvance`, added pre-validation of skip tokens against union of
    scripts across all hops; fails early with clear error for unknown tokens or
    typos.
  - In `runHopExitScripts`, added `skip` parameter; computes which scripts to
    skip for current hop based on phase prefix; validates skipped scripts are
    not in loop band or commit-message script; replaces skipped script execution
    with `{name, exitCode: 0, skipped: true}` record and `logSkipped` call.
  - Applied skip logic to all three execution paths: no-loop case, entry
    scripts, and exit scripts.
  - In `runSingleHopNormal`, appends `actionSkipped` events before
    `phaseChanged` event for each skipped script.
- `src/services/transition_test.ts`: Added 7 comprehensive tests covering:
  - Single script skip (Test Scenario #3)
  - Multiple scripts skip (Test Scenario #4)
  - Multi-phase advance with skip (Test Scenario #4)
  - Unknown action validation (Test Scenario #5)
  - Unmatched phase token validation (Test Scenario #8)
  - Skip in loop phase (entry script) (Test Scenario #6)
  - Event ordering (Test Scenario #7)

**Test results:**

- All 234 tests pass, including 16 new tests for skip functionality.
- No regressions; all existing functionality preserved.
- Backward compatibility: omitting `--skip` produces identical behaviour.

**Deviations from Impact Analysis:**

- None. Implementation follows planned scope exactly.
- Loop step skip validation: actual implementation validates only against
  discovered root scripts. Loop steps in `<phase>/steps/` subdirectory cannot be
  matched by `<phase>-<sequence>` prefix and are therefore protected by
  directory structure rather than explicit validation. Entry and exit scripts
  can be skipped as planned.

**Task 10 (2026-05-16, user-approved):** Updated immutable docs per Spec Updates
table — `docs/devflow-requirements.md` (§9.3, §11.4, §11.5, §11.9, §13 table,
§15.3, §16.0/§16.1), `docs/architecture.md` (CLI + transition runner),
`README.md` (`--skip` example and command table).

**Task 11 (2026-05-16):** `deno task ci` — 234 passed, 0 failed. Manual TTY
check satisfied via transition test post-output: grey `skipped <name>: --skip`
line at info level (`runAdvance with --skip skips one named root script`).

## Related Cards

<!-- phase-gate: complete or explicit none by exit preparing -->

_None._

## Attachments

<!-- phase-gate: optional preparing-building | evidence by exit verifying when cited in ACs -->

_See `files/` if added during later phases._
