# Beautify show-board

As a developer using Devflow, I want `devflow board show` (and `show-board`) to
present board metadata and every card on the board in a readable, colour-aware
layout, so I can quickly understand board configuration and story progress
without running multiple commands.

## Current State

<!-- phase-gate: complete by exit preparing -->

`devflow board show` prints plain `field: value` lines to stdout via
`formatBoardShow` in `src/commands/show-board.ts`. There is no card listing—only
board metadata from `board.json`. When a board name is invalid, `dispatch.ts`
writes a single unstyled line to stderr (e.g.
`devflow board show storie: board "storie" not found at .devflow/boards/storie/board.json`).
The console service (`src/services/console.ts`) supports grey, green, and red
ANSI on stderr when attached to a TTY (req §16.2), but board-show errors do not
use `logError`, and there is no bold/emphasis helper for key tokens in messages.

## Objectives

<!-- phase-gate: complete by exit preparing -->

1. **Improve board metadata presentation** — Render board fields (name,
   idPrefix, phases, blockedPhase, sequence settings, timestamps) with
   light-grey labels and default-styled values on stdout when stderr is a TTY;
   remain plain when not a TTY so machine consumers stay unaffected (req §16.4).
2. **List all cards below metadata** — After board metadata, show every card on
   the board with card ID, title (from `state.json`), and current phase in a
   consistent tabular or aligned layout.
3. **Polish invalid-board errors** — For unknown board names, prefix stderr
   output with a red `Error:` label and emphasise the mistyped board name and
   the resolved `.devflow/boards/...` path (e.g. bold when TTY allows).
4. **Align error emphasis across CLI** — Review other user-facing error paths
   (board/card not found, validation failures) and apply the same emphasis
   conventions where stderr diagnostics are shown, without adding ANSI to
   machine-parseable stdout (req §16.4).

## Spec References

<!-- phase-gate: draft by exit preparing | complete by exit planning -->

_Specification and architecture pointers. Use paths and section anchors._

- [x] `docs/devflow-requirements.md` §5.4 (board configuration file —
      authoritative field list for board metadata rendering); §16.2 (console
      output: success/error/grey roles, TTY colour rule, machine-parseable
      stdout rule); §16.3 (`board show` command row); §16.4 (`board show` is
      formatted human output, not in the machine-parseable list — colour on
      stdout is permitted when stdout is a TTY).
- [x] `docs/architecture.md` — CLI layer (`src/cli/dispatch.ts`) dispatches to
      command modules (`src/commands/show-board.ts`, `list-cards.ts`); shared
      formatting lives in `src/services/console.ts`. New emphasis helper
      belongs in `services/console.ts` to keep ANSI policy in one place.
- [x] `docs/adr/` — N/A. No new architectural decision; reuses ADR-0011
      console/TTY rules already encoded in `services/console.ts`.
- [x] `docs/implementation-roadmap.md` — not tracked as a separate milestone;
      this is a cosmetic follow-up to the already-shipped `board show` and
      `card list` commands. Roadmap update not required.

## Acceptance Criteria

<!-- phase-gate: draft by exit preparing | complete by exit planning | all [x] by exit verifying -->

1. [ ] Running `./devflow show-board <valid-board>` on a TTY shows board
       metadata with grey field labels and default value styling, followed by a
       section listing every card’s ID, title, and phase.
2. [ ] Running `./devflow show-board <invalid-board>` on a TTY prints a red
       `Error:` prefix and visually emphasises the board name and filesystem
       path in the message; with stderr not a TTY, output contains no ANSI
       escape codes.
3. [ ] `deno test` includes automated coverage for formatted board show output
       (metadata + card list) and for error formatting with and without a TTY,
       consistent with existing `console_test.ts` and `show-board_test.ts`
       patterns.
4. [ ] If behaviour or output contracts change beyond cosmetic TTY styling,
       `docs/devflow-requirements.md` §5.4 / §16.2–16.4 and `README.md` CLI
       notes for `board show` are updated to match.
5. [ ] A spot-check of other high-traffic “not found” and validation error
       messages uses the same stderr emphasis rules where appropriate, with no
       ANSI leaked into commands documented as machine-parseable stdout.

## Impact Analysis

<!-- phase-gate: complete by exit planning -->

### Scope

**Modules / files touched**

- `src/services/console.ts` — add an `emphasise(text)` helper (bold via
   `\x1b[1m`/reset) and a `colorsEnabledForStdout()` predicate that checks
   `Deno.stdout.isTerminal()`; keep existing stderr-based `colorsEnabled()`
   untouched so log helpers behave the same.
- `src/commands/show-board.ts` — replace plain `formatBoardShow` with a
   formatter that emits grey labels + default values on stdout when stdout is a
   TTY, and a card-list section beneath the metadata. Reuse `listCards` from
   `src/commands/list-cards.ts` and `loadCardState` from `src/domain/card.ts`
   to read each card's title + phase. Compute column widths from card IDs and
   titles for aligned columns (no external tables).
- `src/cli/dispatch.ts` — route the invalid-board error path through
   `logCliMessage({ kind: "error", command: "board show", subject: boardName,
   detail: ... })`, with the resolved `.devflow/boards/<name>/board.json` path
   emphasised via the new helper. Apply the same treatment to the symmetrical
   error path for `board:show` only; cross-command alignment for other
   `*-not-found` and validation errors is in scope per AC 5 but limited to
   replacing ad-hoc `console.error(...)` calls with `logCliMessage` where they
   already match the `command: subject: detail` shape (no behavioural change
   to exit codes or messages).
- `src/commands/show-board_test.ts` and `src/services/console_test.ts` —
   extend with TTY-on / TTY-off cases and a card-list output case.

**User-visible behaviour**

- `board show <valid>` stdout: existing `key: value` lines remain present and
   in the same order; on a stdout TTY each `key:` token is grey, values are
   default colour. A new section `Cards (N):` is appended, followed by aligned
   rows of `<card-id>  <phase>  <title>`. When N=0 the section header is
   still printed with `(0)` and no rows.
- `board show <invalid>` stderr: line shape becomes
   `Error: board show: <name>: board "<name>" not found at <path>`, matching
   `logCliMessage`. With a TTY, `Error:` is red, `board show:` and `<name>:`
   prefixes are grey, the mistyped name inside quotes and the resolved path
   are bold.
- Exit codes are unchanged: `0` on success, `1` on any failure path.

**Stdout vs stderr**

- Board metadata + card list go to **stdout** (req §16.3, §16.4). Colour on
   stdout is gated on `Deno.stdout.isTerminal()` so pipes and redirects stay
   plain.
- Errors go to **stderr** via `logCliMessage`, gated on existing
   `colorsEnabled()` (stderr TTY).

### Risks and constraints

- **Machine-parseability (req §16.4):** `board show` is not in the
   machine-parseable list, so adding ANSI on a stdout TTY is permitted. Must
   verify pipes and CI (`!isTerminal`) still produce byte-identical plain
   output to today's format so existing tests and any downstream `grep`/
   `awk` consumers keep working.
- **Test determinism:** tests must force `colorsEnabled` off (or stub TTY) so
   snapshots are stable; mirror the approach used in `console_test.ts`.
- **No new ADR:** the bold/emphasise helper is a small extension of ADR-0011
   colour roles; it is not a new architectural decision. If reviewers disagree
   we will lift it into a follow-up ADR before merging (see Notes).
- **Locking / transitions:** read-only command; no lock interaction. Reading
   each card's `state.json` happens outside any transition lock and is
   tolerant of cards mid-transition (we surface whatever phase is recorded).
- **Performance:** O(N) `state.json` reads per `board show`; acceptable for
   current board sizes (<100s of cards). No caching introduced.
- **Spec immutability (AGENTS.md):** requirements/architecture/ADRs are not
   edited as part of this card (changes are cosmetic and within existing
   §16.2/§16.4 envelope). `README.md` updates are conditional on AC 4.

## Test Scenarios

<!-- phase-gate: complete by exit planning | executed by exit verifying -->

| # | Type      | Scenario                                                                                                                             | Expected                                                                                                                                                          |
| - | --------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 | automated | `deno test src/commands/show-board_test.ts` with stdout TTY stubbed off: init a board, create 2 cards in different phases, run `formatBoardShow`. | Output starts with the existing `name: …` block (plain), then a `Cards (2):` section listing both card IDs, phases, and titles in sorted order; no ANSI present. |
| 2 | automated | `deno test src/commands/show-board_test.ts` with stdout TTY stubbed on.                                                              | Each `key:` label is wrapped in the grey ANSI sequence; values are not coloured; card-list header `Cards (N):` includes grey label.                               |
| 3 | automated | `deno test src/services/console_test.ts` for new `emphasise()` helper with TTY on and off.                                           | TTY on: returns `\x1b[1m<text>\x1b[0m`. TTY off: returns input unchanged.                                                                                          |
| 4 | automated | `deno test src/cli/…` (new or extended dispatch test) invoking `board:show` handler with an unknown board name and stderr TTY off.   | Stderr line equals `Error: board show: storie: board "storie" not found at .devflow/boards/storie/board.json`; exit code 1; no ANSI bytes.                        |
| 5 | automated | Same as #4 with stderr TTY on.                                                                                                       | Stderr line contains red `Error:`, grey `board show:` and `storie:` prefixes, and bold sequences wrapping `"storie"` and the resolved path.                       |
| 6 | manual    | Given a real terminal, when I run `./devflow board show stories`, then I see grey field labels, the metadata I see in `board.json`, and a `Cards (N):` table with one row per card directory under `.devflow/boards/stories/cards/`. | Output is readable, columns align, colour is visible.                                                                                                             |
| 7 | manual    | Given a real terminal, when I run `./devflow board show storie \| cat`, then output to the pipe is plain (no ANSI).                  | No escape sequences visible in the piped output; error still readable.                                                                                            |

## Build Tasks

<!-- phase-gate: complete by exit planning | all [x] by exit building -->

1. [ ] Add `colorsEnabledForStdout()` and `emphasise(text)` helpers to
       `src/services/console.ts`; export them. Cover both with
       `src/services/console_test.ts` cases (TTY on/off).
2. [ ] Refactor `formatBoardShow(config)` in `src/commands/show-board.ts` into
       a metadata formatter that accepts an injectable `colour` flag (default
       `colorsEnabledForStdout()`), so tests can pin behaviour deterministically.
3. [ ] Add a `formatBoardCards(cards)` helper in `show-board.ts` that takes
       `{ id, title, phase }[]`, sorts by id, and emits an aligned
       `Cards (N):` section with column padding computed from the data.
4. [ ] Extend `showBoard(boardName, repoRoot)` to call `listCards` and read
       each card's `state.json` via `loadCardState`, then concatenate
       metadata + card list. Handle empty boards (`Cards (0):` with no rows).
5. [ ] Update `src/commands/show-board_test.ts` with the scenarios in rows 1
       and 2 of **Test Scenarios** (stdout TTY on/off, empty board, multi-card).
6. [ ] In `src/cli/dispatch.ts`, replace the `board:show` `console.error(...)`
       failure line with `logCliMessage({ kind: "error", command: "board show",
       subject: boardName, detail })`, building `detail` so the resolved
       `board.json` path and the mistyped name pass through `emphasise()` when
       colour is enabled.
7. [ ] Add a dispatch-level test (extend `show-board_test.ts` or add
       `dispatch_show-board_test.ts`) covering rows 4 and 5 (invalid board,
       TTY on/off).
8. [ ] Sweep other user-facing stderr error paths in `dispatch.ts` (board /
       card not found, validation failures) and migrate the ones that already
       have a `command: subject: detail` shape to `logCliMessage`. Do not
       change exit codes or message text; only routing + emphasis.
9. [ ] If sweep in step 8 changes any documented message format, update
       `README.md` CLI notes for the affected commands per Spec Updates;
       otherwise leave docs unchanged.
10. [ ] Run `deno test` and ensure all suites pass; verify no ANSI leaks into
        commands listed as machine-parseable in req §16.4 (re-run
        `machine-stdout_test.ts`).

## Spec Updates

<!-- phase-gate: planned by exit planning | completed by exit finishing -->

| Document                       | Planned change                                                                                                                                                                                                           | Status  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| `docs/devflow-requirements.md` | none — changes stay within the existing §16.2/§16.4 envelope (bold is an additional grey-role styling, not a new role). Requires user approval before any edit per AGENTS.md.                                            | n/a     |
| `docs/architecture.md`         | none — module boundaries unchanged; new helper lives in the existing `services/console.ts`. Requires user approval before any edit.                                                                                      | n/a     |
| `README.md`                    | If the `board show` example output or any CLI message text shown in README changes as a result of build task 8, update the affected snippet(s) to match. If nothing user-documented changes, leave README untouched.    | pending |

## Notes

<!-- phase-gate: optional; ongoing across phases -->

Decisions taken during planning:

- **Read `state.json` via `loadCardState`** (existing domain helper) rather
  than adding a new store API. Cheap and avoids inventing a parallel reader.
- **Aligned columns, not boxed tables.** Matches the plain-text aesthetic of
  `board list` / `card list` and keeps output diff-friendly. If a future
  `card list --long` introduces tables we can revisit then.
- **`emphasise()` lives in `services/console.ts`** alongside the existing
  colour helpers, per ADR-0011 single-source-of-ANSI rule. It is a styling
  variant of the existing grey role, not a new role, so no new ADR is needed.
- **TTY policy:** colour on stdout is gated on `Deno.stdout.isTerminal()`; the
  existing `colorsEnabled()` (stderr-based) continues to gate `logCliMessage`
  and friends. Req §16.2 explicitly allows this for non-machine-parseable
  stdout commands and §16.4 lists `board show` as formatted human output.

Open questions / dependencies:

- AC 5 ("spot-check other error paths") is intentionally bounded: scope is
  *only* `dispatch.ts` paths whose current text already fits the
  `command: subject: detail` shape. Anything that would require message
  rewording is out of scope and should spawn a follow-up card.
- Spec edits to requirements/architecture/ADRs are listed as `n/a` and require
  user approval before any change (AGENTS.md immutable docs rule).
- No new dependencies on other cards. Related: stories-000002 (sibling card)
  is unrelated to this change at the time of planning.

## Build Notes

<!-- phase-gate: started by exit building | complete by exit finishing -->

_To be completed in building._

## Related Cards

<!-- phase-gate: complete or explicit none by exit preparing -->

_None._

## Attachments

<!-- phase-gate: optional preparing–building | evidence by exit verifying when cited in ACs -->

_Screenshots, logs, or files under `files/`._
