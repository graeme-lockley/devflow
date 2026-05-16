# Enable native support for script loops

As a board author and Devflow operator, I want **phase script loops and
hierarchical script composition** to be defined in the product specification and
implemented in the core CLI, so that boards (starting with **stories**) can run
multi-step build/verify cycles—such as `pi` → CI → scenario tests—with **explicit,
composable scripts** instead of hiding the loop inside a single large bash file.

This story is a **specification and core-product change**: it requires updating
`docs/devflow-requirements.md` (authoritative behaviour), `docs/architecture.md`,
at least one new ADR, and refactoring the stories board **building** scripts to
use the new model.

## Current State

<!-- phase-gate: complete by exit preparing -->

- **Script discovery** (`src/domain/script-names.ts`, `src/services/scripts.ts`)
  lists only **flat, executable files** in `.devflow/boards/<board>/scripts/`
  matching `^<phase>-[0-9]{3}-[a-z0-9-]*$` (req §9.3). Subdirectories are ignored.
- **Execution** is strictly **linear**: Devflow runs exit scripts in lexical order
  once per hop; exit non-zero stops the transition; **no retries** (req §9.7–9.8).
- The **transition runner** (`src/services/transition.ts`, ADR-0008) has no concept
  of entry / loop / exit script groups—only a flat ordered list per phase.
- The **stories** board **building** phase uses seven exit scripts plus
  `building-lib.sh` and `building.commit-message`. The retry loop (pi + `deno task
  ci` + Test Scenarios) lives entirely inside `building-002-do-build` (~160 lines),
  with duplicate gates in `building-004` / `building-006` (req §9.8 prevents
  looping across scripts).
- **Board config** (`board.json`) stores `phases` only; there is no schema for
  per-phase script groups or loop configuration.
- **`devflow script run`** does not exist; scripts cannot be exercised in isolation
  outside `card advance` (req §9.8).

## Objectives

<!-- phase-gate: complete by exit preparing -->

1. **Extend requirements §9** so helper scripts may live under
   `scripts/<phase>/` (or equivalent) without being auto-run, and **child scripts**
   use hierarchical names (e.g. `building-002-01-pi`) invoked only by a **root**
   orchestrator (`building-002-build-loop`).
2. **Introduce a first-class loop block** for a phase (configured in `board.json`
   or documented manifest) so Devflow runs `entry → loop(steps, max rounds) → exit`
   with `DEVFLOW_*_ROUND` (and related env) set each iteration—without bash `for`
   in a monolithic script.
3. **Implement** discovery, invocation, logging, and failure semantics in core
   (`script-names`, `scripts`, `transition`) per the updated spec.
4. **Add ADR(s)** for script composition and loop orchestration; link superseded
   nuances in ADR-0007 / ADR-0008 where the runner behaviour changes.
5. **Refactor** `.devflow/boards/stories/scripts/` building phase to the new layout
   (thin exit scripts + `building/` tree of steps/gates) as the reference board.
6. **Preserve** backward compatibility for boards that keep flat `phase-NNN-*`
   scripts with no loop configuration (planning, preparing, verifying unchanged
   unless optionally migrated later).

## Spec References

<!-- phase-gate: draft by exit preparing | complete by exit planning -->

- [x] `docs/devflow-requirements.md` §9 (Script Model) — extend §9.1–9.3 (paths,
      root vs child scripts, helper files), §9.7–9.9 (loop exit semantics, env,
      logging); amend §9.8 (retries scoped to loop blocks); §11.4 (transition
      algorithm); §18 (`DEVFLOW_SCRIPT_ROUND`, `DEVFLOW_LOOP_MAX`, etc.).
      Verified anchors: §9 (line 580), §9.1 (582), §9.2 (590), §9.3 (608),
      §9.7 (689), §9.8 (700), §9.9 (709), §11.4 (831), §18 (1529).
- [x] `docs/devflow-requirements.md` §5.4 / `board.json` — optional `phaseScripts`
      or `loop` configuration on boards (exact shape fixed during build).
      Verified anchor: §5.4 Board configuration file (line 264).
- [x] `docs/architecture.md` — `src/services/transition.ts` (§5.3, line 171),
      `src/services/scripts.ts` (§5.4, line 186); `src/domain/script-names.ts`
      and `src/domain/board.ts` documented within the domain layer section;
      transition logs covered alongside the runner.
- [ ] `docs/adr/` — **new ADR-0014** (script composition and phase loops) to be
      created; existing ADR-0007 (`docs/adr/0007-script-invocation.md`) and
      ADR-0008 (`docs/adr/0008-transition-runner-orchestration.md`) verified
      present and will receive cross-references.
- [x] `docs/implementation-roadmap.md` — present; will add milestone for
      script-loop feature.
- [x] `README.md` — present; will document hierarchical script layout and
      optional loop config for board authors.

## Acceptance Criteria

<!-- phase-gate: draft by exit preparing | complete by exit planning | all [x] by exit verifying -->

1. [ ] Requirements §9 documents helper script directories, hierarchical child
       script naming, and which files Devflow auto-runs vs parent-invoked only.
2. [ ] Requirements describe loop blocks (max rounds, step list, failure behaviour)
       and how they interact with linear exit scripts (entry / exit groups).
3. [ ] `devflow card advance` on a test board runs a configured loop: failed step
       retries from the first loop step until max rounds, then fails the
       transition; success proceeds to exit scripts and commit.
4. [ ] Transition logs (`output.log`, `run.json`) record **round** and **step**
       boundaries (human-visible in default log level).
5. [ ] Stories board **building** phase uses composable scripts (no monolithic
       `building-002` bash loop); behaviour matches today: entry git check →
       pi + CI + scenario gates in loop → card/spec/git exit checks →
       `building.commit-message`.
6. [ ] `deno test` covers script-name parsing, loop driver (unit), and at least
       one integration test for multi-round failure/success.
7. [ ] `devflow validate` / `devflow validate-board stories` pass with the updated
       stories board layout.
8. [ ] ADR-0014 accepted; ADR-0007 and ADR-0008 reference the new model where
       behaviour diverges from the original “flat list only” description.

## Impact Analysis

<!-- phase-gate: complete by exit planning -->

### Scope

- **Requirements (explicit change)** — `docs/devflow-requirements.md` §9, §11.4,
  §18; board config sections; examples under §19 if present.
- **Architecture** — `docs/architecture.md` script and transition sections.
- **ADRs** — new `docs/adr/0014-script-composition-and-loops.md`; README index row;
  light edits to ADR-0007 / ADR-0008 “References” / “Consequences” only (no silent
  contradiction).
- **Core**
  - `src/domain/script-names.ts` — root vs child patterns; sort order.
  - `src/services/scripts.ts` — `listExitScripts`, `invokeScript`, optional
    `invokeChildScript` with parent context in env.
  - `src/services/transition.ts` — loop driver; round logging; integrate with
    `transition-logs.ts`.
  - `src/domain/board.ts` (+ tests) — parse optional `phaseScripts` / loop config;
    validate shape on `devflow validate-board`.
  - `src/commands/validate-board-cmd.ts` (and related) — orphan script warnings.
  - Optional: `src/commands/script-run-cmd.ts` + dispatch if `devflow script run`
    is in scope for this story (otherwise defer with Notes).
- **Templates** — `templates/stories/scripts/`, `templates/stories/board.json`
  (if template carries loop config).
- **Stories board** — replace flat `building-00N-*` + `building-lib.sh` with:
  - `building-001-check-entry`, `building-002-build-loop` (thin),
    `building-003-check-exit`, `building.commit-message`
  - `building/_common.sh`, `building/log.sh`, `building/run-round.sh`,
    `building/steps/01-pi.sh`, `02-gate-ci.sh`, `03-gate-scenarios.sh`,
    `building/gates/card-md.sh`, `spec-updates.sh`, `git-scope.sh`
- **Tests** — `script-names_test.ts`, `scripts_test.ts`, `transition_test.ts`,
  new loop integration test; update `stories-workflow_test.ts` if needed.

### Risks and constraints

- **Breaking change risk** — Low for boards using only flat scripts if loop config
  is optional; medium for stories board authors mid-flight (building script paths
  change).
- **Lexical ordering** — Child scripts must not match root discovery; spec must be
  unambiguous (`building-002-01-*` not auto-run at top level).
- **Idempotency** — Loop retries re-run pi/CI; cards may be partially updated;
  document operator expectation (same as today’s bash loop).
- **Locks** — Loop body runs inside one hop; card lock held for entire loop
  (possibly longer than today); align with ADR-0010 signal forwarding.
- **Machine output** — No change to `card advance` stdout contract (req §16.4);
  loop detail on stderr / logs only.
- **Immutable docs** — This story **is authorised** to edit requirements,
  architecture, and add ADR-0014 per user direction; not a drive-by doc edit.

## Test Scenarios

<!-- phase-gate: complete by exit planning | executed by exit verifying -->

| # | Type      | Scenario                                                                                                                                 | Expected                                                                                    |
| - | --------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1 | automated | `deno test src/domain/script-names_test.ts` — root vs child name classification                                                        | Child `building-002-01-pi` not listed as root exit script; `building-002-build-loop` is.   |
| 2 | automated | `deno test src/services/transition_test.ts` (or new `transition-loop_test.ts`) — mock scripts, loop max 3, step 2 fails twice then passes | Three rounds logged; transition succeeds; `run.json` lists scripts per round.               |
| 3 | automated | `deno test src/services/transition_test.ts` — loop exhausts max rounds                                                                   | Transition fails; card phase unchanged; failure cites loop and last failing step.          |
| 4 | automated | `deno test src/services/scripts_test.ts` — child invocation inherits `DEVFLOW_*` and parent `DEVFLOW_SCRIPT_PARENT`                      | Child sees card dir and run dir; exit code propagated.                                      |
| 5 | automated | `deno test src/commands/stories-workflow_test.ts` with `DEVFLOW_SKIP_PI=1` — stories board building hop uses new layout                  | Advance building→verifying succeeds on fixture card with stub implementation.               |
| 6 | automated | `deno test` full suite                                                                                                                   | All tests pass; no regressions in planning/preparing linear scripts.                        |
| 7 | manual    | Given stories-000003 (or fixture card) in building, when I `./devflow card advance … verifying` with verbose logging                     | Log shows `round 1/N`, step script names, then exit scripts; commit on success.            |
| 8 | manual    | Given a board with only flat `planning-001`… scripts and no loop config, when I advance planning→building                                | Behaviour unchanged from pre-story baseline.                                                |

## Build Tasks

<!-- phase-gate: complete by exit planning | all [x] by exit building -->

1. [ ] Draft **ADR-0014** (script composition and phase loops); update
       `docs/adr/README.md`; add References in ADR-0007 / ADR-0008.
2. [ ] Update **`docs/devflow-requirements.md`** §9, §11.4, §18 (and board.json
       sections) with helper paths, hierarchical scripts, loop blocks, retry
       semantics, and logging requirements.
3. [ ] Update **`docs/architecture.md`** to describe the new script/transition
       flow and module responsibilities.
4. [ ] Extend **`src/domain/board.ts`** (and types) for optional per-phase
       `entry` / `loop` / `exit` script configuration; validate in
       `validate-board`.
5. [ ] Implement **`src/domain/script-names.ts`** root/child patterns and tests.
6. [ ] Implement **`src/services/scripts.ts`** child invocation and env vars.
7. [ ] Implement **loop driver** in `src/services/transition.ts` + log headers in
       `transition-logs.ts`; wire `DEVFLOW_SCRIPT_ROUND` / `DEVFLOW_LOOP_MAX`.
8. [ ] Add **`deno test`** coverage for items in Test Scenarios 1–4 (and 6).
9. [ ] Refactor **`.devflow/boards/stories/scripts/`** building phase to
       `building-001` / `002-build-loop` / `003-check-exit` + `building/` subtree;
       remove obsolete `building-004`–`007` and monolithic `building-lib.sh`
       (split into `building/lib/*`, `steps/*`, `gates/*`).
10. [ ] Update **`templates/stories/`** to match; ensure `stories-workflow_test`
        still passes.
11. [ ] Update **`docs/implementation-roadmap.md`** with milestone checklist.
12. [ ] Update **`README.md`** for board authors (script layout + loop config).
13. [ ] Run `deno task ci` and `./devflow validate`; fix regressions.

## Spec Updates

<!-- phase-gate: planned by exit planning | completed by exit finishing -->

| Document                            | Planned change                                                                                                                                 | Status  |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `docs/devflow-requirements.md`      | §9 Script Model (helpers, hierarchical children, loop blocks, env); §11.4 transition algorithm; §18 env vars; board config; §9.8 retry scope. | pending |
| `docs/architecture.md`              | Script discovery, child invocation, transition loop orchestration, validate-board.                                                          | pending |
| `docs/adr/0014-script-composition-and-loops.md` | **New** — decisions for loops, root/child scripts, logging, backward compatibility.                                            | pending |
| `docs/adr/README.md`                | Index row for ADR-0014.                                                                                                                        | pending |
| `docs/adr/0007-script-invocation.md` | Add note: child scripts invoked by parent with same env + `DEVFLOW_SCRIPT_PARENT`.                                                          | pending |
| `docs/adr/0008-transition-runner-orchestration.md` | Add loop block orchestration to Decision / References.                                                                                  | pending |
| `docs/implementation-roadmap.md`    | Milestone tasks for script loops feature.                                                                                                      | pending |
| `README.md`                         | Document authoring hierarchical scripts and optional loop config on boards.                                                                  | pending |

## Notes

<!-- phase-gate: optional; ongoing across phases -->

**Planning verification (this pass):**

- Spec References cross-checked against the repo on 2026-05-16. All target
  files exist; all referenced requirements anchors (§5.4, §9, §9.1–§9.3,
  §9.7–§9.9, §11.4, §18) are present at the expected headings. Architecture
  modules called out (`script-names`, `scripts`, `transition`, `board`) are
  all present in `src/domain/` and `src/services/`.
- ADR-0014 row left unchecked because the file does not yet exist; creating
  it is the first Build Task and tracked in Spec Updates.
- **Immutable-docs note** — this story explicitly authorises edits to
  `docs/devflow-requirements.md`, `docs/architecture.md`, and the addition of
  a new ADR (per Objectives §1, §4 and Impact Analysis “Risks and
  constraints”). The AGENTS.md rule still applies: changes land in this
  story only, with the user’s prior approval recorded in the card itself.

**Design decisions (from planning discussion):**

- Prefer **`building-002-01-*` hyphen form** over `building-002.01` (portable,
  matches existing `phase-NNN-` culture).
- **Root scripts only** are discovered by Devflow; children live at
  `scripts/building/steps/` OR as `building-002-NN-name` files invoked only by
  `building-002-build-loop`—exact layout fixed when §9 is drafted.
- **Loop body** (retriable): pi, `deno task ci`, card Test Scenarios (with
  `deno test` allow flags). **Exit body** (non-retriable): card-md, spec-updates,
  git-scope—mirrors current stories building behaviour.
- **`devflow script run`** is optional for this story; include only if milestone
  capacity allows—otherwise a follow-up card.
- **Backward compatibility**: boards without `loop` in config keep today’s flat
  lexical script list.

**Dependencies:**

- Completing this story simplifies maintenance of stories-000001 / 000002 style
  cards; not a hard dependency on those cards being open.

**Open questions:**

- Whether loop config lives in **`board.json`** only vs optional
  `scripts/building.manifest.json`—default recommendation: `board.json`
  `phaseScripts.building` object for visibility in `devflow board show`.

## Build Notes

<!-- phase-gate: started by exit building | complete by exit finishing -->

_To be completed in building._

## Related Cards

<!-- phase-gate: complete or explicit none by exit preparing -->

- **stories-000001**, **stories-000002** — motivated the current bash loop in
  `building-002-do-build`; this story replaces that pattern with native Devflow
  support.

## Attachments

<!-- phase-gate: optional preparing–building | evidence by exit verifying when cited in ACs -->

_None._
