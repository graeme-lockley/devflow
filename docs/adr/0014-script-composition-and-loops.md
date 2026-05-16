# ADR-0014: Script composition and phase loops

**Status:** Accepted\
**Date:** 2026-05-16

## Context

Boards with multi-step validation cycles (e.g., stories **building** → pi
implementation → CI → Test Scenarios) embed retry loops inside monolithic bash
scripts because Devflow
([§9.8](../devflow-requirements.md#98-execution-unit-and-retries)) forbids
cross-script retries. This causes:

1. **Monolithic scripts:** The stories board `building-002-do-build` is ~160
   lines of bash orchestrating pi, `deno task ci`, and scenario tests—obscuring
   the actual steps and making logs harder to parse.
2. **Duplicate gates:** Steps like `deno task ci` appear both inside the loop
   (retriable) and as separate exit scripts (`building-006-run-ci`) because the
   flat script model has no concept of entry/loop/exit groups.
3. **Poor observability:** Logs do not show round boundaries unless the script
   emits them; structured logging (run.json) cannot represent loop metadata.
4. **Maintainability burden:** Adding a new loop step requires editing the
   monolithic script; board authors cannot compose smaller, testable steps.

Requirements ([§9.3](../devflow-requirements.md#93-script-execution-order))
define discovery for flat scripts only; there is no spec for helper scripts,
child steps, or loop configuration.

## Decision

Devflow will support **hierarchical script composition** and **phase-level loop
blocks** with the following mechanisms:

### 1. Helper scripts and directories

- Boards may place **non-executable helper scripts** or **subdirectories** under
  `scripts/` without triggering auto-discovery; only **root exit scripts**
  matching the existing pattern `^<phase>-[0-9]{3}-[a-z0-9][a-z0-9-]*$` and
  marked executable are automatically run.
- **Child scripts** (steps invoked by root scripts) follow a hierarchical naming
  convention:
  - **Option A (nested path):** `scripts/building/steps/01-pi.sh`,
    `steps/02-gate-ci.sh`—invoked by a thin root script
    `building-002-build-loop`.
  - **Option B (hyphenated):** `scripts/building-002-01-pi`,
    `building-002-02-gate-ci`—matched by extended pattern
    `^<phase>-<parent-NNN>-[0-9]{2}-[a-z0-9][a-z0-9-]*$` and invoked by parent
    only.
  - **Implementation:** Use **Option A** (nested paths) for the stories board;
    allow either pattern for board authors. Devflow will not auto-run child
    scripts (executable bit and name pattern do not imply auto-execution unless
    also matching root script pattern).
- Helper libraries (e.g., `building/lib/common.sh`) remain non-executable and
  are sourced by scripts as before.

### 2. Loop blocks

- Boards may configure a **loop block** for a phase by adding a `phaseScripts`
  map in `board.json`:

  ```json
  "phaseScripts": {
    "building": {
      "loop": {
        "steps": ["building-002-01-pi", "building-002-02-gate-ci", "building-002-03-gate-scenarios"],
        "maxRounds": 5
      }
    }
  }
  ```

  Or, alternatively, nest configuration under the root script:

  ```json
  "phaseScripts": {
    "building": {
      "entry": ["building-001-check-entry"],
      "loop": {
        "script": "building-002-build-loop",
        "steps": ["steps/01-pi.sh", "steps/02-gate-ci.sh", "steps/03-gate-scenarios.sh"],
        "maxRounds": 5
      },
      "exit": ["building-003-check-exit"]
    }
  }
  ```

  **Decision for v1**: Use **flat `loop.steps` array** in `board.json` with step
  script paths relative to `scripts/`; omit `entry` / `exit` keys unless a
  future story requires explicit grouping beyond the default (all non-loop root
  scripts). Phases without loop config fall back to flat lexical discovery
  (backward compatible).

- **Loop semantics**:
  - Devflow runs each step in `loop.steps` sequentially; any step exiting
    non-zero causes the loop to **restart from the first step**.
  - If all steps exit 0, the loop completes and Devflow proceeds to remaining
    exit scripts.
  - If `maxRounds` is reached with a failure, the transition fails.
  - Round counter is 1-indexed (round 1, round 2, …).
  - Each step invocation sets `DEVFLOW_SCRIPT_ROUND` (current round) and
    `DEVFLOW_LOOP_MAX` (max rounds) in env.

### 3. Execution environment for child scripts

- Child scripts (invoked by root or by loop orchestrator) receive the same env
  as root scripts
  ([§18](../devflow-requirements.md#18-environment-variables-for-scripts))
  **plus**:
  - `DEVFLOW_SCRIPT_PARENT` — name of the invoking script (for logging).
  - `DEVFLOW_SCRIPT_ROUND` — current loop round (1-indexed), or unset if not in
    loop.
  - `DEVFLOW_LOOP_MAX` — max rounds configured for the loop, or unset.
- `cwd`, shebang handling, signal forwarding, and log streaming remain unchanged
  (ADR-0007, ADR-0010).

### 4. Discovery and invocation changes

- **Script service** (`src/services/scripts.ts`):
  - `listExitScripts(board, phase)` filters for **root scripts only** unless
    loop config specifies step paths.
  - New `invokeChildScript(script, board, card, parentName, round?, maxRounds?)`
    sets `DEVFLOW_SCRIPT_PARENT`, `DEVFLOW_SCRIPT_ROUND`, `DEVFLOW_LOOP_MAX`.
- **Transition runner** (`src/services/transition.ts`):
  - Reads `board.phaseScripts[phase].loop` if present.
  - Runs entry scripts (if specified or all non-loop root scripts), then loop
    orchestrator, then exit scripts.
  - On loop failure, emits structured error with round and failing step name.
- **Logging**:
  - Loop boundaries logged at info level: `"round 1/5: starting"`,
    `"round 1/5:
    step building-002-01-pi"`.
  - Transition logs (`run.json`) nest loop steps under `"loop"` key with
    `rounds` array.

### 5. Backward compatibility

- Boards with **no `phaseScripts` config** continue using flat script discovery;
  behaviour is unchanged.
- Boards that configure `phaseScripts` opt into the new model for that phase
  only.
- Requirement ([§9.8](../devflow-requirements.md#98-execution-unit-and-retries))
  updated to say "no cross-script retries **unless in a configured loop
  block**."

## Consequences

**Positive**

- Board scripts become **composable**: root orchestrator + reusable steps.
- Retry logic is **declarative** (`maxRounds` in `board.json`) instead of
  embedded bash `for` loops.
- Transition logs gain **structured round metadata** (run.json, human logs).
- Stories board `building-002-do-build` replaced with thin
  `building-002-build-loop` + step files (~20 lines each), dramatically
  improving maintainability.
- Future boards (e.g., code-review, qa) can reuse the loop pattern without
  copy-pasting bash orchestration.

**Negative**

- Discovery logic becomes more complex (root vs child scripts, loop config
  parsing).
- Loop semantics must be carefully documented (when restart happens, what
  "maxRounds exhausted" means).
- Boards in mid-flight with custom `building-002` loops need refactoring (but
  stories is the only board; this story refactors it).
- `board.json` schema gains optional `phaseScripts` (must validate or reject
  malformed config on `devflow validate-board`).

**Risks**

- If `board.json` loop config is invalid, card advance must fail fast (validate
  before invoking any scripts).
- Loop scripts that modify card state must be **idempotent** (pi edits `card.md`
  multiple times); document this in board authoring guide (README).
- Infinite loops if step never fails but also never satisfies exit conditions;
  mitigate with `maxRounds` hard cap and operator awareness (`DEVFLOW_SKIP_PI`
  escape hatch).

## Alternatives considered

1. **Bash-only loops with no Devflow change:** Keep monolithic scripts; improve
   by extracting bash functions into `building/lib/*.sh`.
   - **Rejected:** Does not solve observability, structured logging, or
     discoverability issues.
2. **Declarative retry on individual scripts:** Add `"retry": 3` flag per script
   in `board.json`.
   - **Rejected:** Does not support "restart from first step" semantics (needed
     for pi → CI → scenarios where pi fixes cascade to later steps).
3. **`devflow script run` with explicit loop command:**
   `devflow script loop
   building-002 --max 5 --steps "01,02,03"`.
   - **Rejected:** Moves orchestration to CLI syntax instead of board
     configuration; not self-documenting in `board.json`.

## References

- Requirements [§9](../devflow-requirements.md#9-script-model) (Script Model —
  extend §9.1–9.3, §9.7–9.9)
- Requirements [§11.4](../devflow-requirements.md#114-transition-algorithm)
  (Transition algorithm)
- Requirements
  [§18](../devflow-requirements.md#18-environment-variables-for-scripts)
  (Environment variables)
- [`architecture.md` §5.3](../architecture.md#53-transition-runner-srcservicestransitionts)
  (Transition runner)
- [`architecture.md` §5.4](../architecture.md#54-script-service-srcservicesscriptsts)
  (Script service)
- [ADR-0007](./0007-script-invocation.md) (Direct script execution with shebang)
- [ADR-0008](./0008-transition-runner-orchestration.md) (Dedicated transition
  runner service)
- Stories card
  [`stories-000003`](../../.devflow/boards/stories/cards/stories-000003/card.md)
  (this feature's specification)
