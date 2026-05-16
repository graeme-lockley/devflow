# Expand the create-card which allows a description to be passed or a file attached that has the card content

As a story author (human or agent), I want `devflow card create` to accept an
initial description—either inline or from a file—so that the freshly created
`card.md` already carries the body content that downstream skills such as
`preparing-002-do-create-story` / **prepare-story** need, instead of starting from just a title.

## Current State

<!-- phase-gate: complete by exit preparing -->

- `devflow card create <board> <title>` in `src/commands/create-card.ts` only
  accepts a title. The newly created `card.md` is written with a single line:
  `# <title>\n` (see `Deno.writeTextFile(\`${tmpDir}/card.md\`, …)`).
- The CLI parser/dispatch path (`src/cli/parser.ts`, `src/cli/dispatch.ts`,
  `src/commands/create-card.ts`) has no flag for description input and no
  file-attachment plumbing during creation.
- Skills like `prepare-story` rely on a hand-edited prose body in `card.md`
  before they can populate the preparing template (`StoryDetail` input). Today
  that prose has to be added in a separate manual step after `card create`.
- A separate command, `devflow card add-file` (`src/commands/add-card-file.ts`),
  exists for attachments after creation but is not invoked from `card create`.
- Tests in `src/commands/create-card_test.ts` cover only the title-only path.

## Objectives

<!-- phase-gate: complete by exit preparing -->

1. Allow callers of `devflow card create` to supply an initial description as a
   string and have it written into `card.md` below the title heading.
2. Allow callers to supply the description via a file path whose contents
   become the body of `card.md` (preferred for multi-line or templated input).
3. Treat the title-only invocation as fully backwards compatible: behaviour and
   stdout output are unchanged when no description/file is provided.
4. Validate inputs cleanly—description and file flags are mutually exclusive,
   missing files fail fast, and empty content is rejected with a clear error.
5. Keep the command atomic and lock-safe: failures while assembling the body
   must not consume `nextSequence` or leave a partial card directory, matching
   the rules in `docs/devflow-requirements.md` §6.2.

## Spec References

<!-- phase-gate: draft by exit preparing | complete by exit planning -->

_Specification and architecture pointers. Use paths and section anchors._

- [ ] `docs/devflow-requirements.md` — §6.2 Card creation; §17 validation;
      machine-output rules for `card create` (around line 1442)
- [ ] `docs/architecture.md` — CLI dispatch and command boundaries for
      `create-card`
- [ ] `docs/adr/` — review for any ADR covering CLI flag conventions or atomic
      card writes; add new ADR only if a new convention is introduced
- [ ] `docs/implementation-roadmap.md` — confirm milestone alignment for card
      creation enhancements

## Acceptance Criteria

<!-- phase-gate: draft by exit preparing | complete by exit planning | all [x] by exit verifying -->

1. [ ] `devflow card create <board> <title>` (no description) continues to
       write `card.md` containing exactly `# <title>\n` and prints the new card
       ID to stdout, preserving current behaviour.
2. [ ] `devflow card create <board> <title> --description "<text>"` writes a
       `card.md` whose first line is `# <title>` followed by a blank line and
       the supplied description text.
3. [ ] `devflow card create <board> <title> --description-file <path>` writes a
       `card.md` whose body is the contents of `<path>` placed below the title
       heading; trailing newlines are normalised to a single `\n` at EOF.
4. [ ] Passing both `--description` and `--description-file` exits non-zero
       with a clear error and creates no card (no sequence increment, no card
       directory left behind).
5. [ ] `--description-file` pointing at a missing or unreadable path exits
       non-zero with a clear error and creates no card.
6. [ ] An empty description (empty string or empty file) is rejected with a
       clear error and creates no card.
7. [ ] `deno test` passes, including new tests in
       `src/commands/create-card_test.ts` covering description, description
       file, mutual exclusion, missing file, and empty-content cases.
8. [ ] `README.md` and any affected CLI usage docs reflect the new flags
       (planned in Spec Updates; no doc drift after the story is done).

## Impact Analysis

<!-- phase-gate: complete by exit planning -->

_To be completed in planning._

### Scope

_Modules, commands, files, and user-visible behaviour affected._

### Risks and constraints

_Breaking changes, TTY vs machine output, locks, performance, dependencies._

## Test Scenarios

<!-- phase-gate: complete by exit planning | executed by exit verifying -->

| # | Type      | Scenario                                                          | Expected                                     |
| - | --------- | ----------------------------------------------------------------- | -------------------------------------------- |
| 1 | automated | `deno test` covering title-only, `--description`, `--description-file`, mutual exclusion, missing file, empty content | all pass; stdout is unchanged for title-only |

## Build Tasks

<!-- phase-gate: complete by exit planning | all [x] by exit building -->

1. [ ] _To be completed in planning._

## Spec Updates

<!-- phase-gate: planned by exit planning | completed by exit finishing -->

| Document                       | Planned change                                                   | Status  |
| ------------------------------ | ---------------------------------------------------------------- | ------- |
| `docs/devflow-requirements.md` | Extend §6.2 to describe optional description / description-file inputs | pending |
| `docs/architecture.md`         | none expected (CLI surface only); confirm during planning        | pending |
| `README.md`                    | Document new `--description` and `--description-file` flags      | pending |

## Notes

<!-- phase-gate: optional; ongoing across phases -->

- Flag names (`--description` / `--description-file`) are a proposal; planning
  should confirm short forms (`-d`, `-f`?) and whether `-` is supported as
  stdin sentinel for `--description-file`.
- Decide in planning whether `add-card-file` should be reused to also attach
  the source file under `files/`, or whether description input is purely
  inlined into `card.md` and attachments remain a separate concern.
- Confirm interaction (if any) with skill `prepare-story`: does it need to be
  taught to skip the title-only fallback once a description is already present?

## Build Notes

<!-- phase-gate: started by exit building | complete by exit finishing -->

_To be completed in building._

## Related Cards

<!-- phase-gate: complete or explicit none by exit preparing -->

_None._

## Attachments

<!-- phase-gate: optional preparing–building | evidence by exit verifying when cited in ACs -->

_Screenshots, logs, or files under `files/`._
