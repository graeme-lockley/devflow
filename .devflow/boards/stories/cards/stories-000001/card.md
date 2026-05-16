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

- [ ] `docs/devflow-requirements.md` — §5.4 (board show), §16.2–16.4 (console /
      TTY output rules)
- [ ] `docs/architecture.md` — CLI command and services (console) layering
- [ ] `docs/adr/` — N/A (no new architectural decision expected)
- [ ] `docs/implementation-roadmap.md` — confirm whether board-show polish is
      tracked under an existing milestone or is purely cosmetic follow-up

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

_To be completed in planning._

### Risks and constraints

_To be completed in planning._

## Test Scenarios

<!-- phase-gate: complete by exit planning | executed by exit verifying -->

| # | Type      | Scenario                | Expected             |
| - | --------- | ----------------------- | -------------------- |
| 1 | automated | _e.g. deno test …_      | _pass_               |
| 2 | manual    | _Given … When … Then …_ | _observable outcome_ |

## Build Tasks

<!-- phase-gate: complete by exit planning | all [x] by exit building -->

_To be completed in planning._

## Spec Updates

<!-- phase-gate: planned by exit planning | completed by exit finishing -->

| Document                       | Planned change | Status  |
| ------------------------------ | -------------- | ------- |
| `docs/devflow-requirements.md` | _none / §…_    | pending |
| `docs/architecture.md`         | _none / …_     | pending |
| `README.md`                    | _none / …_     | pending |

## Notes

<!-- phase-gate: optional; ongoing across phases -->

Open questions for planning:

- Should the card listing read each card’s `state.json` directly, or extend an
  existing store helper? Confirm in architecture review.
- Tabular layout vs. simple aligned columns — pick an approach consistent with
  any future `card list` command to avoid divergent styles.
- Confirm whether bold/emphasis ANSI belongs in `services/console.ts` as a new
  helper (e.g. `emphasise`) alongside grey/green/red.
- Verify TTY detection policy: req §16.4 ties styling to stderr TTY; ensure
  stdout-only consumers (pipes, scripts) still get plain text.

## Build Notes

<!-- phase-gate: started by exit building | complete by exit finishing -->

_To be completed in building._

## Related Cards

<!-- phase-gate: complete or explicit none by exit preparing -->

_None._

## Attachments

<!-- phase-gate: optional preparing–building | evidence by exit verifying when cited in ACs -->

_Screenshots, logs, or files under `files/`._
