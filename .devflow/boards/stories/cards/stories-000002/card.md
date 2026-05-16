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

- [x] `docs/devflow-requirements.md` §6.2 — Card creation steps 6–8 (write
      directory / `state.json` / `card.md`) and the atomicity rule that
      `nextSequence` must not be consumed if the card directory is not
      finalized.
- [x] `docs/devflow-requirements.md` §16.4 / line 1442 — `card create` machine
      stdout contract: `<card-id>\n`, no colour codes. Must remain unchanged.
- [x] `docs/devflow-requirements.md` §15 (CLI surface table around line 1321)
      and §17 (validation/error handling) — flag additions and error reporting
      patterns.
- [x] `docs/architecture.md` — CLI layer (`src/cli/parser.ts`,
      `src/cli/dispatch.ts`, per-command flag modules under `src/cli/*-flags.ts`)
      → `src/commands/create-card.ts` → domain/infra. New `--description` /
      `--description-file` parsing belongs in a new flags module, mirroring
      `add-file-flags.ts`.
- [x] `docs/adr/` — no existing ADR governs CLI flag naming or description
      input; no new ADR required (this is an additive CLI change, not a
      hard-to-reverse architectural decision).
- [x] `docs/implementation-roadmap.md` — `card create` is part of the
      already-shipped core CLI milestone; this story is an enhancement and
      does not introduce a new milestone.

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

### Scope

- **CLI parsing**
  - New `src/cli/create-card-flags.ts` exporting
    `parseCreateCardArgs(args: string[]): { boardName, title, description? }`,
    handling `--description <text>` and `--description-file <path>` and their
    mutual exclusion. Mirrors the shape of `src/cli/add-file-flags.ts`.
  - `src/cli/dispatch.ts` — `card:create` handler switches from ad-hoc
    destructuring of `positional` to the new parser; passes the resolved
    description string (or `undefined`) into `createCard`.
  - `src/cli/parser.ts` — no change; existing synonym mapping for `create-card`
    is sufficient.
- **Command implementation**
  - `src/commands/create-card.ts` — `createCard` signature extended with an
    optional `description?: string`. When present, `card.md` is written as
    `\`# ${title}\n\n${description}\n\`` with trailing newlines on the body
    normalised to a single `\n`. When absent, behaviour is byte-identical to
    today (`# <title>\n`).
  - File I/O for `--description-file` (read + empty/missing validation) happens
    in the flags layer **before** the board lock is acquired and before any
    state mutation, so failures cannot consume `nextSequence`.
- **User-visible behaviour**
  - New flags appear in `USAGE` and `README.md`.
  - Stdout for `card create` remains exactly `<card-id>\n`; stderr carries the
    new validation errors (mutual exclusion, missing file, empty content).
  - Exit codes: `0` on success, `1` on validation/IO failures (consistent with
    existing `card create` error path).
- **Tests**
  - `src/commands/create-card_test.ts` extended.
  - New `src/cli/create-card-flags_test.ts` for pure flag parsing.

### Risks and constraints

- **Backwards compatibility (req §6.2, §16.4):** any change to title-only
  stdout, `card.md` byte layout, or exit codes would break machine consumers
  and existing scripts. AC 1 pins this.
- **Atomicity (req §6.2):** validation and file reads must happen before the
  board lock and before `nextSequence` is incremented; otherwise a bad
  `--description-file` could leave a partial `.tmp` dir or burn a sequence.
  This pushes file-reading into the flags layer (or a pre-lock step in
  `createCard`), not into the temp-dir assembly block.
- **Encoding / large files:** description files are read as UTF-8 text via
  `Deno.readTextFile`; no streaming. Practical card descriptions are small,
  but a hostile multi-megabyte file would be loaded into memory. Acceptable
  for v1; documented in Notes.
- **TTY vs machine output (req §16.2/§16.4):** all new errors go to stderr via
  the existing `console.error` path used in dispatch; stdout stays clean.
- **Flag ergonomics:** `--description` vs `--description-file` are mutually
  exclusive; the parser must detect this even when the two flags appear in
  either order or with `=` syntax (decision in Notes: support space-separated
  form only, matching existing flag style in `add-file-flags.ts`).
- **No ADR impact:** additive CLI change; no new architectural rule introduced.

## Test Scenarios

<!-- phase-gate: complete by exit planning | executed by exit verifying -->

| #  | Type      | Scenario                                                                                                                                                                                  | Expected                                                                                                            |
| -- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 1  | automated | `deno test src/commands/create-card_test.ts` — title-only invocation                                                                                                                       | `card.md` equals `# <title>\n` exactly; stdout is `<card-id>\n`; `nextSequence` incremented by 1.                   |
| 2  | automated | `deno test src/commands/create-card_test.ts` — `--description "hello world"`                                                                                                              | `card.md` equals `# <title>\n\nhello world\n`; stdout unchanged; exit 0.                                          |
| 3  | automated | `deno test src/commands/create-card_test.ts` — `--description-file <tmp>` where tmp contains `"line1\nline2\n\n"`                                                                          | `card.md` equals `# <title>\n\nline1\nline2\n` (trailing newlines normalised to one); exit 0.                     |
| 4  | automated | `deno test src/cli/create-card-flags_test.ts` — both `--description` and `--description-file` supplied                                                                                     | parser throws with a clear mutual-exclusion message; dispatch returns exit 1; no card directory created; `nextSequence` unchanged. |
| 5  | automated | `deno test src/commands/create-card_test.ts` — `--description-file /does/not/exist`                                                                                                        | exit 1 with stderr mentioning the path; no card directory; `nextSequence` unchanged.                                 |
| 6  | automated | `deno test src/commands/create-card_test.ts` — `--description ""` and `--description-file <empty-file>`                                                                                   | exit 1 with stderr `… empty …`; no card directory; `nextSequence` unchanged.                                         |
| 7  | automated | `deno test src/commands/create-card_test.ts` — failure path leaves no `.<cardId>.tmp.<pid>` directory under the board's `cards/`                                                            | board `cards/` listing contains no stray temp dirs after each negative case.                                         |
| 8  | manual    | In a TTY: `./devflow card create stories "T" --description-file ./missing` then `./devflow card create stories "T" --description "hi"`; check that errors are coloured per §16.2 and the success path prints only the card ID. | error rendered red on stderr; success prints just the card ID on stdout with no colour codes.                        |

## Build Tasks

<!-- phase-gate: complete by exit planning | all [x] by exit building -->

1. [ ] Add `src/cli/create-card-flags.ts` with `parseCreateCardArgs` covering
       `--description`, `--description-file`, mutual exclusion, missing-file
       detection, and empty-content rejection (file read happens here).
2. [ ] Add `src/cli/create-card-flags_test.ts` covering the parser behaviour
       in isolation (no filesystem side effects beyond a tmp file).
3. [ ] Extend `createCard` in `src/commands/create-card.ts` with an optional
       `description?: string` parameter; when present, write
       `# <title>\n\n<description>\n` (normalising trailing newlines).
4. [ ] Update the `card:create` handler in `src/cli/dispatch.ts` to use
       `parseCreateCardArgs` and forward the description; update `USAGE` to
       show the new flags.
5. [ ] Extend `src/commands/create-card_test.ts` with the cases listed in
       Test Scenarios rows 1–3 and 5–7 (success variants, missing file,
       empty content, no temp-dir leak, `nextSequence` invariants).
6. [ ] Update `README.md` with the new flags and a short example for each.
7. [ ] Run `deno test` and `./devflow validate` (sanity) and fix any
       regressions.
8. [ ] If the user approves the §6.2 spec extension, update
       `docs/devflow-requirements.md` accordingly (see Spec Updates / Notes).

## Spec Updates

<!-- phase-gate: planned by exit planning | completed by exit finishing -->

| Document                       | Planned change                                                   | Status  |
| ------------------------------ | ---------------------------------------------------------------- | ------- |
| `docs/devflow-requirements.md` | Extend §6.2 to describe optional `--description` / `--description-file` inputs and their validation rules. **Requires user approval** (AGENTS.md immutable doc rule). | pending (blocked on user approval) |
| `docs/architecture.md`         | None. CLI surface only; no module boundary or dependency direction changes.                                                                                          | n/a                                |
| `docs/adr/`                    | None. Additive CLI flag; no new architectural decision.                                                                                                              | n/a                                |
| `README.md`                    | Document `--description` and `--description-file` under the `card create` usage section; include one inline and one file example.                                    | pending                            |
| `docs/implementation-roadmap.md` | Note completion of this enhancement under the existing card-create milestone if/when the roadmap is updated as part of this story.                                  | pending                            |

## Notes

<!-- phase-gate: optional; ongoing across phases -->

Planning decisions:

- **Flag names:** keep long forms only — `--description <text>` and
  `--description-file <path>`. No short aliases for v1, matching the existing
  style of `add-file-flags.ts` (`--overwrite`, `--ignore-lock`). Easier to
  evolve later if requested.
- **Stdin sentinel (`-`) for `--description-file`:** out of scope for this
  story. Can be added later without breaking changes; tracked here as a
  follow-up.
- **Attachment vs inline:** description content is **inlined into `card.md`
  only**; it is not also copied into `files/`. `add-card-file` remains the
  dedicated path for attachments. Rationale: description is the card's body,
  not an attachment, and double-storing would invite drift.
- **Interaction with `prepare-story`:** no change required. The skill already
  reads whatever body exists in `card.md`; passing a description at creation
  time simply means the body is non-empty before the preparing phase runs.
  The skill's preconditions (title heading + body sections) continue to be
  evaluated against the resulting file.
- **Ordering of validation vs lock:** all input validation (mutual exclusion,
  file existence, file read, empty-content check) is performed in the flags
  layer **before** `createCard` acquires the board lock, so a bad input can
  never burn a `nextSequence` value or leave a `.tmp` directory.
- **Newline normalisation:** body content (whether `--description` string or
  file contents) is right-trimmed of trailing newlines and a single `\n` is
  appended, so `card.md` always ends with exactly one newline regardless of
  input shape. This keeps diffs and downstream parsers stable.
- **Encoding:** description file is read with `Deno.readTextFile` (UTF-8).
  Binary files are out of scope; if non-UTF-8 input becomes a real need we
  can add an explicit `--description-file-binary` later.

Open questions for the user (do not block planning, but flagged):

- Spec change to `docs/devflow-requirements.md` §6.2 is **planned but
  blocked** on explicit user approval per AGENTS.md. If approval is
  withheld, the implementation still ships and only the README is updated;
  the spec drift is then tracked as a follow-up card.

## Build Notes

<!-- phase-gate: started by exit building | complete by exit finishing -->

_To be completed in building._

## Related Cards

<!-- phase-gate: complete or explicit none by exit preparing -->

_None._

## Attachments

<!-- phase-gate: optional preparing–building | evidence by exit verifying when cited in ACs -->

_Screenshots, logs, or files under `files/`._
