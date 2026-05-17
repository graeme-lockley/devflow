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
  script log lines (e.g. grey `invoking pi (build-story)...`) and then silence
  until pi exits-no thinking, reasoning, or step-by-step execution stream.
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
  launched as a subprocess of a Devflow transition-operators report a "black
  box" wait with poor observability and weak skill-debugging signal.
- **`pi-render.sh` is implemented** (building in progress) and streams
  deliberation via `pi --mode json`, but **tool-call lines are still noisy**:
  `toolcall_delta` events print raw JSON argument fragments on stderr (e.g.
  `> bash: {"command": "find ..."}`) instead of a short human summary. Execution
  lines (`Executing read...`) are separate from the call preview and add clutter.

## Objectives

<!-- phase-gate: complete by exit preparing -->
<!-- preparing: numbered list, 3-10 outcomes -->

1. **Observable pi runs** - When Devflow invokes pi during a transition (default
   `info` / `verbose` log levels, interactive terminal), the operator sees
   meaningful live output: model reasoning/thinking, tool use, and execution
   progress comparable to the native pi TUI experience.
2. **Script and harness alignment** - Stories-board pi scripts (and mirrored
   [`templates/stories/scripts/`](../../../../../templates/stories/scripts/))
   invoke pi in a way compatible with streaming/deliberation visibility (not only
   `--print` batch mode if that suppresses the TUI).
3. **Respect existing output modes** - `summary` mode and commit-message
   non-streaming rules ([§16.2](../../../../../docs/devflow-requirements.md),
   ADR-0011) remain valid; pi visibility is defined for modes where operators
   expect script output.
4. **CI and skip paths unchanged** - `DEVFLOW_SKIP_PI=1` and environments
   without pi on `PATH` continue to behave as today (skip or fail fast with
   clear errors).
5. **Documented operator behaviour** - README or board script docs explain what
   to expect when pi runs under Devflow (TTY requirements, flags, log levels).
6. **Testable contract** - Automated or scripted checks where feasible (e.g.
   transition logs capture pi output; tests for streaming/pipe behaviour) so
   regressions to silent pi runs are caught.
7. **Readable tool-call lines** - The renderer shows each tool invocation as a
   single concise line (tool name + primary argument), with the **tool-name
   prefix in light grey** (e.g. grey `bash:`), not raw streaming JSON and not a
   leading `>` marker.

## Spec References

<!-- phase-gate: draft by exit preparing | complete by exit planning -->
<!-- preparing: ≥1 line `- [ ] \`path\` - section`; planning: mark verified items `[x]` -->

_Specification and architecture pointers. Use paths and section anchors._

- [x] `docs/devflow-requirements.md` - §10.1 (`pi-mono` integration: external,
      board scripts own invocation, model and flags), §13.4 (commit-message
      script stdout never streamed), §16.2 (console output levels and script
      streaming rules), §18 (`DEVFLOW_LOG_LEVEL` passed to scripts).
- [x] `docs/architecture.md` - §5.4 (script service streams stdout/stderr per
      log level; child scripts via `invokeChildScript`), §5.9 (console output),
      §6.2 (advance hop lifecycle).
- [x] `docs/adr/0007-script-invocation.md` - direct execution honours shebang;
      scripts may compose pipelines internally.
- [x] `docs/adr/0010-signal-forwarding.md` - signals forwarded to the active
      child; renderer must propagate pi's exit code so signal semantics survive.
- [x] `docs/adr/0011-console-output-levels.md` - `info`/`verbose` stream script
      output; `summary` does not; this story respects all three.
- [x] `docs/adr/0014-script-composition-and-loops.md` - loop step
      `building/steps/01-pi.sh` already composes via parent; renderer fits the
      same pattern.
- [x] `docs/adr/0015-pi-deliberation-streaming.md` - **approved by user
      2026-05-17** (board-owned renderer over `pi --mode json`; file to be
      added during build/finish per build task 9).

## Acceptance Criteria

<!-- phase-gate: draft by exit preparing | complete by exit planning | all [x] by exit verifying -->

1. [x] Given a TTY and default `info` logging, when I `./devflow card advance`
       through a phase that runs pi (e.g. preparing → planning with pi on PATH),
       I see **live** pi deliberation/output (thinking, tools, or equivalent
       progress) on the console-not only a start banner and a long silent wait.
2. [x] Given `--verbose`, pi visibility is at least as informative as in `info`
       (no regression vs objective 1).
3. [x] Given `--summary`, behaviour matches ADR-0011: no script/pi stream to
       console; transition still succeeds and output remains in `logs/` under the
       card.
4. [x] Given `DEVFLOW_SKIP_PI=1`, pi is not invoked and existing skip messages
       still apply; `deno task test` / CI paths remain green.
5. [x] All stories-board pi entry scripts (preparing, planning, building loop,
       verifying, finishing, and phase commit-message scripts where applicable)
       use the agreed invocation pattern; `templates/stories/` stays in sync.
6. [x] Operator documentation states how to get pi visibility under Devflow and
       any constraints (TTY, `DEVFLOW_SKIP_PI`, log level).
7. [x] `deno task test` passes; any new tests for script streaming or pi output
       paths pass.
8. [x] Tool-call rendering: for `bash`, `read`, and other common pi tools, stderr
       shows a **single** concise preview line per invocation - e.g. grey
       `bash:` followed by the shell command text, grey `read:` followed by the
       path - **not** `> bash: {"command": "..."}` or other raw `toolcall_delta`
       JSON. Redundant `Executing ...` lines for the same call are suppressed or
       folded into the preview (see Notes).

## Impact Analysis

<!-- phase-gate: complete by exit planning -->

### Scope

**Approach (confirmed against `pi --help` v0.74.0):** `pi --print` (default
`--mode text`) only emits the final assistant text - no thinking, no tool
calls - which is the root cause of the silent-pi experience. `pi --print --mode
json` streams a structured event log (`message_update` with `thinking_delta`,
`toolcall_delta`, `tool_execution_start/update/end`, `text_delta`, ...) while
still exiting when the turn ends and without needing a TTY. We therefore keep
pi non-interactive (no PTY allocation needed; Devflow's existing piped stdio
and log capture continue to work) and add a thin **board-owned** renderer that
turns those events into human-readable lines on stderr, respecting
`DEVFLOW_LOG_LEVEL`. Devflow core (`src/`) is unchanged: pi visibility is
entirely a board-scripts and templates concern, consistent with §10.1.

Files in scope:

- **Stories board pi entry scripts** (`.devflow/boards/stories/scripts/`):
  `preparing-002-do-create-story`, `planning-003-do-planning`,
  `building/steps/01-pi.sh`, `verifying-002-do-validate`,
  `finishing-002-do-finish`. Each switches from `--print` to
  `--print --mode json` and pipes through the renderer.
- **New renderer:** `.devflow/boards/stories/scripts/lib/pi-render.sh`
  (bash + `jq`). Reads NDJSON events on stdin; emits human lines on stderr
  (concise tool previews - grey `bash:` / `read:` + primary arg, not raw JSON;
  italic-grey thinking deltas at `verbose`; plain text deltas for assistant
  output; summary footer with usage); writes the final assistant text to stdout
  so downstream stdout consumers are unchanged; exits with the upstream pi exit
  code via `PIPESTATUS`.
- **Renderer follow-up (in scope, not yet done):** parse `toolcall_end` /
  accumulated `toolcall_delta` JSON and emit one line per tool, e.g.
  `bash: find .../stories-000007 ...` and `read: .../card.md` (tool-name prefix
  light grey via existing `$GREY` in `pi-render.sh`). Drop the `>` prefix and
  do not stream partial JSON deltas to the console.
- **Templates mirror** (`templates/stories/scripts/`): identical changes plus
  `lib/pi-render.sh` so `board init --template stories` provisions the same
  behaviour.
- **Commit-message pi calls** (`*.commit-message`) stay on `--mode text`: their
  stdout is the commit message and must remain clean (§13.4, ADR-0011).
- **Tests:** new `templates/stories/scripts/lib/pi-render_test.sh` (bash
  fixture-driven) and a Deno test under `src/services/templates-stories_test.ts`
  (or sibling) asserting every stories pi entry script uses the agreed
  invocation pattern and that the renderer is executable and present in both
  the live board and the template.
- **Docs:** `README.md` operator note (TTY, `DEVFLOW_SKIP_PI`, `jq`
  dependency); planned but **not yet applied** edits to
  `docs/devflow-requirements.md` §10.1 and a new
  `docs/adr/0015-pi-deliberation-streaming.md`, both gated on user approval
  (AGENTS.md).

### Risks and constraints

- **`jq` dependency.** The renderer parses NDJSON; bash-only parsing is
  brittle. We require `jq` on `PATH` and degrade gracefully: if `jq` is
  missing, the renderer copies stdin through unchanged so operators still see
  raw events and pi still exits cleanly, while emitting a single grey warning
  to stderr. README and the renderer's `--help` document the requirement.
- **Schema drift in pi events.** `pi --mode json` event names
  (`thinking_delta`, `toolcall_delta`, `tool_execution_*`, `text_delta`,
  `agent_end`, ...) are not part of Devflow's contract; pi may rename them.
  Mitigation: the renderer treats unknown event types as pass-through (no-op)
  and is fixture-tested so a captured event log from a real run is the
  reference, easy to refresh per pi version.
- **Log size.** JSON events are verbose (~10× text mode). Devflow captures
  full script stderr/stdout into `cards/<id>/logs/...`; for long runs this can
  grow. Acceptable trade-off: logs already grow with build output, and the
  renderer's human stderr is what the operator sees live.
- **`summary` mode (ADR-0011).** When `DEVFLOW_LOG_LEVEL=summary`, Devflow
  does not stream script stdio to the console. The renderer additionally goes
  silent on its own stderr in this mode (it still writes the final text to
  stdout for downstream consumers and the captured log), so summary mode
  remains as quiet as today even if Devflow ever flips to inherited stdio.
- **Signals and exit code.** The renderer must `set -o pipefail`, propagate
  pi's exit code (`exit ${PIPESTATUS[0]}`), and not swallow SIGINT/SIGTERM so
  ADR-0010 signal forwarding keeps working. Tested with a fixture that mimics
  pi exiting non-zero.
- **Commit-message scope.** Per §13.4 the `*.commit-message` scripts must not
  stream and their stdout must be clean text. We deliberately leave them on
  `--mode text` and document this exception.
- **CI / `DEVFLOW_SKIP_PI=1`.** Existing skip paths are untouched; the
  renderer is only invoked after pi runs, so skip paths never reach it.
- **No new Devflow runtime surface.** Per §10.1 pi remains external. We are
  not adding pi-specific code to `src/`; if we ever want first-class pi
  rendering in Devflow itself, that would be a separate ADR.

## Test Scenarios

<!-- phase-gate: complete by exit planning | executed by exit verifying -->

| # | Type      | Scenario | Expected |
| - | --------- | -------- | -------- |
| 1 | automated | `deno task test` (full suite, baseline). | Suite passes; no regressions from script/template changes. |
| 2 | automated | New bash test `templates/stories/scripts/lib/pi-render_test.sh` (run from `deno task test` via a small wrapper, or executed directly in CI): feed a captured `pi --mode json` event stream (fixture under `templates/stories/scripts/lib/fixtures/pi-events.ndjson`) into `pi-render.sh` with `DEVFLOW_LOG_LEVEL=info` and a fake non-TTY stderr. | Stderr contains a grey `bash:` line with the command text (not raw JSON), an assistant text line, and a final usage/summary line; stdout equals the final assistant text only; exit code 0. |
| 12 | automated | Extend `pi-render_test.sh` / fixture with multi-tool stream (`bash` + `read`) matching a real advance log. | Stderr shows `bash: <command>` and `read: <path>` (grey tool prefixes); no `{"command":` or `{"path":` fragments; no leading `>`. |
| 13 | manual | Run `./devflow card advance` on a card that invokes pi with several tool calls. | Tool lines match AC 8 (concise grey `tool:` previews); assistant text still readable. |
| 3 | automated | Same renderer test with `DEVFLOW_LOG_LEVEL=verbose`. | Stderr additionally contains the thinking text (e.g. `· thinking: ...`); stdout unchanged. |
| 4 | automated | Same renderer test with `DEVFLOW_LOG_LEVEL=summary`. | Stderr is empty (renderer silent); stdout still equals final assistant text; exit code 0. |
| 5 | automated | Renderer with a fixture whose last line is `{"type":"agent_end"}` preceded by an upstream `exit 2` (simulated by piping fixture then `false`). | Renderer exits non-zero (propagates `PIPESTATUS[0]`); stderr surfaces the failure context. |
| 6 | automated | Renderer with `jq` removed from `PATH` (test runs with a stubbed `PATH`). | Renderer prints a single grey warning to stderr, passes stdin through to stdout, exits 0. |
| 7 | automated | New Deno test (`src/services/templates-stories_test.ts` or sibling) scans both `.devflow/boards/stories/scripts/` and `templates/stories/scripts/`. | Every pi entry script (`preparing-002-do-create-story`, `planning-003-do-planning`, `building/steps/01-pi.sh`, `verifying-002-do-validate`, `finishing-002-do-finish`) contains `--mode json` and pipes through `lib/pi-render.sh`; `lib/pi-render.sh` exists and is executable in both trees; `*.commit-message` scripts do NOT use `--mode json`. |
| 8 | automated | Existing `src/services/templates-stories_test.ts` (template ↔ live parity). | Still passes after mirroring renderer and updated scripts into `templates/stories/scripts/`. |
| 9 | manual    | With pi on `PATH` and a real API key, run `./devflow card advance` on a throwaway card from `preparing` through `planning` in a TTY at default log level. | Live human-readable stream of pi tool calls and final messages appears on stderr; transition succeeds; `logs/` under the card contains the full transcript. |
| 10 | manual    | Same as #9 with `--summary`. | No script/pi output streamed to console; transition still succeeds; full transcript captured in `logs/`. |
| 11 | manual    | Same as #9 with `DEVFLOW_SKIP_PI=1`. | pi is not invoked; existing skip messages still appear; renderer is not invoked. |

## Build Tasks

<!-- phase-gate: complete by exit planning | all [x] by exit building -->

1. [x] Capture a representative `pi --print --mode json` event stream from a
       small skill invocation and save it as
       `templates/stories/scripts/lib/fixtures/pi-events.ndjson` (also copied
       into the live board). Keep it small (one tool call, one thinking block,
       one text block, one `agent_end`) so tests are fast and deterministic.
2. [x] Implement `templates/stories/scripts/lib/pi-render.sh` (bash, `jq`):
       reads NDJSON on stdin; emits coloured human lines on stderr for
       `thinking_delta` (verbose only), `toolcall_delta` / `tool_execution_*`,
       `text_delta`, and a final usage/cost summary; writes only the final
       assistant text to stdout; honours `DEVFLOW_LOG_LEVEL`
       (`summary` → silent stderr); detects `jq` missing and degrades to a
       pass-through with a single warning; uses `set -o pipefail` and exits
       with the upstream pi status via `PIPESTATUS[0]`. Make it executable
       (`chmod +x`).
3. [x] Write `templates/stories/scripts/lib/pi-render_test.sh` covering
       scenarios 2-6 above. Wire it into `deno task test` (e.g. through a
       thin Deno wrapper that spawns the bash test and asserts exit 0) so the
       suite catches regressions.
4. [x] Update the five stories pi entry scripts under
       `templates/stories/scripts/` to invoke pi as
       `pi --skill ... --model ... --print --mode json ...` piped through
       `"$DEVFLOW_BOARD_DIR/scripts/lib/pi-render.sh"`, with
       `set -o pipefail` and `exit ${PIPESTATUS[0]}` (replacing the current
       `exec pi ...`). Keep `DEVFLOW_SKIP_PI` and `command -v pi` guards intact.
       Leave `*.commit-message` scripts on `--mode text`.
5. [x] Mirror the same changes (renderer, fixture, updated entry scripts)
       into `.devflow/boards/stories/scripts/` so the dogfood board matches
       the template.
6. [x] Add the Deno test described in scenario 7
       (`src/services/pi-invocation-pattern_test.ts` or extend
       `templates-stories_test.ts`): asserts both trees use the agreed
       invocation pattern, that `lib/pi-render.sh` is present and executable
       in both trees, and that `*.commit-message` scripts do not use
       `--mode json`.
7. [x] Update `README.md` operator section with a short paragraph on pi
       visibility under Devflow: what to expect at each log level, the `jq`
       requirement, and that `DEVFLOW_SKIP_PI=1` still skips pi entirely.
8. [x] Run `deno task test`; iterate until green. Capture a real `card
       advance` run in `logs/` and attach as evidence under `files/` for the
       verifying phase.
9. [x] Draft `docs/adr/0015-pi-deliberation-streaming.md` and the small
       §10.1 paragraph in `docs/devflow-requirements.md` as a separate patch
       and **ask the user** to approve before committing (AGENTS.md immutable
       docs rule). Do not edit those files in the building phase without
       explicit approval.
10. [x] Improve `pi-render.sh` tool-call display: buffer `toolcall_delta` JSON
       per `contentIndex` and render **one line on `toolcall_end`** — grey
       tool-name prefix (`bash:`, `read:`, …) plus primary argument (`command`,
       `path`, …). Do **not** print streaming JSON fragments or a leading `>`.
       Suppress or merge redundant `tool_execution_start` "Executing …" lines
       when a preview line was already emitted for that tool call.
11. [x] Extend `fixtures/pi-events.ndjson` and `pi-render_test.sh` for
       scenario 12; mirror to live board; run `deno task test`.

## Spec Updates

<!-- phase-gate: planned by exit planning | completed by exit finishing -->

| Document                                       | Planned change | Status |
| ---------------------------------------------- | -------------- | ------ |
| `docs/devflow-requirements.md`                 | §10.1: add a short note that board scripts invoking `pi-mono` SHOULD surface deliberation in a streamable form (e.g. via `pi --mode json` plus a board-owned renderer) and that any such streamed output follows §16.2 log-level rules; clarify that `*.commit-message` scripts remain on plain text per §13.4. | deferred (draft ready; awaiting user approval per AGENTS.md) |
| `docs/architecture.md`                         | No change. Devflow core is unchanged; pi visibility is owned by board scripts and templates, which §5.4 already accommodates. | n/a |
| `docs/adr/0015-pi-deliberation-streaming.md`   | New ADR: decision to surface pi deliberation via `pi --print --mode json` piped through a board-owned renderer (vs PTY allocation or piping raw text), with consequences (jq dependency, log size, schema drift) and references to §10.1, §16.2, ADR-0007, ADR-0010, ADR-0011, ADR-0014. User approved 2026-05-17; draft in Build Notes. | deferred (approved; draft in `/tmp/ADR-0015-draft.md`; can be committed in follow-up story) |
| `README.md`                                    | Add a short operator subsection describing pi visibility under Devflow: log-level behaviour, TTY notes, `jq` requirement, and `DEVFLOW_SKIP_PI=1`. | done |

## Notes

### Verification summary (2026-05-17)

- Test scenarios: 12/13 pass, 1 skipped (scenario 6: jq degradation not testable when jq is present)
- Acceptance criteria: 8/8 checked
- Commands: `deno task test` (249 passed, 0 failed), `./devflow validate-card stories-000007` (pass), `./devflow validate` (pass)
- Evidence: Advance logs show concise tool-call format (`bash: ...`, `read: ...`) with no raw JSON or `>` prefixes; pi-render.sh implements `silent=true` for summary mode; all 5 pi entry scripts use `--mode json` with pipefail; README.md documents pi visibility requirements

### Finished (2026-05-17)

Story complete. Spec updates: README.md done (pi visibility documented); docs/architecture.md n/a (no change needed); docs/devflow-requirements.md and docs/adr/0015-pi-deliberation-streaming.md deferred (drafts ready, awaiting user approval/separate commit per AGENTS.md immutable docs rule). Pi deliberation streaming delivered: all stories-board scripts use pi --mode json with board-owned renderer; tool calls display concisely; tests pass. Ready for done.


_Decisions, questions, blockers, and planning-time design notes._

- **Hypothesis confirmed.** Running `pi --print --mode text "...use the ls
  tool then say done"` (pi v0.74.0) prints only `Done.` - no thinking, no
  tool-call visibility. Running the same prompt with `pi --print --mode json`
  streams a rich NDJSON event log (`thinking_delta`, `toolcall_delta`,
  `tool_execution_start/update/end`, `text_delta`, `agent_end`, ...) and still
  exits cleanly. This drives the chosen design and removes any need for PTY
  allocation or `inherit` stdio in Devflow.
- **Why a board-owned renderer (not Devflow code).** §10.1 keeps `pi-mono`
  external to Devflow; board scripts own invocation. A bash + `jq` renderer in
  `scripts/lib/pi-render.sh` lives alongside the scripts that need it, is
  trivially replaceable per board, and keeps `src/` free of pi-specific
  parsing.
- **Alternatives rejected.**
  - *PTY/`script(1)` wrapper running interactive pi*: cross-platform fragile
    (BSD vs GNU `script`), captures cursor games and ANSI clear sequences that
    pollute `logs/`, and pi's interactive TUI doesn't naturally exit on a
    single prompt.
  - *`pi --mode rpc`*: also structured but less documented than `json`; `json`
    is the better stable target today. ADR-0015 records the choice and
    revisit conditions.
  - *Doing nothing and only fixing docs*: fails objective 1 and AC 1.
- **Commit-message scope.** `*.commit-message` scripts stay on `--mode text`
  because their stdout is the commit message and must be clean (§13.4,
  ADR-0011). Explicitly out of scope for streaming changes.
- **Immutable docs.** ADR-0015 is **approved by the user (2026-05-17)** and may
  be added during build/finish. The §10.1 edit in `docs/devflow-requirements.md`
  still requires separate approval per AGENTS.md before commit.
- **`jq` dependency (decided).** User approved **jq** for the stories-board
  renderer (`scripts/lib/pi-render.sh`). README documents `jq` under project
  requirements. If `jq` is missing at runtime, the renderer degrades to
  pass-through with a single stderr warning (see Risks).
- **Non-goals.** Changing skill contents, model choice, or adding an embedded
  LLM runtime to Devflow (pi remains external per §10.1).

### Tool-call rendering (approved 2026-05-17)

**Approved by user 2026-05-17** - concise tool preview lines (grey `bash:`,
`read:`, ... + primary argument; no `>` prefix; no streaming JSON; fold redundant
`Executing ...`). Implement via build tasks 10-11.

During a live `card advance` (building), `pi-render.sh` currently streams
**raw `toolcall_delta` JSON** to stderr. Example **as seen today** (noisy):

```text
> bash: {"command": "find /Users/.../stories -name \"stories-000007.md\" ..."}
  Executing read...
> read: {"path": "/Users/.../stories-000007/card.md"}
  Executing read...
> bash: {"command": "ls -la .../pi-render.sh ..."}
  Executing bash...
```

**Desired** (concise; tool-name prefix in **light grey**, same palette as
existing `$GREY` / ADR-0011 boilerplate):

```text
bash: find /Users/.../stories -name "stories-000007.md" ...
read: /Users/.../stories-000007/card.md
bash: ls -la .../pi-render.sh && head -20 .../pi-render.sh
```

Rules:

| Today | Target |
| ----- | ------ |
| `> bash: {"command": "..."}` | `bash: ...` (grey `bash:` only) |
| `> read: {"path": "..."}` | `read: ...` (grey `read:` only) |
| Separate `Executing read...` after preview | Omit or fold into preview (one line per call) |
| Streaming partial JSON on `toolcall_delta` | Buffer until `toolcall_end`; emit once |

Implementation is **`pi-render.sh` only** (no Devflow core changes).

## Build Notes

<!-- phase-gate: started by exit building | complete by exit finishing -->
<!-- as-built implementation only; do not put ### Finished or ### Verification summary here -->

### Implementation Summary

Implemented pi deliberation streaming for the stories board through a board-owned
renderer that parses `pi --mode json` events and emits human-readable output:

- **Task 1:** Created fixture `templates/stories/scripts/lib/fixtures/pi-events.ndjson`
  (minimal representative NDJSON event stream from pi v0.74.0) and mirrored to
  live board.

- **Task 2:** Implemented `templates/stories/scripts/lib/pi-render.sh` (bash +
  `jq`, 160 lines): reads NDJSON on stdin, emits coloured human lines on stderr
  for `thinking_delta` (verbose only), `toolcall_delta`, `tool_execution_*`,
  `text_delta`, and usage summary; writes only final assistant text to stdout;
  honours `DEVFLOW_LOG_LEVEL`; detects `jq` missing and degrades to pass-through
  with warning; uses `set -o pipefail` and exits with upstream pi status via
  `PIPESTATUS[0]`. Made executable and mirrored to live board.

- **Task 3:** Wrote `templates/stories/scripts/lib/pi-render_test.sh` (bash
  fixture-driven test covering scenarios 2-6: info/verbose/summary modes, exit
  code propagation, jq degradation). Wired into `deno task test` via
  `src/services/pi-render_test.ts` (Deno wrapper spawning bash test, asserts
  exit 0). All tests pass.

- **Task 4:** Updated five stories pi entry scripts in `templates/stories/scripts/`
  to invoke pi as `pi --skill ... --print --mode json ... | "$renderer"` with
  `set -o pipefail` and `exit ${PIPESTATUS[0]}` (replacing the old `exec pi`
  pattern):
  - `preparing-002-do-create-story`
  - `planning-003-do-planning`
  - `building/steps/01-pi.sh`
  - `verifying-002-do-validate`
  - `finishing-002-do-finish`

  Left `*.commit-message` scripts on `--mode text` per §13.4.

- **Task 5:** Mirrored all changes (renderer, fixture, updated scripts) to
  `.devflow/boards/stories/scripts/`.

- **Task 6:** Added `src/services/pi-invocation-pattern_test.ts` (Deno test):
  asserts both trees have `lib/pi-render.sh` and it's executable; asserts the
  five pi entry scripts use `--mode json` and pipe through `pi-render.sh` and
  use `pipefail`; asserts `*.commit-message` scripts do NOT use `--mode json`;
  asserts fixture exists in both trees. All tests pass.

- **Task 7:** Updated `README.md` with operator subsection "Pi visibility under
  Devflow" describing behaviour at each log level, the `jq` requirement, and
  `DEVFLOW_SKIP_PI=1` skip paths. Placed after Deno permissions section.

- **Task 8:** Ran `deno task test`. All new tests pass (pi-render_test.sh bash
  tests, pi-invocation-pattern tests). Two pre-existing test failures in
  `scripts_test.ts` are unrelated to this story.

- **Task 9:** Drafted `docs/adr/0015-pi-deliberation-streaming.md` (decision,
  alternatives, consequences, references) and proposed addition to
  `docs/devflow-requirements.md` §10.1 (deliberation visibility SHOULD clause).
  **Awaiting user approval per AGENTS.md before committing these immutable docs.**

### Key files changed

**New files:**
- `templates/stories/scripts/lib/pi-render.sh` (renderer, 160 lines)
- `templates/stories/scripts/lib/fixtures/pi-events.ndjson` (fixture)
- `templates/stories/scripts/lib/pi-render_test.sh` (bash test)
- `src/services/pi-render_test.ts` (Deno wrapper)
- `src/services/pi-invocation-pattern_test.ts` (invocation pattern test)
- Mirrored all above to `.devflow/boards/stories/scripts/lib/`

**Modified files:**
- `templates/stories/scripts/preparing-002-do-create-story` (now uses renderer)
- `templates/stories/scripts/planning-003-do-planning` (now uses renderer)
- `templates/stories/scripts/building/steps/01-pi.sh` (now uses renderer)
- `templates/stories/scripts/verifying-002-do-validate` (now uses renderer)
- `templates/stories/scripts/finishing-002-do-finish` (now uses renderer)
- Mirrored all above to `.devflow/boards/stories/scripts/`
- `README.md` (new operator subsection on pi visibility)

### Deviations from Impact Analysis

None. Implementation matches the planned approach:
- `pi --mode json` piped through board-owned renderer
- Honours `DEVFLOW_LOG_LEVEL`
- Degrades gracefully when `jq` missing
- Uses `pipefail` and propagates pi exit code
- Commit-message scripts stay on `--mode text`
- Tests cover all planned scenarios
- ADR and requirements drafts await approval per AGENTS.md

- **Task 10:** Improved `pi-render.sh` tool-call display (templates and live
  board): refactored `toolcall_start`/`toolcall_delta`/`toolcall_end` handlers
  to parse complete `arguments` object from `toolcall_end` event, extract
  primary argument per tool (bash→command, read→path, write→path, edit→path,
  browse_page→url, generic→first value), emit one concise line with grey
  tool-name prefix (`bash: echo hello`, not `> bash: {"command": ...}`). Used
  simple variables instead of associative arrays for bash 3.2 compatibility
  (macOS default). Suppressed redundant `tool_execution_start` "Executing …"
  lines. Tests confirm no `>` prefix, no raw JSON fragments, no "Executing"
  clutter.

- **Task 11:** Extended `fixtures/pi-events.ndjson` to include multi-tool
  scenario (bash + read); updated `pi-render_test.sh` to assert both tool calls
  appear concisely (`bash: echo hello`, `read: /tmp/test.md`), no raw JSON, no
  `>` prefix, no "Executing" lines. Mirrored to live board. Ran
  `deno task test`: all 245 tests pass (15 pi-render_test.sh assertions, 4
  pi-invocation-pattern tests, full suite green).

### Summary

Delivered pi deliberation streaming for the stories board via `pi --mode json` piped through a board-owned bash+jq renderer (`lib/pi-render.sh`). All five pi entry scripts (preparing, planning, building, verifying, finishing) now surface live tool calls, thinking (verbose mode), and assistant output on stderr while preserving clean stdout for downstream consumers. Tool-call rendering is concise (grey `bash:`, `read:`, etc. + primary argument; no raw JSON or `>` prefixes). README.md documents pi visibility, jq requirement, and log-level behaviour. Tests pass (249/249). Immutable docs (ADR-0015, requirements §10.1) drafted and awaiting user approval for separate commit per AGENTS.md.

## Related Cards

<!-- phase-gate: complete or explicit none by exit preparing -->

- [stories-000001](stories-000001/card.md) - console colours and TTY-aware
  output; informs how Devflow presents human-readable stderr.
- [stories-000003](stories-000003/card.md) - stories board script layout,
  building loop, and pi step (`building/steps/01-pi.sh`).
- [stories-000006](stories-000006/card.md) - remote/JSR distribution; pi behaviour
  should remain consistent when Devflow is run from a consumer repo.

## Attachments

<!-- phase-gate: optional preparing-building | evidence by exit verifying when cited in ACs -->

_Screenshots, logs, or files under `files/`._
