# Have pi show its workings when running devflow

<!-- phase-gate: complete by exit preparing -->

As a developer running Devflow transitions that invoke **pi** for story skills, I
want to see the model's deliberation, tool use, and progress (like the native pi
TUI) while Devflow orchestrates phase scripts, so that I know what is happening,
can debug skills effectively, and can follow the reasoning to learn how the
solution is produced.

## Current State

<!-- phase-gate: complete by exit preparing -->
<!-- preparing: factual as-is; cite repo paths (src/, docs/) -->

- Devflow invokes board scripts during phase transitions; scripts on the
  stories board call **`pi`** (pi-mono) with a skill path and a one-shot prompt.
  Every pi invocation found under
  [`.devflow/boards/stories/scripts/`](../../../../../.devflow/boards/stories/scripts/)
  uses **`--print`** (e.g.
  [`preparing-002-do-create-story`](../../../../../.devflow/boards/stories/scripts/preparing-002-do-create-story),
  [`planning-003-do-planning`](../../../../../.devflow/boards/stories/scripts/planning-003-do-planning),
  [`building/steps/01-pi.sh`](../../../../../.devflow/boards/stories/scripts/building/steps/01-pi.sh),
  and the `*.commit-message` scripts). The operator typically sees only brief
  script log lines (e.g. grey `invoking pi (build-story)…`) and then silence
  until pi exits—no thinking, reasoning, or step-by-step execution stream.
- [`src/services/scripts.ts`](../../../../../src/services/scripts.ts) runs child
  scripts with **piped** stdout/stderr and optionally streams captured output to
  the console when `DEVFLOW_LOG_LEVEL` is `info` or `verbose` (see
  [`src/services/transition.ts`](../../../../../src/services/transition.ts),
  [ADR-0011](../../../../../docs/adr/0011-console-output-levels.md)). In
  **`summary`** mode (`--summary`), script output is not streamed (only phase
  lines and errors). Commit-message script stdout is never streamed per spec.
- Requirements ([§10.1](../../../../../docs/devflow-requirements.md)) treat
  pi-mono as external: Devflow does not install or configure it; board scripts
  own model, timeout, and invocation flags. There is **no** documented contract
  today for surfacing pi's interactive/TUI-style deliberation through Devflow.
- Running **`pi` directly** in a terminal exposes rich progress (thinking,
  tool calls, execution). That experience is **not** carried through when pi is
  launched as a subprocess of a Devflow transition—operators report a "black
  box" wait with poor observability and weak skill-debugging signal.

## Objectives

<!-- phase-gate: complete by exit preparing -->
<!-- preparing: numbered list, 3–10 outcomes -->

1. **Observable pi runs** — When Devflow invokes pi during a transition (default
   `info` / `verbose` log levels, interactive terminal), the operator sees
   meaningful live output: model reasoning/thinking, tool use, and execution
   progress comparable to the native pi TUI experience.
2. **Script and harness alignment** — Stories-board pi scripts (and mirrored
   [`templates/stories/scripts/`](../../../../../templates/stories/scripts/))
   invoke pi in a way compatible with streaming/deliberation visibility (not only
   `--print` batch mode if that suppresses the TUI).
3. **Respect existing output modes** — `summary` mode and commit-message
   non-streaming rules ([§16.2](../../../../../docs/devflow-requirements.md),
   ADR-0011) remain valid; pi visibility is defined for modes where operators
   expect script output.
4. **CI and skip paths unchanged** — `DEVFLOW_SKIP_PI=1` and environments
   without pi on `PATH` continue to behave as today (skip or fail fast with
   clear errors).
5. **Documented operator behaviour** — README or board script docs explain what
   to expect when pi runs under Devflow (TTY requirements, flags, log levels).
6. **Testable contract** — Automated or scripted checks where feasible (e.g.
   transition logs capture pi output; tests for streaming/pipe behaviour) so
   regressions to silent pi runs are caught.

## Spec References

<!-- phase-gate: draft by exit preparing | complete by exit planning -->
<!-- preparing: ≥1 line `- [ ] \`path\` — section`; planning: mark verified items `[x]` -->

_Specification and architecture pointers. Use paths and section anchors._

- [ ] `docs/devflow-requirements.md` — §10.1 (pi-mono integration), §16.2
      (console output levels / script streaming), §18 (`DEVFLOW_LOG_LEVEL`)
- [ ] `docs/architecture.md` — script invocation and console output (§5.9 area)
- [ ] `docs/adr/0011-console-output-levels.md` — streaming vs summary behaviour
- [ ] `docs/adr/` — new ADR if pi invocation/TUI passthrough is a significant
      harness decision; N/A until planning

## Acceptance Criteria

<!-- phase-gate: draft by exit preparing | complete by exit planning | all [x] by exit verifying -->

1. [ ] Given a TTY and default `info` logging, when I `./devflow card advance`
       through a phase that runs pi (e.g. preparing → planning with pi on PATH),
       I see **live** pi deliberation/output (thinking, tools, or equivalent
       progress) on the console—not only a start banner and a long silent wait.
2. [ ] Given `--verbose`, pi visibility is at least as informative as in `info`
       (no regression vs objective 1).
3. [ ] Given `--summary`, behaviour matches ADR-0011: no script/pi stream to
       console; transition still succeeds and output remains in `logs/` under the
       card.
4. [ ] Given `DEVFLOW_SKIP_PI=1`, pi is not invoked and existing skip messages
       still apply; `deno task test` / CI paths remain green.
5. [ ] All stories-board pi entry scripts (preparing, planning, building loop,
       verifying, finishing, and phase commit-message scripts where applicable)
       use the agreed invocation pattern; `templates/stories/` stays in sync.
6. [ ] Operator documentation states how to get pi visibility under Devflow and
       any constraints (TTY, `DEVFLOW_SKIP_PI`, log level).
7. [ ] `deno task test` passes; any new tests for script streaming or pi output
       paths pass.

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

- **Hypothesis:** `--print` on pi forces non-interactive/batch output and is the
  primary reason deliberation is hidden; planning should confirm against pi CLI
  docs and experiment with TTY passthrough vs structured stream flags.
- **Harness question:** Does pi need a real TTY (`script`, `pty`) for the TUI,
  or can it emit a text stream Devflow forwards? Trade-offs for piped subprocess
  vs `inherit` stdio affect log capture under `cards/.../logs/`.
- **Commit-message scripts** may stay quiet on console per §13.4 even if other
  pi invocations become verbose—plan should call out scope explicitly.
- **Non-goals (preparing):** Changing skill contents, model choice, or Devflow
  core LLM runtime (pi remains external per §10.1).

## Build Notes

<!-- phase-gate: started by exit building | complete by exit finishing -->
<!-- as-built implementation only; do not put ### Finished or ### Verification summary here -->

_To be completed in building._

## Related Cards

<!-- phase-gate: complete or explicit none by exit preparing -->

- [stories-000001](stories-000001/card.md) — console colours and TTY-aware
  output; informs how Devflow presents human-readable stderr.
- [stories-000003](stories-000003/card.md) — stories board script layout,
  building loop, and pi step (`building/steps/01-pi.sh`).
- [stories-000006](stories-000006/card.md) — remote/JSR distribution; pi behaviour
  should remain consistent when Devflow is run from a consumer repo.

## Attachments

<!-- phase-gate: optional preparing–building | evidence by exit verifying when cited in ACs -->

_Screenshots, logs, or files under `files/`._
