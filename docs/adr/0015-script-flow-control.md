# ADR-0015: Script flow control via `NEXT_SCRIPT`

**Status:** Accepted\
**Date:** 2026-05-18

## Context

Phase retry workflows (e.g., stories **building**: pi → fmt → CI → scenarios)
were implemented with **legacy loop blocks** in `board.json` and child scripts
under `scripts/<phase>/steps/`
([ADR-0014](./0014-script-composition-and-loops.md)). That model requires:

- `phaseScripts.<phase>.loop` configuration (`steps`, `maxRounds`).
- Harness-only restart-on-failure and entry/loop/exit band partitioning.
- `invokeChildScript`, `DEVFLOW_SCRIPT_ROUND`, and `DEVFLOW_LOOP_MAX`.
- Loop-step skip restrictions
  ([§11.9](../devflow-requirements.md#119-selective-skip--skip)).

Board authors and operators want **flat root exit scripts** and **explicit flow
control in scripts** using existing card variables, without JSON loop
configuration or subdirectory step trees.

## Decision

Devflow will run exit scripts for a phase hop using a **script flow driver**
([§9.11](../devflow-requirements.md#911-script-flow-control-next_script)) unless
the phase still has **legacy loop configuration**
([§9.12](../devflow-requirements.md#912-legacy-phase-loop-blocks-deprecated)).

### 1. Card variable `NEXT_SCRIPT`

- Reserved name in card `state.json` `variables` (section 7).
- Value: `<phase>-<sequence>` prefix (same token form as `--skip`).
- Must resolve to **exactly one** root exit script in the hop's `from` phase.
- Set by scripts with `devflow variable set ... --ignore-lock` on exit **0**.
- Harness **clears** the variable when consuming a valid jump; **does not
  clear** on validation failure (operator may fix and re-run `card advance` to
  resume).

### 2. Driver semantics

- **Hop entry:** If `NEXT_SCRIPT` unset → start at first lexical root script; if
  set → validate, clear, start at resolved script.
- **After each script exits 0:** If `NEXT_SCRIPT` set → validate, clear, record
  `nextScript` in `run.json`, jump; else advance to lexicographic successor; if
  none → exit-script pass complete.
- **Non-zero exit:** Fail transition immediately; ignore `NEXT_SCRIPT`.
- **Self-jump and backward jump:** Allowed; scripts enforce retry limits via
  other variables (e.g. `BUILD_ROUND`).
- **`--skip`:** When a resolved target is in the skip set, record
  `skipped: true`, do not execute, continue at lexical successor (section 11.9).

### 3. Execution cap

- `board.json` optional `maxScriptExecutionsPerHop` (default **100**).
- Counts each driver iteration (including skipped visits) per hop.
- On exceed, fail transition with diagnostic message.

### 4. Coexistence and removal

- Phases with `phaseScripts.<phase>.loop` continue using legacy loop execution
  until product code and docs for loop blocks are removed.
- [ADR-0014](./0014-script-composition-and-loops.md) is **superseded** by this
  ADR for new boards; hierarchical helpers and non-auto-run subdirectories
  remain valid (section 9.1).

### 5. Implementation placement

- **Transition runner** (`src/services/transition.ts`): `runScriptFlowDriver`
  (or equivalent) called from `runHopExitScripts` when no legacy loop config.
- **Domain** (`src/domain/script-names.ts`):
  `resolveScriptPrefix(prefix, scripts)` → exactly one match or error.
- **Board config** (`src/domain/board.ts`): parse `maxScriptExecutionsPerHop`.
- **Variable service**: read/clear `NEXT_SCRIPT` under card lock during
  transition.

## Consequences

**Positive**

- Flat `phase-NNN-*` scripts only; no loop JSON or `building/steps/` for new
  workflows.
- Retry policy lives in scripts (visible, testable bash).
- Resume mid-phase via pre-set `NEXT_SCRIPT` before `card advance`.
- Structured `nextScript` in `run.json` replaces loop round metadata for new
  model.

**Negative**

- Scripts must exit **0** to continue even when signalling failure to retry (set
  `NEXT_SCRIPT` then exit 0).
- Runaway jump cycles possible; mitigated by execution cap, not harness round
  limits.
- Dual code paths (driver vs legacy loop) until loop removal story completes.

## References

- Requirements
  [§9.11](../devflow-requirements.md#911-script-flow-control-next_script)
- Requirements
  [§9.12](../devflow-requirements.md#912-legacy-phase-loop-blocks-deprecated)
  (deprecated)
- Requirements [§11.4](../devflow-requirements.md#114-transition-algorithm)
- Requirements [§11.9](../devflow-requirements.md#119-selective-skip--skip)
- [ADR-0008](./0008-transition-runner-orchestration.md) — transition runner
- [ADR-0014](./0014-script-composition-and-loops.md) — superseded for loop
  blocks
