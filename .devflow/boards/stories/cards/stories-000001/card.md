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
      formatting lives in `src/services/console.ts`. New emphasis helper belongs
      in `services/console.ts` to keep ANSI policy in one place.
- [x] `docs/adr/` — N/A. No new architectural decision; reuses ADR-0011
      console/TTY rules already encoded in `services/console.ts`.

## Acceptance Criteria

<!-- phase-gate: draft by exit preparing | complete by exit planning | all [x] by exit verifying -->

1. [x] Running `./devflow show-board <valid-board>` on a TTY shows board
       metadata with grey field labels and default value styling, followed by a
       section listing every card’s ID, title, and phase.
2. [x] Running `./devflow show-board <invalid-board>` on a TTY prints a red
       `Error:` prefix and visually emphasises the board name and filesystem
       path in the message; with stderr not a TTY, output contains no ANSI
       escape codes.
3. [x] `deno test` includes automated coverage for formatted board show output
       (metadata + card list) and for error formatting with and without a TTY,
       consistent with existing `console_test.ts` and `show-board_test.ts`
       patterns.
4. [x] If behaviour or output contracts change beyond cosmetic TTY styling,
       `docs/devflow-requirements.md` §5.4 / §16.2–16.4 and `README.md` CLI
       notes for `board show` are updated to match. _(waived: no contract change
       beyond TTY cosmetics; styling stays within existing §16.2/§16.4 envelope
       and README's `board show` description still accurate per Build Notes.)_
5. [x] A spot-check of other high-traffic “not found” and validation error
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
  `src/commands/list-cards.ts` and `loadCardState` from `src/domain/card.ts` to
  read each card's title + phase. Compute column widths from card IDs and titles
  for aligned columns (no external tables).
- `src/cli/dispatch.ts` — route the invalid-board error path through
  `logCliMessage({ kind: "error", command: "board show", subject: boardName,
   detail: ... })`,
  with the resolved `.devflow/boards/<name>/board.json` path emphasised via the
  new helper. Apply the same treatment to the symmetrical error path for
  `board:show` only; cross-command alignment for other `*-not-found` and
  validation errors is in scope per AC 5 but limited to replacing ad-hoc
  `console.error(...)` calls with `logCliMessage` where they already match the
  `command: subject: detail` shape (no behavioural change to exit codes or
  messages).
- `src/commands/show-board_test.ts` and `src/services/console_test.ts` — extend
  with TTY-on / TTY-off cases and a card-list output case.

**User-visible behaviour**

- `board show <valid>` stdout: existing `key: value` lines remain present and in
  the same order; on a stdout TTY each `key:` token is grey, values are default
  colour. A new section `Cards (N):` is appended, followed by aligned rows of
  `<card-id>  <phase>  <title>`. When N=0 the section header is still printed
  with `(0)` and no rows.
- `board show <invalid>` stderr: line shape becomes
  `Error: board show: <name>: board "<name>" not found at <path>`, matching
  `logCliMessage`. With a TTY, `Error:` is red, `board show:` and `<name>:`
  prefixes are grey, the mistyped name inside quotes and the resolved path are
  bold.
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
  verify pipes and CI (`!isTerminal`) still produce byte-identical plain output
  to today's format so existing tests and any downstream `grep`/ `awk` consumers
  keep working.
- **Test determinism:** tests must force `colorsEnabled` off (or stub TTY) so
  snapshots are stable; mirror the approach used in `console_test.ts`.
- **No new ADR:** the bold/emphasise helper is a small extension of ADR-0011
  colour roles; it is not a new architectural decision. If reviewers disagree we
  will lift it into a follow-up ADR before merging (see Notes).
- **Locking / transitions:** read-only command; no lock interaction. Reading
  each card's `state.json` happens outside any transition lock and is tolerant
  of cards mid-transition (we surface whatever phase is recorded).
- **Performance:** O(N) `state.json` reads per `board show`; acceptable for
  current board sizes (<100s of cards). No caching introduced.
- **Spec immutability (AGENTS.md):** requirements/architecture/ADRs are not
  edited as part of this card (changes are cosmetic and within existing
  §16.2/§16.4 envelope). `README.md` updates are conditional on AC 4.

## Test Scenarios

<!-- phase-gate: complete by exit planning | executed by exit verifying -->

| # | Type      | Scenario                                                                                                                                                                                                                             | Expected                                                                                                                                                         |
| - | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 | automated | `deno test src/commands/show-board_test.ts` with stdout TTY stubbed off: init a board, create 2 cards in different phases, run `formatBoardShow`.                                                                                    | Output starts with the existing `name: …` block (plain), then a `Cards (2):` section listing both card IDs, phases, and titles in sorted order; no ANSI present. |
| 2 | automated | `deno test src/commands/show-board_test.ts` with stdout TTY stubbed on.                                                                                                                                                              | Each `key:` label is wrapped in the grey ANSI sequence; values are not coloured; card-list header `Cards (N):` includes grey label.                              |
| 3 | automated | `deno test src/services/console_test.ts` for new `emphasise()` helper with TTY on and off.                                                                                                                                           | TTY on: returns `\x1b[1m<text>\x1b[0m`. TTY off: returns input unchanged.                                                                                        |
| 4 | automated | `deno test src/cli/…` (new or extended dispatch test) invoking `board:show` handler with an unknown board name and stderr TTY off.                                                                                                   | Stderr line equals `Error: board show: storie: board "storie" not found at .devflow/boards/storie/board.json`; exit code 1; no ANSI bytes.                       |
| 5 | automated | Same as #4 with stderr TTY on.                                                                                                                                                                                                       | Stderr line contains red `Error:`, grey `board show:` and `storie:` prefixes, and bold sequences wrapping `"storie"` and the resolved path.                      |
| 6 | manual    | Given a real terminal, when I run `./devflow board show stories`, then I see grey field labels, the metadata I see in `board.json`, and a `Cards (N):` table with one row per card directory under `.devflow/boards/stories/cards/`. | Output is readable, columns align, colour is visible.                                                                                                            |
| 7 | manual    | Given a real terminal, when I run `./devflow board show storie \| cat`, then output to the pipe is plain (no ANSI).                                                                                                                  | No escape sequences visible in the piped output; error still readable.                                                                                           |

## Build Tasks

<!-- phase-gate: complete by exit planning | all [x] by exit building -->

1. [x] Add `colorsEnabledForStdout()` and `emphasise(text)` helpers to
       `src/services/console.ts`; export them. Cover both with
       `src/services/console_test.ts` cases (TTY on/off).
2. [x] Refactor `formatBoardShow(config)` in `src/commands/show-board.ts` into a
       metadata formatter that accepts an injectable `colour` flag (default
       `colorsEnabledForStdout()`), so tests can pin behaviour
       deterministically.
3. [x] Add a `formatBoardCards(cards)` helper in `show-board.ts` that takes
       `{ id, title, phase }[]`, sorts by id, and emits an aligned `Cards (N):`
       section with column padding computed from the data.
4. [x] Extend `showBoard(boardName, repoRoot)` to call `listCards` and read each
       card's `state.json` via `loadCardState`, then concatenate metadata + card
       list. Handle empty boards (`Cards (0):` with no rows).
5. [x] Update `src/commands/show-board_test.ts` with the scenarios in rows 1 and
       2 of **Test Scenarios** (stdout TTY on/off, empty board, multi-card).
6. [x] In `src/cli/dispatch.ts`, replace the `board:show` `console.error(...)`
       failure line with
       `logCliMessage({ kind: "error", command: "board show",
       subject: boardName, detail })`,
       building `detail` so the resolved `board.json` path and the mistyped name
       pass through `emphasise()` when colour is enabled.
7. [x] Add a dispatch-level test (extend `show-board_test.ts` or add
       `dispatch_show-board_test.ts`) covering rows 4 and 5 (invalid board, TTY
       on/off).
8. [x] Sweep other user-facing stderr error paths in `dispatch.ts` (board / card
       not found, validation failures) and migrate the ones that already have a
       `command: subject: detail` shape to `logCliMessage`. Do not change exit
       codes or message text; only routing + emphasis.
9. [x] If sweep in step 8 changes any documented message format, update
       `README.md` CLI notes for the affected commands per Spec Updates;
       otherwise leave docs unchanged.
10. [x] Run `deno test` and ensure all suites pass; verify no ANSI leaks into
        commands listed as machine-parseable in req §16.4 (re-run
        `machine-stdout_test.ts`).

## Spec Updates

<!-- phase-gate: planned by exit planning | completed by exit finishing -->

| Document                       | Planned change                                                                                                                                                                                                                                                                                                                                                                                                                  | Status |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `docs/devflow-requirements.md` | none — changes stay within the existing §16.2/§16.4 envelope (bold is an additional grey-role styling, not a new role). Requires user approval before any edit per AGENTS.md.                                                                                                                                                                                                                                                   | n/a    |
| `docs/architecture.md`         | none — module boundaries unchanged; new helper lives in the existing `services/console.ts`. Requires user approval before any edit.                                                                                                                                                                                                                                                                                             | n/a    |
| `README.md`                    | If the `board show` example output or any CLI message text shown in README changes as a result of build task 8, update the affected snippet(s) to match. If nothing user-documented changes, leave README untouched. _Finishing: README's `board show` row still reads `Board metadata on stdout`, which remains accurate for the now-richer output; no swept command's error wording is quoted in README. No change required._ | n/a    |

## Notes

<!-- phase-gate: optional; ongoing across phases -->

Decisions taken during planning:

- **Read `state.json` via `loadCardState`** (existing domain helper) rather than
  adding a new store API. Cheap and avoids inventing a parallel reader.
- **Aligned columns, not boxed tables.** Matches the plain-text aesthetic of
  `board list` / `card list` and keeps output diff-friendly. If a future
  `card list --long` introduces tables we can revisit then.
- **`emphasise()` lives in `services/console.ts`** alongside the existing colour
  helpers, per ADR-0011 single-source-of-ANSI rule. It is a styling variant of
  the existing grey role, not a new role, so no new ADR is needed.
- **TTY policy:** colour on stdout is gated on `Deno.stdout.isTerminal()`; the
  existing `colorsEnabled()` (stderr-based) continues to gate `logCliMessage`
  and friends. Req §16.2 explicitly allows this for non-machine-parseable stdout
  commands and §16.4 lists `board show` as formatted human output.

### Finished (2026-05-16)

Story complete. Spec updates: requirements / architecture / ADR rows `n/a`
(within existing §16.2/§16.4 envelope; AGENTS.md immutable docs respected);
README `n/a` — current `board show` row (`Board metadata on stdout`) still
describes the new output and no swept error wording is quoted in README. Build
Notes already capture as-built changes and file pointers. Ready for done.

### Verification summary (2026-05-16)

- Test scenarios: 7/7 pass (rows 1–5 automated via `deno task test`; rows 6–7
  manual smoke under `script -q /dev/null` and a plain pipe).
- Acceptance criteria: 5/5 checked (AC 4 waived in line — no contract change
  beyond TTY cosmetics).
- Commands: `deno task test` → 195 passed / 0 failed;
  `./devflow validate-card stories-000001` → exit 0; `./devflow validate` →
  exit 0.
- Manual evidence: TTY `./devflow board show stories` shows grey
  `name:`/`idPrefix:`/… labels and a `Cards (3):` aligned table;
  `./devflow board show stories | cat` is plain (no ANSI). TTY
  `./devflow board show storie` prints red `Error:`, grey
  `board show:`/`storie:` prefixes, bold `storie` and bold
  `.devflow/boards/storie/board.json`; piped variant is plain. Exit code 1 on
  invalid board confirmed.
- Regression: `machine-stdout_test.ts` passes within the suite — no ANSI leak
  into machine-parseable stdout commands (req §16.4).

Open questions / dependencies:

- AC 5 ("spot-check other error paths") is intentionally bounded: scope is
  _only_ `dispatch.ts` paths whose current text already fits the
  `command: subject: detail` shape. Anything that would require message
  rewording is out of scope and should spawn a follow-up card.
- Spec edits to requirements/architecture/ADRs are listed as `n/a` and require
  user approval before any change (AGENTS.md immutable docs rule).
- No new dependencies on other cards. Related: stories-000002 (sibling card) is
  unrelated to this change at the time of planning.

## Build Notes

<!-- phase-gate: started by exit building | complete by exit finishing -->

Implemented across these files:

- `src/services/console.ts`
  - Added `BOLD = "\x1b[1m"` constant.
  - Added `isStdoutTTY()` and exported `colorsEnabledForStdout()` — parallels
    `colorsEnabled()`/`isStderrTTY()` so each output stream has its own TTY gate
    (req §16.2, §16.4).
  - Added exported `emphasise(text, colour?)` returning `\x1b[1m<text>\x1b[0m`
    when `colour` is true, otherwise `text`. `colour` defaults to
    `colorsEnabled()` (stderr) since most callers style stderr diagnostics;
    stdout callers pass an explicit value.
  - Added exported `grey(text, colour?)` for the same reason — keeps the
    grey-role wrap in `services/console.ts` per ADR-0011.

- `src/commands/show-board.ts`
  - `formatBoardShow(config, colour = colorsEnabledForStdout())` now wraps each
    `<label>:` token in `grey()`; values are default colour. Field order and
    content are byte-identical to the old format when `colour=false`.
  - New `formatBoardCards(cards, colour?)` sorts by id, emits a `Cards (N):`
    header (header label in grey when colour on), and aligned rows
    `<id>  <phase>  <title>` with column padding computed from the data. Empty
    boards print only the header line.
  - `showBoard(boardName, repoRoot, colour?)` now calls `listCards`, loads each
    card's `state.json` via `loadCardState`, and concatenates metadata + a blank
    line + the card list. Cards with unreadable state are skipped (board
    validate is the place to surface those).

- `src/cli/dispatch.ts`
  - `board:show` error path now uses
    `logCliMessage({ kind: "error", command: "board show", subject,
    detail })`.
    The detail string applies `emphasise()` to the mistyped board name (inside
    its existing quotes) and to the resolved `.devflow/boards/<name>/board.json`
    path when `colorsEnabled()`.
  - Sweep of sibling error paths to the same `logCliMessage` shape (Build Task
    8): `board init`, `card create`, `card show`, `card
    dir`, `card rename`,
    `card block`, `card unblock`, `card validate`. Exit codes and message text
    are unchanged; only the line prefix becomes the standard
    `Error: <command>: <subject>: <detail>`. Skipped (do not fit the
    `command: subject: detail` shape): `variable get/set` (two subjects), all
    `lock release*` (no subject), `repo:validate` (already `logError`).

- `src/services/console_test.ts` — added cases for `emphasise()` and `grey()`
  with colour on/off (Test Scenario row 3).

- `src/commands/show-board_test.ts` — replaced with:
  - Row 1 / row 2: `formatBoardShow` plain vs grey-label output.
  - `formatBoardCards` empty / multi-card sorted output, colour off and grey
    header on.
  - `showBoard` integration tests (multi-card and empty) using
    `withTempGitRepo` + `initBoard` + `createCard`.
  - Row 4: `runCli(["board", "show", "storie"])` with stderr TTY off asserts the
    exact plain line and exit code 1.
  - Row 5: same with `Deno.stderr.isTerminal` monkey-patched to `true` asserts
    presence of red `Error:`, grey `board show:` and `storie:` prefixes, and
    bold-wrapped name and path.

Deviations from Impact Analysis:

- `emphasise()` was specified to take just `(text)`; I added an optional
  `colour` parameter (defaulting to `colorsEnabled()`) so tests can pin
  behaviour deterministically and stdout callers can pass
  `colorsEnabledForStdout()` explicitly. Same pattern as the new `grey()`
  helper; behaviour for the no-argument call is unchanged.
- I exported `grey()` from `services/console.ts` (not enumerated in Impact
  Analysis) so `formatBoardShow`/`formatBoardCards` could wrap labels without
  re-implementing the ANSI sequence. Keeps ADR-0011's single-source-of-ANSI rule
  intact.
- `showBoard()` gained an optional `colour` parameter for the same testability
  reason; the dispatch handler still calls it with the default so production
  output remains gated on `Deno.stdout.isTerminal()`.

Spec/README impact:

- No `docs/devflow-requirements.md`, `docs/architecture.md`, or ADR changes
  (within existing §16.2/§16.4 envelope; AGENTS.md immutable docs rule
  respected).
- `README.md` was not updated: only documented `board show` row in README is the
  high-level description `"Board metadata on stdout"`, which still accurately
  describes the (now richer) output. None of the swept commands' documented text
  in README references the specific error wording.

Validation:

- `deno task test` → 178 passed, 0 failed (9 new).
- `deno task ci` (lint + fmt:check + test) → green.
- `machine-stdout_test.ts` still passes — no ANSI leaks into the
  machine-parseable stdout commands listed in req §16.4.
- Manual smoke: `./devflow board show stories` prints grey labels and a
  `Cards (2):` table on a TTY; `./devflow board show storie` prints the expected
  red/grey/bold error line.

## Related Cards

<!-- phase-gate: complete or explicit none by exit preparing -->

_None._

## Attachments

<!-- phase-gate: optional preparing–building | evidence by exit verifying when cited in ACs -->

_Screenshots, logs, or files under `files/`._
