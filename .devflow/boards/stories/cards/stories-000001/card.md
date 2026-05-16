# Beautify show-board

As a developer using Devflow, I want `devflow board show` (and `show-board`) to
present board metadata and every card on the board in a readable, colour-aware
layout, so I can quickly understand board configuration and story progress
without running multiple commands.

## Current State

`devflow board show` prints plain `field: value` lines to stdout via
`formatBoardShow` in `src/commands/show-board.ts`. There is no card listing—only
board metadata from `board.json`. When a board name is invalid, `dispatch.ts`
writes a single unstyled line to stderr (e.g.
`devflow board show storie: board "storie" not found at .devflow/boards/storie/board.json`).
The console service (`src/services/console.ts`) supports grey, green, and red
ANSI on stderr when attached to a TTY (req §16.2), but board-show errors do not
use `logError`, and there is no bold emphasis helper for key tokens in messages.

## Objectives

1. **Improve board metadata presentation** — Render board fields (name,
   idPrefix, phases, blockedPhase, sequence settings, timestamps) with
   light-grey labels and default-styled values on stdout when stderr is a TTY;
   remain plain when not a TTY so machine consumers stay unaffected (req §16.4).
2. **List all cards below metadata** — After board metadata, show every card on
   the board with card ID, title (from `state.json`), and current phase in a
   consistent tabular or aligned layout.
3. **Polish invalid-board errors** — For unknown board names, prefix stderr
   output with a red `Error:` label and emphasize the mistyped board name and
   the resolved `.devflow/boards/...` path (e.g. bold when TTY allows).
4. **Align error emphasis across CLI** — Review other user-facing error paths
   (board/card not found, validation failures) and apply the same emphasis
   conventions where stderr diagnostics are shown, without adding ANSI to
   machine-parseable stdout (req §16.4).

## Acceptance Criteria

1. [ ] Running `./devflow show-board <valid-board>` on a TTY shows board
       metadata with grey field labels and default value styling, followed by a
       section listing every card’s ID, title, and phase.
2. [ ] Running `./devflow show-board <invalid-board>` on a TTY prints a red
       `Error:` prefix and visually emphasizes the board name and filesystem
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

## Implementation Notes

_Add implementation details, design decisions, or technical considerations
here._

## Related Cards

_Link to related cards, epics, or dependencies._

## Attachments

_Attach relevant files, screenshots, or evidence._
