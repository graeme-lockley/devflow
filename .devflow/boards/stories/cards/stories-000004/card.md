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

- [x] `docs/devflow-requirements.md` — §16.0 command index (add `devflow help`
      row), §16.1 global flags (add `--help` / `-h`), §16.2 console output
      (confirm `Error:` label is universal for CLI parameter errors and that no
      `USAGE` block follows)
- [x] `docs/architecture.md` — §8 "Error handling conventions" (the
      "Usage / flag error → Error + usage" row must change to "Error only;
      usage printed only by `devflow` with no args, `devflow help`, or
      `--help`/`-h`")
- [x] `docs/adr/` — N/A. No architecturally significant decision; ADR-0013 on
      CLI duality is unaffected (synonyms still work, only the usage-dump
      behaviour changes).
- [x] `README.md` — Commands / usage section: document `devflow help` and the
      `--help` / `-h` global flag; note that argument errors no longer print
      `USAGE`.

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

- **`src/cli/dispatch.ts`** — primary change site.
  - `runCli` (lines ~594–648): replace the two `Unknown command: …\n` +
    `USAGE` dumps (≈ lines 622–625 and 630–633) with a single
    `logCliMessage({ kind: "error", command: "devflow", detail: 'unknown
    command "<token(s)>"' })` call; remove the `console.log(USAGE.trimEnd())`
    on those paths.
  - `runCli` global-flag error (line ~599): route `validateGlobalFlags`
    result through `logCliMessage` instead of `console.error`.
  - `runCli` `--ignore-lock` rejection (line ~637): already a single-line
    error, but reword through `logCliMessage` for consistency.
  - All per-handler `console.error("devflow <cmd>: <thing> required\n")`
    sites paired with `console.log(USAGE.trimEnd())` (≈ 15 sites at lines
    149–150, 185–186, 270–271, 295–296, 320–321, 363–364, 387–390, 426–427,
    450–451, 473–476, 495–498, 519–520, 532–533, 552–553) collapse to one
    `logCliMessage({ kind: "error", command: "devflow <cmd>", detail: "<thing>
    required" })` call each (no trailing `\n`, no `USAGE`).
  - `logError("devflow <cmd>: …")` and ad-hoc `console.error(message)`
    catch-block sites that already produce a one-line error stay functionally
    the same but should be reviewed for the `Error:` label; convert to
    `logCliMessage` where the message is a recognisable
    `<command>: <subject>: <detail>` shape.
  - Add `help` as a recognised token in `runCli` (no positional args required;
    same exit-0 / stdout USAGE path as the no-args case).
- **`src/cli/flags.ts`** — `ParsedFlags` gains a `help: boolean` field;
  `parseGlobalFlags` recognises `--help` and `-h` and sets it; `runCli`
  short-circuits to the USAGE print when `flags.help` is true (before
  `resolveGitRoot`, so `--help` works outside a repo).
- **`src/cli/parser.ts`** — accept the `help` verb (single positional) so
  `parseCommand` returns a handled value rather than `null`; alternatively
  handle `help` directly in `runCli` before `parseCommand`. Decision (see
  Notes): handle in `runCli` to keep `parseCommand` focused on object/verb
  forms.
- **Tests** — new `src/cli/dispatch_test.ts` (file does not yet exist) for
  end-to-end `runCli` behaviour using captured stdout/stderr; possibly extend
  `src/services/console_test.ts` if new helpers are added.
- **Docs** — `docs/devflow-requirements.md` §16.0, §16.1, §16.2;
  `docs/architecture.md` §8; `README.md` commands section.
- **User-visible behaviour** — stdout is unchanged for success paths and for
  `devflow` / `devflow help` / `devflow --help` (USAGE on stdout, exit 0).
  Stderr for every argument/parse/unknown error becomes a single coloured
  `Error: …` line; no `USAGE` block is emitted alongside errors. Exit codes
  are unchanged.

### Risks and constraints

- **Behavioural change vs. current spec** — Architecture §8 currently mandates
  "Error + usage" for usage errors. This story deliberately changes that
  contract, so the doc edits in **Spec Updates** are part of the story scope
  and must land in the same change set; AGENTS.md "immutable docs" rule
  applies — user has implicitly approved by accepting this story's
  objectives, but planning notes the approval and finishing will not be done
  without the doc updates.
- **Machine-parseable output (req §16.4)** — stdout for `card create`,
  `card dir`, `variable get`, `board list`, `card list`, etc. must not
  change. Errors are on stderr, so refactor is safe; verify in tests.
- **`NO_COLOR` / non-TTY behaviour (req §16.2)** — `logCliMessage` already
  emits plain text when colours are disabled; no extra work, but tests must
  cover this path so the regression surface is locked.
- **Lock interaction** — argument-validation errors fire before any lock is
  acquired, so removing the USAGE dump has no lock or transition side
  effects. The `--ignore-lock` rejection path is unchanged in semantics.
- **`help` collision with potential future board/card `help` verbs** —
  handling `help` only as the first positional in `runCli` (not via
  `parseCommand`) means future `devflow card help` would still go through the
  normal handler map. Documented in Notes.
- **`-h` short flag clash** — no existing command uses `-h`; safe to claim
  globally. Confirmed by `grep -n '"-h"' src` (no hits in CLI parsers).
- **Synonym forms (ADR-0013)** — `help-devflow` / `devflow-help` are not in
  scope; only `devflow help` (and the `--help`/`-h` flag) are added.
- **Backwards compatibility for tooling** — any external script that was
  greping `Unknown command:` will break. Story changes the canonical phrase
  to `unknown command "…"` inside the `Error:` line; called out in README
  change.

## Test Scenarios

<!-- phase-gate: complete by exit planning | executed by exit verifying -->

| #  | Type      | Scenario                                                                                                                                  | Expected                                                                                                                       |
| -- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1  | automated | `deno test` (full suite) after refactor of `dispatch.ts` error sites                                                                      | all tests pass; no regressions in existing CLI / machine-stdout tests                                                          |
| 2  | automated | `src/cli/dispatch_test.ts`: `runCli([])` with captured stdout/stderr                                                                      | stdout equals `USAGE.trimEnd()` + `\n`; stderr empty; return value `0`                                                         |
| 3  | automated | `src/cli/dispatch_test.ts`: `runCli(["help"])`                                                                                            | stdout equals `USAGE.trimEnd()` + `\n`; stderr empty; return value `0`                                                         |
| 4  | automated | `src/cli/dispatch_test.ts`: `runCli(["--help"])` and `runCli(["-h"])`                                                                     | same as #3 for both invocations                                                                                                |
| 5  | automated | `src/cli/dispatch_test.ts`: `runCli(["totally-unknown"])` with `NO_COLOR=1`                                                               | stderr is exactly `Error: devflow: unknown command "totally-unknown"\n`; stdout empty; no `USAGE` substring anywhere; return non‑zero |
| 6  | automated | `src/cli/dispatch_test.ts`: `runCli(["board", "frob"])` (unknown verb) with `NO_COLOR=1`                                                  | stderr is exactly `Error: devflow: unknown command "board frob"\n`; no `USAGE`; return non‑zero                                |
| 7  | automated | `src/cli/dispatch_test.ts`: `runCli(["board", "init"])` (missing positional) with `NO_COLOR=1`                                            | stderr is exactly `Error: devflow board init: board name required\n`; no `USAGE`; return non‑zero                              |
| 8  | automated | `src/cli/dispatch_test.ts`: `runCli(["card", "show"])` (missing id) with `NO_COLOR=1`                                                     | stderr is exactly `Error: devflow card show: card id required\n`; no `USAGE`; return non‑zero                                  |
| 9  | automated | `src/cli/dispatch_test.ts`: `runCli(["--verbose", "--summary", "validate"])` with `NO_COLOR=1`                                            | stderr is one `Error: devflow: …--verbose and --summary are mutually exclusive` line; no `USAGE`; return non‑zero              |
| 10 | automated | `src/cli/dispatch_test.ts`: `runCli(["totally-unknown"])` with colour enabled (simulate TTY or assert ANSI escapes when `colorsEnabled()` is true) | stderr starts with `\x1b[31mError:\x1b[0m` and contains grey `devflow:` segment; still no `USAGE`                              |
| 11 | automated | `src/cli/flags_test.ts`: `parseGlobalFlags` for `--help`, `-h`, and unknown flags                                                         | `help` flag true for `--help`/`-h`; otherwise pass-through into `remaining`                                                    |
| 12 | manual    | `./devflow board init` in a TTY                                                                                                           | one red `Error:` label, grey `devflow board init:` subject, default-colour `board name required`, no `USAGE` block             |
| 13 | manual    | `./devflow help` and `./devflow --help` in a TTY                                                                                          | same `USAGE` text on stdout as `./devflow`, exit `0`                                                                           |

## Build Tasks

<!-- phase-gate: complete by exit planning | all [x] by exit building -->

1. [ ] Add `help: boolean` to `ParsedFlags` in `src/cli/flags.ts`; teach
       `parseGlobalFlags` to recognise `--help` and `-h`. Update
       `src/cli/flags_test.ts` with the new cases.
2. [ ] In `runCli` (`src/cli/dispatch.ts`), after `parseGlobalFlags`/
       `validateGlobalFlags`, short-circuit to `console.log(USAGE.trimEnd())`
       + `return 0` when `flags.help` is true **or** when
       `flags.remaining.length === 0` **or** when the first remaining token is
       `help` (no further positional required). Place this before
       `resolveGitRoot` so it works outside a repo.
3. [ ] Replace the global-flag error path in `runCli` (`console.error(flagError)`)
       with `logCliMessage({ kind: "error", command: "devflow", detail: flagError })`
       (strip any `devflow: ` prefix from `flagError` so it isn't duplicated).
4. [ ] Replace the two `Unknown command` blocks in `runCli` with a single
       `logCliMessage({ kind: "error", command: "devflow", detail: `unknown
       command "${flags.remaining.join(" ")}"` })`; delete the
       `console.log(USAGE.trimEnd())` that followed each.
5. [ ] Replace the `--ignore-lock` rejection `console.error(...)` with a
       `logCliMessage` call (`command: "devflow"`, detail explains the
       unsupported flag).
6. [ ] Sweep `src/cli/dispatch.ts` handlers: for every
       `console.error("devflow <cmd>: <thing> required\n")` +
       `console.log(USAGE.trimEnd())` pair, replace with
       `logCliMessage({ kind: "error", command: "devflow <cmd>", detail: "<thing>
       required" })` (no trailing `\n`, no `USAGE`). Cover all sites listed in
       Impact Analysis → Scope.
7. [ ] Audit remaining `console.error(...)` / `logError(...)` sites in
       `dispatch.ts` (catch blocks at ~225, 260, 353, 485, 509, 537, 541, 561,
       565, 582, 586, and the `logError` at ~139). Where the message already
       follows `devflow <cmd>: <subject>: <detail>` shape, convert to
       `logCliMessage({ kind: "error", … })` for the consistent `Error:` label
       and colour; otherwise leave as-is and note exception in Build Notes.
8. [ ] Create `src/cli/dispatch_test.ts` covering Test Scenarios #2–#10
       (capture stdout/stderr via `console.log`/`console.error` spies or by
       wrapping `Deno.stdout.write`; existing tests in
       `src/commands/machine-stdout_test.ts` and
       `src/services/console_test.ts` show the pattern).
9. [ ] Update `docs/devflow-requirements.md` §16.0 (add `devflow help` row),
       §16.1 (add `--help` / `-h` row, note they print usage and exit `0`),
       and §16.2 (clarify that argument / parse errors emit only the structured
       `Error:` line, never `USAGE`).
10. [ ] Update `docs/architecture.md` §8: change the "Usage / flag error" row
        to read `Error only (no usage)`; add a note that the usage block is
        printed exclusively by `devflow`, `devflow help`, and `--help`/`-h`.
11. [ ] Update `README.md` Commands section: list `devflow help` and the
        global `--help` / `-h` flag; add a one-line note that argument errors
        no longer print the usage block.
12. [ ] Run `deno test` and confirm green; run `./devflow`, `./devflow help`,
        `./devflow --help`, `./devflow bogus`, and `./devflow board init`
        manually (TTY) to confirm the observable behaviour in Test Scenarios
        #12–#13.
13. [ ] Tick every Acceptance Criterion in this card and record any deviations
        in **Build Notes**.

## Spec Updates

<!-- phase-gate: planned by exit planning | completed by exit finishing -->

| Document                       | Planned change                                                                                  | Status  |
| ------------------------------ | ----------------------------------------------------------------------------------------------- | ------- |
| `docs/devflow-requirements.md` | §16.0 add `help` verb / `--help` flag; §16.2 confirm `Error:` label is universal for CLI errors | pending |
| `docs/architecture.md`         | §8 update "Usage / flag error" row: error only, no usage block                                  | pending |
| `README.md`                    | Document `devflow help` / `--help` in command list                                              | pending |

## Notes

<!-- phase-gate: optional; ongoing across phases -->

### Planning decisions

- **Per-subcommand `--help` is out of scope.** Top-level only: `--help` /
  `-h` and the `help` verb all print the global `USAGE` and exit `0`. A
  follow-up card can add per-subcommand help if needed.
- **Canonical unknown-command error string:**
  `Error: devflow: unknown command "<token(s)>"` — single quotes around the
  literal token(s) the user typed (joined with one space for the
  object+verb case). Matches the `logCliMessage` shape used elsewhere.
- **`help` is handled in `runCli`, not `parseCommand`.** Keeps the
  object/verb parser focused; future `devflow <object> help` could still be
  added without affecting this path.
- **`-h` short flag is safe to claim globally** — no existing CLI uses it
  (verified by grep across `src/cli/`).
- **`flagError` is already prefixed with `devflow: ` in `flags.ts`.** When
  routing through `logCliMessage` (whose own format prefixes `Error: devflow:`),
  strip the existing `devflow: ` prefix from the string so we don't double it.
  Build Tasks #3 calls this out explicitly.
- **Spec edits are part of this story.** Architecture §8 currently mandates
  "Error + usage"; this story changes that contract. Per AGENTS.md immutable
  docs rule, the user has explicitly accepted the objectives in this card
  (see Acceptance Criterion #7); finishing must not land without the doc
  updates listed in Spec Updates.
- **`StoryDetail says `./devtools`** in the original brief — interpreted as
  `./devflow` (project entry script). If the author meant something else,
  raise in verifying.

### Open questions

- None blocking. Per-subcommand help is deferred (see decision above).

## Build Notes

<!-- phase-gate: started by exit building | complete by exit finishing -->

_As-built log: what was implemented, deviations from plan, follow-ups._

## Related Cards

<!-- phase-gate: complete or explicit none by exit preparing -->

_None._

## Attachments

<!-- phase-gate: optional preparing–building | evidence by exit verifying when cited in ACs -->

_None._
