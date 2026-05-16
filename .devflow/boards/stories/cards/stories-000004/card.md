# CLI Parameter Error Shows usage

As a Devflow CLI user, I want parameter and parsing errors to be reported in
the project's standard structured-error format (and colour) without the full
usage block dumped after every failure, so that error output stays scannable
and the long usage text only appears when I actually want it (`devflow` with no
arguments, or an explicit help command).

## Current State

<!-- phase-gate: complete by exit preparing -->

- `runCli` in [`src/cli/dispatch.ts`](../../../../../src/cli/dispatch.ts)
  prints the full `USAGE` string after several failure paths:
  - Unknown command (`parseCommand` returns `null`, lines ~622–625)
  - Unknown `<object>:<verb>` combination (lines ~630–633)
  - Implicitly, individual handlers also emit ad‑hoc `console.error("devflow
    <cmd>: <thing> required\n")` lines (~20 sites in `dispatch.ts`) with a
    trailing newline that was originally intended to separate them from the
    usage block.
- Error formatting is inconsistent:
  - Some sites use `logError` (red, no label) from
    [`src/services/console.ts`](../../../../../src/services/console.ts).
  - Some sites use the structured `logCliMessage({ kind: "error", command,
    subject, detail })` (req §16.2 — `Error: <command>: <subject>: <detail>`).
  - Many sites still call `console.error(...)` directly with no colour and no
    `Error:` label, and append `\n` to make room for `USAGE`.
- There is no dedicated `help` command; `devflow` (no args) is the only way to
  print `USAGE` (`runCli` early-returns at lines ~604–607).
- Requirements §16.0 lists `devflow` (no args) → "Print usage; exit 0" but does
  not define a `help` verb. Architecture §8 currently says "Usage / flag error
  → Error + usage" on stderr, which is exactly the behaviour this story wants
  to change.

## Objectives

<!-- phase-gate: complete by exit preparing -->

1. Route every CLI parameter / parse / unknown-command error through the
   standard structured error path (`logCliMessage` with `kind: "error"`) so
   output matches req §16.2 (`Error: <command>: <subject>: <detail>`, red label,
   grey subject, NO_COLOR honoured).
2. Stop printing the full `USAGE` block on argument errors; emit only the
   structured error line and exit non‑zero.
3. Print `USAGE` (exit 0) only when:
   - `devflow` is invoked with no positional arguments, OR
   - an explicit help command is invoked (`devflow help` and the customary
     `--help` / `-h` global flag).
4. Keep every error path's exit code unchanged (still non‑zero for failures,
   `0` for the help/no-args usage print).
5. Update specification text (architecture §8, requirements §16) so the new
   behaviour is the documented contract — no silent drift between docs and
   code.

## Spec References

<!-- phase-gate: draft by exit preparing | complete by exit planning -->

- [ ] `docs/devflow-requirements.md` — §16.0 command index (`devflow` row),
      §16.1 global flags (add `--help`/`-h` and `help` verb), §16.2 stderr
      formatting (confirm `Error:` label for all CLI errors)
- [ ] `docs/architecture.md` — §8 "Error handling conventions" (the
      "Usage / flag error → Error + usage" row needs to change to "Error only;
      usage printed on `devflow`, `devflow help`, or `--help`")
- [ ] `docs/adr/` — N/A (no architecturally significant choice; existing ADR
      0013 on CLI duality is informational only)
- [ ] `README.md` — §"Commands" usage line (mention `devflow help` /
      `--help`)

## Acceptance Criteria

<!-- phase-gate: draft by exit preparing | complete by exit planning | all [x] by exit verifying -->

1. [ ] Running `./devflow` (no args) prints the full `USAGE` text on stdout and
       exits `0` (unchanged behaviour, regression-guarded by a test).
2. [ ] Running `./devflow help` and `./devflow --help` (and `-h`) prints the
       same `USAGE` text on stdout and exits `0`.
3. [ ] Running `./devflow bogus-command` writes a single structured error line
       to stderr in the form `Error: devflow: unknown command "bogus-command"`
       (red `Error:` label, grey subject when colours are enabled, plain text
       under `NO_COLOR=1`), does NOT print `USAGE`, and exits non‑zero.
4. [ ] Running a known command with missing/invalid arguments (e.g.
       `./devflow board init` with no board name, `./devflow card show` with
       no id, `./devflow --log-level=garbage validate`) emits exactly one
       `Error: <command>: <subject>: <detail>` line on stderr, no `USAGE`
       block, exits non‑zero.
5. [ ] All previously direct `console.error(...)` argument-validation messages
       in `src/cli/dispatch.ts` are routed through `logCliMessage({ kind:
       "error", … })` (or an equivalent shared helper) so colourisation and
       label are consistent.
6. [ ] `deno test` passes, including new tests covering: no-args usage, `help`
       command, `--help`/`-h` flag, unknown command stderr shape, at least one
       per-handler "missing argument" error shape, and `NO_COLOR=1` behaviour.
7. [ ] `docs/devflow-requirements.md`, `docs/architecture.md`, and `README.md`
       reflect the new help/usage and error-format contract.

## Impact Analysis

<!-- phase-gate: complete by exit planning -->

### Scope

_To be completed in planning._

### Risks and constraints

_To be completed in planning._

## Test Scenarios

<!-- phase-gate: complete by exit planning | executed by exit verifying -->

| # | Type      | Scenario                                                              | Expected                                                                   |
| - | --------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1 | automated | `deno test` after refactor of `dispatch.ts` error sites               | pass                                                                       |
| 2 | automated | `runCli([])` writes `USAGE` to stdout, returns `0`                    | usage text on stdout, no stderr                                            |
| 3 | automated | `runCli(["help"])` / `runCli(["--help"])` write `USAGE`, return `0`   | usage text on stdout, exit `0`                                             |
| 4 | automated | `runCli(["totally-unknown"])` under `NO_COLOR=1`                      | stderr is exactly one `Error: devflow: unknown command "totally-unknown"` line, no `USAGE`, exit non‑zero |
| 5 | manual    | Run `./devflow board init` in a TTY                                   | red `Error:` label, no usage block, single line                            |

## Build Tasks

<!-- phase-gate: complete by exit planning | all [x] by exit building -->

1. [ ] _To be completed in planning._

## Spec Updates

<!-- phase-gate: planned by exit planning | completed by exit finishing -->

| Document                       | Planned change                                                                                  | Status  |
| ------------------------------ | ----------------------------------------------------------------------------------------------- | ------- |
| `docs/devflow-requirements.md` | §16.0 add `help` verb / `--help` flag; §16.2 confirm `Error:` label is universal for CLI errors | pending |
| `docs/architecture.md`         | §8 update "Usage / flag error" row: error only, no usage block                                  | pending |
| `README.md`                    | Document `devflow help` / `--help` in command list                                              | pending |

## Notes

<!-- phase-gate: optional; ongoing across phases -->

- Open question for planning: do we want `--help` to also work as a
  per-subcommand help (`devflow card show --help`), or strictly a top-level
  alias for `devflow help`? Story says "the help command is invoked" —
  recommend top-level only for this story; per-subcommand help can be a
  follow-up card.
- Recommended canonical error string for unknown command:
  `Error: devflow: unknown command "<token(s)>"` (matches existing
  `logCliMessage` shape used elsewhere in `dispatch.ts`).
- Architecture §8 currently mandates "Error + usage" on usage errors. This
  story deliberately changes that contract; doc updates are in scope (see Spec
  Updates) so code and docs stay aligned.
- StoryDetail says `./devtools` — assumed to mean `./devflow` (project entry
  script). Confirm with author if a different binary is meant.

## Build Notes

<!-- phase-gate: started by exit building | complete by exit finishing -->

_As-built log: what was implemented, deviations from plan, follow-ups._

## Related Cards

<!-- phase-gate: complete or explicit none by exit preparing -->

_None._

## Attachments

<!-- phase-gate: optional preparing–building | evidence by exit verifying when cited in ACs -->

_None._
