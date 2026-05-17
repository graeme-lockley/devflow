# Devflow Requirements Document

**Product:** Devflow\
**Status:** Requirements specification

---

## 1. Purpose

Devflow is a deterministic workflow harness for managing filesystem-backed
development boards and AI-assisted delivery workflows.

The core purpose of Devflow is to allow a user or agent to advance work cards
through a defined sequence of phases while running a controlled sequence of
shell scripts at each phase boundary. These scripts may perform either
deterministic actions, such as file validation and Git checks, or
non-deterministic actions, such as invoking an LLM through `pi-mono` with a
specific skill.

Devflow itself is responsible for workflow orchestration, card state, locking,
history, and transition sequencing. LLMs are deliberately kept out of
orchestration. They operate only inside explicitly defined scripts, with bounded
input, bounded purpose, and deterministic success/failure signalling through
process exit codes.

Devflow produces an auditable, Git-backed workflow with manual recovery when
transitions fail.

---

## 2. Core Conceptual Model

Devflow is based on four primary concepts:

```text
Devflow
  ├── Board model
  ├── Card state model
  ├── Transition runner
  └── Script / skill execution model
```

A **board** defines an ordered sequence of phases and owns its own cards,
scripts, skills, and configuration.

A **card** is a durable unit of work. It has machine-readable state, a
human/agent-readable markdown body, optional attached files, and execution logs.

A **transition** is the process of advancing a card from one phase to another.
Transitions are deterministic and are controlled by Devflow.

A **script** is an executable task associated with a phase. Scripts are run in
lexical order when leaving a phase. Scripts may perform mechanical work, invoke
LLM tools, validate outputs, or modify repository files. Devflow creates Git
commits after successful hops; scripts must not commit during transitions.

A **skill** is a prompt/tooling package used by scripts, typically when invoking
`pi-mono`.

---

## 3. Design Principles

Devflow must follow these principles:

1. **Deterministic orchestration**
   - Devflow owns phase sequencing, locking, history, and state changes.
   - Scripts and LLMs do not orchestrate the workflow.

2. **Bounded LLM use**
   - LLM calls are isolated inside scripts.
   - Each LLM invocation must have a narrow, explicit task.
   - LLMs must not manage the workflow.

3. **Filesystem durability**
   - Boards, cards, scripts, skills, logs, and attachments are stored on the
     filesystem.
   - The filesystem is the primary durable store.

4. **Git-backed workflow**
   - Devflow boards live inside a Git repository.
   - Scripts may run Git read-only checks; Devflow creates commits only on
     successful normal phase hops during `card advance`.
   - Each hop runs `git add -A` from the repository root, then `git commit`.
     Repository cleanliness before advance is a script concern, not enforced by
     Devflow.

5. **Committed progress**
   - Each successful phase hop is committed. Earlier hops in a multi-phase
     advance are not rolled back when a later hop fails.
   - The card remains in the phase reached by the last successful hop; the
     working tree reflects all script effects up to the failure.

6. **Agent-friendly access**
   - Agents must be able to locate and edit card workspaces directly.
   - Devflow must provide commands that expose card directories and card
     content.

7. **Auditability**
   - Every phase change, block, unblock, force move, failure, and relevant
     workflow event must be recorded in card history.
   - Script output must be captured in logs.

8. **Failure containment**
   - If a transition fails, the card remains in its current phase.
   - Devflow does not automatically retry failed transitions or scripts.
   - Recovery is manual: inspect logs, repair the card workspace, then run
     `devflow card advance` or `--force` where allowed.

9. **Low ceremony**
   - Devflow provides a composable CLI.
   - Shell scripts are the extension mechanism.

---

## 4. Filesystem Layout

### 4.1 Required layout

The required filesystem layout is:

```text
.devflow/
  boards/
    stories/
      board.json

      scripts/
        planning-001-check-git-empty-status
        planning-002-check-card-structure
        planning-003-do-planning
        planning-004-check-planning-quality
        planning-005-check-git-status
        planning.commit-message

      skills/
        plan-story/
          SKILL.md
          templates/
        verify-planning-quality/
          SKILL.md
          templates/
        create-commit-message/
          SKILL.md
          templates/

      cards/
        stories-000001/
          state.json
          card.md
          files/
          logs/
```

Board paths use `.devflow/boards/<board-name>/`. Top-level Devflow paths (for
example `.devflow/templates/`) are not board directories.

### 4.2 Git ignore entries

Devflow uses **lock directories** only (section 14.4), not lock files. The
project `.gitignore` must include:

```gitignore
.devflow/.lock/
.devflow/**/.lock/
```

`board init` and repository validation must ensure these entries exist.

No other paths under `.devflow/` are ignored by default. Logs, card state,
scripts, skills, and attachments are committed like any other project files.

### 4.3 Repository workspace

- A Git repository may contain **multiple Devflow boards** under
  `.devflow/boards/`.
- Board scripts may read or update artefacts on other boards in the same
  repository when workflow requires it.
- `.devflow/` must live at the **repository root** (the root of the Git work
  tree).
- Devflow commands must be run with the current working directory at that
  repository root, or Devflow must resolve the Git root and treat it as the
  working directory before any operation.
- Devflow does not coordinate parallel card advancement in one repository.
  Operators advance one card at a time.

---

## 5. Board Model

### 5.1 Board creation

A board is created using:

```bash
devflow board init stories unplanned planning planned building built verifying verified finishing finished
```

The command creates:

```text
.devflow/boards/stories/
  board.json
  scripts/
  skills/
  cards/
```

Every board has an exceptional phase named `blocked`. It is not passed as a
phase argument and is not part of the forward sequence. `board init` must reject
`blocked` if it appears in `<phase...>`.

`board init` does not create a Git commit. Operators commit new board structure
manually when ready.

If `.devflow/` or `.devflow/boards/` does not exist, `board init` creates it. A
Git work tree must already exist; Devflow does not run `git init`. If `.devflow`
or `.devflow/boards` exists but is not a directory, the command fails.

### 5.2 Identifiers

Board names and phase names must match:

```text
^[a-z][a-z0-9_]*$
```

Hyphens are not allowed. Card IDs and script names use hyphens as separators;
`idPrefix` equals the board name.

The name `blocked` is reserved and must not appear in `<phase...>`.

### 5.3 Sequence width

Card IDs use a zero-padded sequence number. The default width is `6`.

Configure width at board creation:

```bash
devflow board init stories unplanned planning planned building built verifying verified finishing finished --sequence-width 6
```

The resulting card IDs will look like:

```text
stories-000001
stories-000002
stories-000003
```

If the sequence width is set to `4`, IDs would look like:

```text
stories-0001
stories-0002
stories-0003
```

`sequenceWidth` must be an integer from `1` to `12`. Changing `sequenceWidth`
affects only future card IDs; existing card IDs are never renamed.

The width is stored in `board.json`.

### 5.4 Board configuration file

Each board must have a `board.json`.

Example:

```json
{
  "name": "stories",
  "idPrefix": "stories",
  "nextSequence": 1,
  "sequenceWidth": 6,
  "phases": [
    "unplanned",
    "planning",
    "planned",
    "building",
    "built",
    "verifying",
    "verified",
    "finishing",
    "finished"
  ],
  "blockedPhase": "blocked",
  "createdAt": "2026-05-16T07:00:00Z",
  "updatedAt": "2026-05-16T07:00:00Z"
}
```

**Optional `phaseScripts` configuration** (section 9.11):

Boards may configure loop blocks for phases that require retry workflows:

```json
{
  "name": "stories",
  "phases": [...],
  "phaseScripts": {
    "building": {
      "loop": {
        "steps": [
          "building/steps/01-pi.sh",
          "building/steps/02-gate-ci.sh",
          "building/steps/03-gate-scenarios.sh"
        ],
        "maxRounds": 5
      }
    }
  }
}
```

- **`phaseScripts.<phase>.loop.steps`**: array of script paths relative to
  `scripts/` directory.
- **`phaseScripts.<phase>.loop.maxRounds`**: integer ≥ 1; maximum retry rounds.

Phases without `phaseScripts` config use flat lexical script discovery (section
9.3). Loop configuration is validated on `devflow validate-board`.

### 5.5 Board rules

```text
- A board has a unique name.
- A board has an ordered list of normal phases (forward sequence only).
- The exceptional blocked phase is always named blocked (stored as blockedPhase in board.json).
- A board owns its own scripts, skills, cards, and sequence counter.
- nextSequence and sequenceWidth are stored in board.json.
- idPrefix equals the board name.
```

### 5.6 Board templates

Devflow must ship at least one built-in template (minimum: `stories`) containing
example `scripts/`, `skills/`, and documentation for the standard story
workflow.

Board initialization supports:

```bash
devflow board init stories unplanned planning planned building built verifying verified finishing finished --template stories
```

Template sources, in precedence order:

```text
1. Repository-local: .devflow/templates/<name>/
2. Built-in templates shipped with Devflow (cached from JSR)
```

Template content is copied into the new board's `scripts/`, `skills/`, and
`assets/` directories (when present in the template).

### 5.7 Sequence exhaustion

Card IDs use a zero-padded numeric suffix constrained by `sequenceWidth`. When
`nextSequence` would exceed the maximum representable value for that width (for
example `999999` at width `6`), **card creation must fail** with a non-zero exit
code and a clear error. Recovery requires manual intervention (for example
increasing `sequenceWidth` in `board.json` with operator care, or archival of
the board).

---

## 6. Card Model

### 6.1 Card identity

Each card has a stable generated ID of the form:

```text
<board-id-prefix>-<zero-padded-sequence>
```

Example:

```text
stories-000042
```

The card ID has no semantic meaning beyond uniqueness and stable identification.

Devflow resolves the board from a card ID by matching the prefix before the
final `-<sequence>` segment to `idPrefix` (which equals the board name).

### 6.2 Card creation

A card is created using:

```bash
devflow card create stories "Add beneficiary validation"
```

Devflow must:

1. validate that the board exists;
2. validate that `nextSequence` has not exhausted `sequenceWidth`;
3. lock the board while assigning the next sequence;
4. determine the next card ID;
5. increment `nextSequence` in `board.json`;
6. create the card directory;
7. create `state.json`;
8. create `card.md`;
9. place the card in the first board phase;
10. write a card creation history event;
11. return the card ID to stdout;
12. exit `0` on success.

`card create` does not create a Git commit. Operators commit new cards manually
before running `card advance`.

Card creation must not consume `nextSequence` if the card directory is not
finalized. While holding the board lock, Devflow prepares the card workspace,
updates `board.json`, and commits the directory into place atomically.

Devflow writes `board.json` and card `state.json` atomically: write to a
temporary file in the same directory, then rename into place.

If any step fails, Devflow exits non-zero and avoids leaving inconsistent state
where possible.

Example output:

```text
stories-000042
```

### 6.3 Card directory

Each card directory must have the following structure:

```text
.devflow/boards/stories/cards/stories-000042/
  state.json
  card.md
  files/
  logs/
```

### 6.4 Card state file

Each card has a machine-owned `state.json`.

Example:

```json
{
  "id": "stories-000042",
  "board": "stories",
  "title": "Add beneficiary validation",
  "phase": "planning",
  "previousPhase": null,
  "createdAt": "2026-05-16T07:00:00Z",
  "updatedAt": "2026-05-16T07:30:00Z",
  "variables": {
    "SESSION_ID": "abc123"
  },
  "history": [
    {
      "type": "created",
      "at": "2026-05-16T07:00:00Z",
      "phase": "unplanned"
    },
    {
      "type": "phaseChanged",
      "at": "2026-05-16T07:30:00Z",
      "from": "unplanned",
      "to": "planning",
      "mode": "normal"
    }
  ],
  "blocked": null
}
```

### 6.5 Ownership of card files

The files have different ownership semantics:

```text
state.json = machine-owned
card.md    = human/agent-owned
files/     = human/agent/script-owned attachments
logs/      = Devflow/script-owned execution logs
```

Agents and scripts must not edit `state.json` directly. Use Devflow commands to
update variables, block or unblock cards, or advance phases.

### 6.6 Card body

Devflow does not mandate `card.md` structure. Board scripts and skills enforce
structure per phase.

When a card is created, `card.md` contains only the card title:

```markdown
# Add beneficiary validation
```

### 6.7 Card title and rename

The card title is stored in `state.json` at creation. Board scripts may require
`card.md` to stay consistent with `state.json`.

`devflow card rename <card-id> "<title>"` updates the title in `state.json` and
the level-1 heading in `card.md`. It does not create a Git commit.

### 6.8 Timestamps

All persisted timestamps use UTC ISO 8601 with a `Z` suffix, for example
`2026-05-16T07:42:18Z`.

---

## 7. Variables

Card variables are stored in the `variables` object inside card `state.json`.

Variables allow scripts to persist small values during workflow execution, such
as session IDs, generated artefact names, temporary references, or external tool
identifiers.

### 7.1 Get variable

```bash
devflow variable get stories-000042 SESSION_ID
```

Behaviour:

```text
- If the variable exists, print its value to stdout and exit 0.
- If the variable does not exist, print an error to stderr and exit non-zero.
```

### 7.2 Set variable

```bash
devflow variable set stories-000042 SESSION_ID "hello world"
```

Behaviour:

```text
- Acquire the card lock for the duration of this command (see section 14).
- Set the variable value.
- Update the card's updatedAt timestamp.
- Release the lock.
- Exit 0 on success.
```

Values are stored as strings.

`variable set` does not create a Git commit. Changes made during a transition
are included in that transition's commit. Changes made outside a transition
remain uncommitted until the operator commits or a later `card advance` includes
them.

Scripts invoked during a transition that call `devflow variable set` or
`devflow card add-file` must pass `--ignore-lock` (section 16.1).

Example:

```bash
devflow variable set stories-000042 SESSION_ID "abc123" --ignore-lock
```

---

## 8. Attachments

Files may be attached to a card using:

```bash
devflow card add-file stories-000042 ./api-contract.pdf
```

Devflow must copy the file into:

```text
.devflow/boards/stories/cards/stories-000042/files/
```

If a file with the same name already exists, Devflow must fail unless
`--overwrite` is passed:

```bash
devflow card add-file stories-000042 ./api-contract.pdf --overwrite
```

`card add-file` rules:

```text
- source must exist and be a regular file;
- symlinks are rejected;
- destination filename is basename(source) with no path separators;
- existing destination requires --overwrite.
```

`card add-file` does not create a Git commit. Files added during a transition
are included in that transition's commit.

Attachment events must be recorded in card history.

---

## 9. Script Model

### 9.1 Script location

Scripts live in the board's `scripts/` directory:

```text
.devflow/boards/stories/scripts/
```

Boards may organize scripts using:

1. **Flat layout** (default): all exit scripts directly in `scripts/`.
2. **Hierarchical layout**: exit scripts in `scripts/` plus helper libraries or
   child scripts in subdirectories (e.g., `scripts/building/steps/`,
   `scripts/building/lib/`).

Only **root exit scripts** matching the pattern in §9.3 and marked executable
are automatically discovered and run by Devflow. Subdirectories, non-executable
files, and child scripts (invoked by root scripts or loop orchestrator) are
**not** auto-run.

### 9.2 Script naming

Scripts are named using:

```text
<phase>-<sequence>-<action-name>
```

Example:

```text
planning-001-check-git-empty-status
planning-002-check-card-structure
planning-003-do-planning
planning-004-check-planning-quality
planning-005-check-git-status
```

### 9.3 Script execution order

**Root exit scripts** are executed in lexical order.

For a card leaving `planning`, Devflow runs all **executable** files in the
board `scripts/` directory (not subdirectories) whose names match:

```text
^<phase>-[0-9]{3}-[a-z0-9][a-z0-9-]*$
```

The commit-message script for phase `planning` matches
`^planning\.commit-message$` and is invoked separately (section 13).

Example matches for phase `planning`:

```text
planning-001-check-git-empty-status
planning-002-check-card-structure
```

Example non-matches (not run as exit scripts):

```text
planning.commit-message          # dot after phase name, not hyphen
planning-backup-001-foo          # wrong shape
README                           # not a phase script
planning/steps/01-foo.sh         # in subdirectory; not auto-discovered
planning-002-01-child            # child script naming; invoked by parent only
```

The glob `planning-*` is descriptive only. Implementations must use the pattern
above so that `planning.commit-message` is never included in the exit-script
sequence. The commit-message script is invoked separately (section 13).

During `devflow card advance`, the operator may pass `--skip` with one or more
action identifiers in the form `<phase>-<sequence>` (section 11.9). For each
hop, any root exit script whose name begins with that prefix is omitted from the
sequence; all other root exit scripts run in lexical order. Skipped actions are
recorded in run metadata and card history.

**Child scripts** (invoked by root scripts or loop orchestrator) are not
automatically discovered. Boards may name them using conventions such as
`<phase>-<parent-NNN>-<child-NN>-<name>` (e.g., `building-002-01-pi`) or place
them in subdirectories (e.g., `building/steps/01-pi.sh`). Devflow does not
enforce child naming; parent scripts or loop config specify child paths.

### 9.4 Script arguments

Every script is called with the following positional arguments:

```bash
<script> <board-name> <card-id>
```

Example:

```bash
planning-003-do-planning stories stories-000042
```

Scripts can locate the card directory using:

```bash
devflow card dir stories-000042
```

Scripts can read card variables using:

```bash
devflow variable get stories-000042 SESSION_ID
```

During a transition, scripts may call `devflow variable set` and
`devflow card add-file` with `--ignore-lock` when the parent command already
holds the card lock. Scripts must not call `devflow card advance`,
`devflow card block`, `devflow card unblock`, or `devflow card rename` from
within a transition.

### 9.5 Cross-board script behaviour

```text
- Scripts may read other boards freely.
- Scripts may modify non-state artefacts on other boards when necessary.
- Scripts must not edit any card state.json directly.
- Scripts must not advance, block, unblock, or rename other cards during a transition.
```

### 9.6 Script execution trust

Devflow executes board scripts as local trusted code. Scripts are not sandboxed.

Scripts must not write secrets, credentials, or tokens to stdout or stderr
because transition logs are committed by default.

### 9.7 Script success and failure

Scripts communicate success or failure using process exit codes:

```text
exit 0     = success
exit non-0 = failure
```

If any script fails, Devflow must stop the transition immediately.

### 9.8 Execution unit and retries

Scripts run only as part of phase transitions. Devflow does not provide a
command to run scripts in isolation.

Scripts are not idempotent. Devflow does not retry failed **root exit scripts**.
The card remains in its current phase until an operator runs
`devflow card advance` again or uses another allowed recovery command.

**Exception: loop blocks** (see §9.11). When a phase configures a loop block,
Devflow retries the loop steps (not individual scripts) up to `maxRounds`. Loop
steps that fail cause the loop to restart from the first step until all steps
succeed or the round limit is reached.

### 9.9 Script execution environment

When Devflow invokes any script (exit script or commit-message script):

```text
- Working directory: repository root (Git work tree root).
- Invocation: execute the script file directly so the shebang line is honoured (for example execve on the script path after verifying it is executable).
- Environment: all DEVFLOW_* variables in section 18 must be set for every script invocation.
- Timeouts: scripts implement their own timeouts; Devflow does not impose script timeouts.
```

### 9.10 Concurrent edits during transitions

Humans and agents may edit `card.md`, `files/`, and repository source while
Devflow is idle.

Editing card or repository files **during** an active transition for that card
is unsupported. Devflow assumes this does not happen. Behaviour if files change
mid-run is undefined.

### 9.11 Phase loop blocks

Boards may configure a **loop block** for a phase to support retry workflows
(e.g., implementation → CI → tests with automatic retry on failure).

#### 9.11.1 Loop configuration

Loop configuration is stored in `board.json` under `phaseScripts.<phase>.loop`:

```json
{
  "phaseScripts": {
    "building": {
      "loop": {
        "steps": [
          "building/steps/01-pi.sh",
          "building/steps/02-gate-ci.sh",
          "building/steps/03-gate-scenarios.sh"
        ],
        "maxRounds": 5
      }
    }
  }
}
```

- **`steps`**: array of script paths relative to `scripts/` directory; executed
  in order.
- **`maxRounds`**: integer ≥ 1; maximum number of times to run the loop.

#### 9.11.2 Loop execution semantics

When a phase transition includes a loop block:

1. Devflow runs root exit scripts **not** in the loop config first (entry
   scripts).
2. Devflow enters the loop with round counter initialized to 1.
3. For each round: a. Run each step in `steps` array sequentially. b. If a step
   exits non-zero, increment round counter and restart from step 1 (unless
   `maxRounds` reached). c. If all steps exit 0, exit the loop and proceed to
   remaining exit scripts.
4. If round counter exceeds `maxRounds` with a failure, the transition fails.
5. After loop completes successfully, Devflow runs remaining root exit scripts
   **not** in the loop config (exit scripts).

Loop steps are invoked the same way as root scripts (§9.9) with additional
environment variables (§18).

#### 9.11.3 Loop ordering and root scripts

Root exit scripts discovered by §9.3 that are **not** listed in `loop.steps` run
in lexical order relative to the loop block:

- Scripts lexically before the loop's first step name run before the loop
  (entry).
- Scripts lexically after the loop's last step name run after the loop (exit).
- **Implementation note**: Boards typically name the loop orchestrator (e.g.,
  `building-002-build-loop`) to control ordering; the loop replaces that script
  in execution.

Phases without loop configuration use flat lexical discovery (§9.3) unchanged
(backward compatible).

#### 9.11.4 Loop idempotency requirements

Loop steps that modify card state (e.g., updating `card.md`) **must** be
idempotent or tolerant of partial completion. Devflow does not roll back changes
from earlier steps when a later step fails and the loop restarts.

Board authors are responsible for ensuring loop steps can safely re-run multiple
times on the same card.

---

## 10. Skills

Skills live in the board's `skills/` directory:

```text
.devflow/boards/stories/skills/
```

A skill is a reusable package used by scripts, typically to invoke `pi-mono`.

Example:

```text
skills/
  plan-story/
    SKILL.md
    templates/
  verify-planning-quality/
    SKILL.md
    templates/
  build-story/
    SKILL.md
    templates/
  verify-build-quality/
    SKILL.md
    templates/
  create-commit-message/
    SKILL.md
    templates/
```

Devflow does not interpret skill contents. Skills are consumed by scripts.

### 10.1 pi-mono integration

`pi-mono` is an **external** tool, not part of the Devflow core. Board scripts
invoke it with explicit arguments, stdin/stdout, and a skill path under the
board's `skills/` directory.

Devflow does not install or configure `pi-mono`. Board templates include a
reference script that invokes `pi-mono` with a skill path, propagates exit
codes, and documents model selection and timeouts.

Scripts that call `pi-mono` must treat non-zero exit codes as transition
failures. Token limits, timeouts, and model choice are script responsibilities.

---

## 11. Transition Model

### 11.1 Exit-action semantics

Phase scripts are **exit actions**: they run when leaving that phase (see
section 9.3 for naming and matching).

### 11.2 Advancing a card

Cards are advanced using:

```bash
devflow card advance stories-000042 building
```

### 11.3 Multi-phase advance

If a card is in `unplanned` and the target phase is `building`, Devflow must
advance through each intermediate phase.

Given:

```text
unplanned -> planning -> planned -> building
```

The command:

```bash
devflow card advance stories-000042 building
```

must perform:

```text
unplanned -> planning
planning  -> planned
planned   -> building
```

For each single-phase hop, Devflow runs the exit scripts for the current phase,
then performs **one Git commit** for that hop (section 13). A multi-phase
advance therefore produces **one commit per phase transition**, not a single
squashed commit.

Example: advancing from `unplanned` to `finished` creates one commit when
leaving `unplanned`, another when leaving `planning`, and so on.

In a multi-phase advance, successful earlier hops are not rolled back when a
later hop fails. The card remains in the phase reached by the last successful
hop.

### 11.4 Transition algorithm

Normal advance behaviour:

```text
1. Resolve the card.
2. Resolve the board.
3. Reject if the card is in the blocked phase (exit non-zero; see section 12.3).
4. Reject if the target phase is the blocked phase (exit non-zero; use devflow card block).
5. Validate the target phase is a normal forward phase.
6. Validate that the target phase is not behind the current phase.
7. If the card is already in the target phase, exit 0 and do nothing.
8. Verify the repository is not in an unresolved merge, rebase, cherry-pick, or revert state (section 13.7).
9. Acquire the repository operation lock and the card lock for the entire command.
9b. If `--skip` was passed, validate every skip token against the union of exit
    scripts across all hops in this advance (section 11.9). Reject unknown tokens,
    loop-step targets, and commit-message script names before any hop runs.
10. For each single-phase hop between current phase and target phase:
   a. Identify the current phase and the next phase.
   b. Run the current phase's exit scripts (section 9.3) in order, with loop
      block execution if configured (section 9.11):
      - Omit any root exit script whose `<phase>-<sequence>` prefix matches a
        `--skip` token for this hop's `from` phase (section 11.9).
      - If phase has no loop config, run all remaining root exit scripts in
        lexical order.
      - If phase has loop config:
        i.   Run entry scripts (root exit scripts lexically before loop steps).
        ii.  Run loop block (section 9.11.2): iterate steps up to maxRounds,
             restarting from first step on any failure.
        iii. Run exit scripts (root exit scripts lexically after loop steps).
      - If any script (entry, loop, or exit) fails, stop immediately (section 11.5).
      - For each omitted script, record it in run metadata with `skipped: true`
        and append an `actionSkipped` history event before the hop's
        `phaseChanged` event (section 11.9).
   c. Run the current phase's commit-message script if present (section 13).
   d. If all scripts succeed, update card phase to the next phase.
   e. Append a phaseChanged event to history.
   f. Update updatedAt.
   g. Stage and commit all repository changes (section 13).
11. Release the repository lock and the card lock.
12. Exit 0.
```

Both locks are held for the entire `card advance` command, including all script
executions and Git operations in a multi-phase advance.

### 11.5 Failure behaviour

If a script fails, Devflow must:

```text
- Stop immediately.
- Leave the card in its current phase.
- Append a transitionFailed event to state.json.
- Capture stdout and stderr in logs.
- Release all locks held by the command.
- Return non-zero.
- Print the failing script name and log path.
```

For **loop block failures** (section 9.11), the error message must include:

- The failing step script name
- The round number when failure occurred (or "exhausted" if maxRounds reached)
- The loop configuration (step list, maxRounds)

A failed transition may leave the repository work tree dirty (script
modifications, logs, and a `transitionFailed` entry in `state.json`). Devflow
does not roll back script side effects. Operators inspect the run log, repair
the workspace, and retry or commit manually.

Failed-run logs remain in `logs/`. If not removed, they are included in a later
successful transition commit.

Example failure output:

```text
ERROR: transition failed

card: stories-000042
phase: planning
target: planned
script: planning-004-check-planning-quality
exit: 1
log: .devflow/boards/stories/cards/stories-000042/logs/2026-05-16T07-42-18Z-advance-planning-planned/output.log
```

When an exit script is intentionally omitted via `--skip` (section 11.9),
Devflow appends an `actionSkipped` event to `state.json` for that script before
the hop's `phaseChanged` event:

```json
{
  "type": "actionSkipped",
  "at": "2026-05-16T08:00:00Z",
  "from": "planning",
  "to": "planned",
  "script": "planning-003-do-planning"
}
```

### 11.6 Already-at-target behaviour

If a card is already in the requested target phase:

```bash
devflow card advance stories-000042 building
```

and the card is already in `building`, Devflow must:

```text
- Do nothing.
- Print a short informational message.
- Exit 0.
```

### 11.7 Backward movement

Normal advance must not move a card backwards.

If the target phase is behind the current phase, Devflow must exit non-zero.

### 11.8 Force movement

```bash
devflow card advance stories-000042 planning --force
```

Force behaviour:

```text
- Only valid when the card is not in the blocked phase.
- May move to any normal forward phase (not to blocked).
- Does not run exit scripts or commit-message scripts.
- Does not create a Git commit.
- Updates state.json and appends history with mode "force".
- Acquires and releases the card lock like a normal advance.
```

History event example:

```json
{
  "type": "phaseChanged",
  "at": "2026-05-16T08:00:00Z",
  "from": "building",
  "to": "planning",
  "mode": "force"
}
```

### 11.9 Selective skip (`--skip`)

```bash
devflow card advance stories-000042 planning --skip planning-003
devflow card advance stories-000042 building --skip planning-003,planning-005
```

`--skip` omits named **root exit scripts** during a normal advance. It does not
bypass the commit-message script, loop-step scripts, or the rest of the
transition algorithm.

**Token form:**

- Each value matches `^[a-z][a-z0-9]*-[0-9]{3}$` (for example `planning-003`).
- A full action name such as `planning-003-do-planning` is accepted and
  normalized to its `<phase>-<sequence>` prefix.
- Values may be comma-separated in one `--skip` argument, or supplied by
  repeating `--skip`. Duplicate tokens are de-duplicated.

**CLI rules:**

- `--skip` is valid only on `devflow card advance` (and `advance-card`).
- `--skip` and `--force` must not be combined; Devflow exits non-zero before
  acquiring locks.
- Shape validation errors exit non-zero before any script runs.

**Per-hop behaviour:**

- A skip token applies only when its phase prefix equals the hop's `from` phase.
  Tokens for other phases are ignored on that hop.
- In a multi-phase advance, every token must match at least one exit script on
  some hop in the run; otherwise the command fails before any script runs.
- The commit-message script (`<phase>.commit-message`) cannot be skipped.
- A skip token that resolves to a script in a phase's loop step band (section
  9.11) is rejected.

**When a script is skipped:**

```text
- The script is not executed.
- run.json records { "name": "<script>", "exitCode": 0, "skipped": true }.
- Grey boilerplate is printed at info or verbose log level (section 16.2).
- An actionSkipped event is appended before the hop's phaseChanged event.
```

Omitting `--skip` must produce the same behaviour as before this option existed
(no `actionSkipped` events, no `skipped` field in run metadata).

---

## 12. Blocking Model

### 12.1 Block card

```bash
devflow card block stories-000042 "Waiting for API contract"
```

Behaviour:

```text
- Lock the card.
- Record the current phase as previousPhase.
- Set phase to blocked.
- Store the block reason.
- Store the block timestamp.
- Append a blocked history event.
- Release the lock.
```

`card block` does not create a Git commit.

Example state fragment:

```json
{
  "phase": "blocked",
  "previousPhase": "building",
  "blocked": {
    "reason": "Waiting for API contract",
    "blockedAt": "2026-05-16T07:25:00Z"
  }
}
```

### 12.2 Unblock card

```bash
devflow card unblock stories-000042
```

Behaviour:

```text
- Lock the card.
- Restore the card to previousPhase.
- Clear blocked metadata.
- Clear previousPhase.
- Append an unblocked history event.
- Release the lock.
```

`card unblock` does not create a Git commit.

If the card is not blocked, Devflow must exit non-zero.

### 12.3 Blocked cards and advance

```text
- devflow card advance on a blocked card must exit non-zero with a clear error.
- devflow card advance must not accept the blocked phase as a target; use devflow card block.
- devflow card advance --force is not allowed on a blocked card (unblock first).
```

---

## 13. Git and Commit Semantics

### 13.1 Git repository

Devflow operates only inside a Git work tree. Devflow validates this before
board operations.

### 13.2 When Devflow commits

```text
card advance (each successful normal hop)   creates a Git commit
card advance --skip <tokens>                creates a Git commit; named exit scripts omitted
card advance --force                        no commit; no scripts; --skip rejected
card create                                 no commit
card block / card unblock                   no commit
card rename                                 no commit
card add-file                               no commit
variable set                                no commit
board init                                  no commit
```

Operators commit card creation, variables, and board setup manually before
running `card advance`.

### 13.3 Transition commit rules

```text
- Scripts must not run git commit during a transition.
- Scripts may modify files anywhere in the repository.
- Devflow creates exactly one Git commit per successful normal phase hop, after updating card state.
```

### 13.4 Commit-message scripts

For phase `planning`, the commit-message script is named
`planning.commit-message`. It is not an exit script (section 9.3).

The commit-message script receives the same arguments and environment variables
as other scripts (sections 9.4, 18).

```text
stdout     commit message
stderr     diagnostics
exit 0     success
exit non-0 failure
```

If `<phase>.commit-message` is absent, Devflow uses:

```text
Advance <card-id> from <from-phase> to <to-phase>
```

If the script exists and exits non-zero, the hop fails: phase unchanged, no
commit, `transitionFailed` recorded when safe.

If the script exits `0` but stdout is empty or whitespace-only, Devflow treats
this as commit-message failure.

Commit-message script stdout is captured as data. It is not streamed to the
console. Stderr is diagnostics and follows the active log level (section 16.2).
Captured stdout is written to `commit-message.txt` in the run directory.

### 13.5 Per-hop lifecycle

For each single-phase hop during `card advance`:

```text
1. Run exit scripts for the current phase.
2. Run <phase>.commit-message when present; capture stdout as the commit message, or use the fallback when absent.
3. Update card phase, updatedAt, and history.
4. Run git add -A from the repository root.
5. Run git commit with the captured message.
```

`DEVFLOW_FROM_PHASE` and `DEVFLOW_TO_PHASE` reflect the hop; `state.json` is
updated before the commit.

### 13.6 Staging scope

Each transition commit runs `git add -A` from the repository root and includes
all changes in the work tree. The only `.devflow` paths excluded from Git are
lock directories (section 4.2). Logs are committed.

### 13.7 Git commit failure

If `git commit` fails after Devflow has updated card state for the hop:

```text
- do not roll back card phase or script side effects automatically;
- leave the working tree as-is;
- record the failure in run.json and output.log only (do not append to state.json history);
- release all locks;
- exit non-zero with the Git error and run log path.
```

Recovery is manual: inspect Git status, repair the repository, and commit or
correct state as needed.

### 13.8 Git preconditions

Before `card advance` runs scripts, Devflow must verify the repository is not in
an unresolved merge, rebase, cherry-pick, or revert operation. If such a state
is detected, the command fails before scripts run.

### 13.9 Example commit-message script

```bash
#!/usr/bin/env bash
set -euo pipefail

CARD_DIR="$(devflow card dir "$2")"
TITLE="$(jq -r '.title' "$CARD_DIR/state.json")"

cat <<EOF
Plan $2: $TITLE

Advanced from $DEVFLOW_FROM_PHASE to $DEVFLOW_TO_PHASE.
EOF
```

---

## 14. Locking

### 14.1 Locking model

Devflow acquires locks at the **command** level, not inside individual scripts
or script steps.

Because `git add -A` uses the repository-wide Git index, `card advance` acquires
both a repository operation lock and a card lock.

Nested `devflow` invocations from scripts (for example
`devflow variable set ... --ignore-lock`) skip lock acquisition when
`--ignore-lock` is passed (section 16.1).

### 14.2 Lock paths

```text
# Repository operation lock (card advance)
.devflow/.lock/

# Board lock (card create)
.devflow/boards/<board>/.lock/

# Card lock (card advance, block, unblock, variable set, add-file, rename)
.devflow/boards/<board>/cards/<card-id>/.lock/
```

### 14.3 Commands and locks

| Command                                     | Locks                          |
| ------------------------------------------- | ------------------------------ |
| `board init`                                | repository (`.devflow/.lock/`) |
| `card create`                               | board                          |
| `card advance`                              | repository + card              |
| `card block`, `card unblock`, `card rename` | card                           |
| `variable set`, `card add-file`             | card                           |

Read-only commands (`show`, `list`, `dir`, `get`, `validate`) do not acquire
locks.

### 14.4 Lock implementation

Devflow uses **atomic directory creation** (`mkdir`) for all locks. Lock files
are not used.

Acquisition:

```text
1. Attempt to create the lock directory (mkdir, no parents beyond the expected path).
2. If creation succeeds, the caller holds the lock.
3. If creation fails because the directory already exists, another holder has the lock, the command must fail with a clear error-unless `--ignore-lock` was passed (section 16.1).
```

`--ignore-lock` does not remove an existing `.lock/` directory; it only allows
the current command to proceed without acquiring the lock. Use only when the
caller already holds the lock (typically a Devflow script invoked during
`card advance`).

Release:

```text
1. Remove the lock directory (rmdir) when the command completes, including on failure after the lock was acquired.
2. On crash or kill, the directory may remain; operators use lock release commands (section 14.6).
```

### 14.5 Lock cleanup and signals

Devflow must attempt to release locks automatically when interrupted.

Devflow catches termination signals, including:

```text
SIGINT
SIGTERM
SIGHUP
```

If Devflow receives a signal while a child script is running, it forwards the
signal to the child, waits briefly for graceful termination, then forces
termination if needed.

On handling interruption, Devflow must:

```text
- stop executing further scripts;
- release any lock held by the current process;
- append a failure/interrupted event if safe to do so;
- exit non-zero.
```

### 14.6 Manual lock release

```text
devflow lock release          removes a card .lock/
devflow lock release-board    removes a board .lock/
devflow lock release-repo     removes .devflow/.lock/
```

All accept `--force`. Devflow warns that releasing an active lock may corrupt
workflow state.

---

## 15. Logs

### 15.1 Log location

Each card has a `logs/` directory:

```text
.devflow/boards/stories/cards/stories-000042/logs/
```

### 15.2 Transition run directory

Each single-phase hop during `card advance` creates one run directory:

```text
logs/<timestamp>-advance-<from>-<to>/
  run.json
  output.log
  commit-message.txt
```

`<timestamp>` uses UTC with hyphens in place of colons, for example
`2026-05-16T07-42-18Z-advance-planning-planned`.

A multi-phase advance creates one run directory per hop (successful or failed).

### 15.3 Run metadata

`run.json` includes:

```json
{
  "card": "stories-000042",
  "board": "stories",
  "from": "planning",
  "to": "planned",
  "startedAt": "2026-05-16T07:42:18Z",
  "completedAt": "2026-05-16T07:45:03Z",
  "status": "succeeded",
  "scripts": [
    {
      "name": "planning-001-check-git-empty-status",
      "exitCode": 0
    },
    {
      "name": "planning-002-check-card-structure",
      "exitCode": 0
    },
    {
      "name": "planning-003-do-planning",
      "exitCode": 0,
      "skipped": true
    }
  ]
}
```

When an exit script was omitted via `--skip`, its record includes
`"skipped": true` and `exitCode` is `0` (section 11.9).

### 15.4 Script output

Devflow captures script stdout and stderr in `output.log` within the run
directory.

---

## 16. CLI Requirements

Object-first commands are canonical. Hyphenated verb-command aliases are
provided for agent convenience (for example `board init` → `init-board`).

All commands:

- run relative to the Git repository root (section 4.3);
- accept global flags (section 16.1);
- use exit code `0` on success and non-zero on failure unless noted;
- keep machine-parseable primary output on stdout free of colour codes (section
  16.2).

### 16.0 Command index

| Command                      | Synonym              | Purpose                                                                   |
| ---------------------------- | -------------------- | ------------------------------------------------------------------------- |
| `devflow`                    | -                    | Print usage; exit `0`                                                     |
| `devflow help`               | -                    | Print usage; exit `0`                                                     |
| `devflow validate`           | `validate`           | Validate repository, all boards, all cards                                |
| `devflow board init`         | `init-board`         | Create a board                                                            |
| `devflow board list`         | `list-boards`        | List boards                                                               |
| `devflow board show`         | `show-board`         | Show board metadata                                                       |
| `devflow board validate`     | `validate-board`     | Validate one board                                                        |
| `devflow card create`        | `create-card`        | Create a card                                                             |
| `devflow card list`          | `list-cards`         | List cards on a board                                                     |
| `devflow card show`          | `show-card`          | Show card metadata and `card.md`                                          |
| `devflow card dir`           | `card-dir`           | Print absolute card directory path                                        |
| `devflow card add-file`      | `add-card-file`      | Attach a file to a card                                                   |
| `devflow card advance`       | `advance-card`       | Advance card phase (transition runner); `--skip` omits named exit scripts |
| `devflow card block`         | `block-card`         | Block a card                                                              |
| `devflow card unblock`       | `unblock-card`       | Unblock a card                                                            |
| `devflow card rename`        | `rename-card`        | Rename a card                                                             |
| `devflow card validate`      | `validate-card`      | Validate one card                                                         |
| `devflow variable get`       | `get-variable`       | Read a card variable                                                      |
| `devflow variable set`       | `set-variable`       | Write a card variable                                                     |
| `devflow lock release`       | `release-lock`       | Release stale card lock                                                   |
| `devflow lock release-board` | `release-board-lock` | Release stale board lock                                                  |
| `devflow lock release-repo`  | `release-repo-lock`  | Release stale repository lock                                             |

Synonym forms place arguments in the same order as the object-first command,
with the verb-command name replacing `devflow <object> <verb>`. Example:

```bash
devflow board init stories unplanned planning planned
devflow init-board stories unplanned planning planned
```

### 16.1 Global flags

| Flag            | Commands                             | Effect                                                                                                                 |
| --------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `--help`, `-h`  | all                                  | Print usage and exit `0`. Processed before repository detection, works outside a Git repository.                       |
| `--ignore-lock` | `variable set`, `card add-file` only | Skip lock acquisition. Required when called from a script during `card advance`. Other commands must reject this flag. |
| `--skip`        | `card advance` only                  | Omit one or more exit actions by `<phase>-<sequence>` prefix (section 11.9). Mutually exclusive with `--force`.        |
| `--verbose`     | all                                  | Console output level `verbose` (section 16.2).                                                                         |
| `--summary`     | all                                  | Console output level `summary` (section 16.2).                                                                         |

Nested `devflow` invocations from scripts may pass `--verbose`, `--summary`, or
`--ignore-lock` where supported.

`--verbose` and `--summary` are mutually exclusive. If both are passed, Devflow
must exit non-zero with an error.

Default when neither flag is passed: output level `info` (section 16.2).

### 16.2 Console output

When stderr/stdout is a TTY, Devflow uses **ANSI colour escape codes**:

| Role        | Colour | Examples                                            |
| ----------- | ------ | --------------------------------------------------- |
| Success     | Green  | Command completed, phase advanced, card created     |
| Error       | Red    | Validation failure, script exit non-zero, lock held |
| Boilerplate | Grey   | Timestamps, "Running …", lock paths, debug detail   |

**CLI parameter and argument errors:**

When a command is invoked with invalid or missing arguments, unknown flags, or
an unrecognised command, Devflow writes a single structured error line to stderr
in the form `Error: <command>: <subject>: <detail>` (with `Error:` in red and
the command/subject in grey when colours are enabled). The usage block is
**not** printed alongside these errors.

The usage block is printed on stdout (exit `0`) only by:

- `devflow` with no arguments,
- `devflow help`, or
- the global `--help` / `-h` flag.

**`info`** (default):

```text
- Print grey boilerplate for Devflow actions (which script is running, transition hop, git commit, and similar).
- Stream each exit script's stdout and stderr to the console as it runs (commit-message script stdout is not streamed; section 13.4).
- Print green messages on success and red messages on errors.
- Always write the full script transcript to the transition log under logs/ (section 15).
```

**`verbose`** (`--verbose`):

```text
- Print everything that info mode prints.
- Additionally print all Devflow internal diagnostics (environment, paths, git invocations, lock decisions, and similar) in grey.
```

**`summary`** (`--summary`):

```text
- Print only phase transition lines (for example unplanned → planning) and errors (red).
- Do not print script stdout/stderr to the console (still captured in logs/).
- Omit grey boilerplate except where needed to report an error context.
```

Devflow sets `DEVFLOW_LOG_LEVEL` to the active level (`info`, `verbose`, or
`summary`) on every script invocation (section 18). Nested `devflow` commands
inherit the parent level unless overridden by flags.

**Machine output:** Commands whose primary stdout must be parsed by scripts or
agents (`card create`, `card dir`, `variable get`, `board list`, `card list`,
and similar) must emit plain text without colour codes on that stdout line, even
when colours are enabled on stderr.

Disable colours when stdout or stderr is not a TTY.

### 16.3 Command reference

Command behaviour is defined in the sections cited below. Each command exits `0`
on success unless stated otherwise.

| Command                      | Section                                |
| ---------------------------- | -------------------------------------- |
| `devflow board init`         | 5.1, 5.2, 5.5                          |
| `devflow board list`         | Prints board names, one per line       |
| `devflow board show`         | 5.4 - formatted metadata on stdout     |
| `devflow card rename`        | 6.7                                    |
| `devflow board validate`     | 17.1                                   |
| `devflow card create`        | 6.2, 5.7                               |
| `devflow card list`          | Prints card IDs; `--phase` filters     |
| `devflow card show`          | 6.4, 16.4 - YAML frontmatter + card.md |
| `devflow card dir`           | Absolute path on stdout                |
| `devflow card add-file`      | 8                                      |
| `devflow card advance`       | 11, 13                                 |
| `devflow card block`         | 12.1                                   |
| `devflow card unblock`       | 12.2                                   |
| `devflow card validate`      | 17.2                                   |
| `devflow variable get`       | 7.1                                    |
| `devflow variable set`       | 7.2                                    |
| `devflow lock release`       | 14.6                                   |
| `devflow lock release-board` | 14.6                                   |
| `devflow lock release-repo`  | 14.6                                   |
| `devflow validate`           | 17                                     |

### 16.4 Command output formats

```text
devflow board list     board names, one per line
devflow card list      card IDs, one per line; --phase filters
devflow board show     formatted board metadata (phases, sequence settings, blocked phase)
devflow card show      YAML frontmatter (selected state fields) then raw card.md
devflow card dir       absolute path on stdout, no colour codes
devflow card create    new card ID on stdout, no colour codes
devflow variable get   variable value on stdout, no colour codes
```

`card show` frontmatter example:

```yaml
---
id: stories-000042
board: stories
title: Add beneficiary validation
phase: planning
createdAt: 2026-05-16T07:00:00Z
updatedAt: 2026-05-16T07:30:00Z
---
```

---

## 17. Validation Requirements

Validation commands report problems on stderr. They do not modify files. Exit
`0` when all checks pass; exit non-zero otherwise.

### 17.1 Board validation

Board validation must check:

```text
- board directory exists;
- board.json exists;
- board.json is valid JSON;
- board name matches directory name;
- phases are non-empty;
- phase names are unique and match ^[a-z][a-z0-9_]*$;
- board name matches ^[a-z][a-z0-9_]*$;
- blocked is not listed in phases;
- blockedPhase is blocked;
- nextSequence is valid and not exhausted for sequenceWidth;
- sequenceWidth is an integer from 1 to 12;
- scripts directory exists;
- skills directory exists;
- cards directory exists.
```

### 17.2 Card validation

Card validation must check:

```text
- card directory exists;
- state.json exists;
- card.md exists;
- files directory exists;
- logs directory exists;
- state.json is valid JSON;
- card ID matches directory name;
- card board exists;
- card phase is valid;
- blocked metadata is consistent with blocked state;
- previousPhase is valid when blocked;
- card ID prefix matches board idPrefix;
- title is non-empty;
- phase is blocked if and only if blocked metadata is present;
- previousPhase is null unless phase is blocked;
- history is an array;
- timestamps are valid UTC ISO 8601 with Z;
- card ID numeric suffix matches sequenceWidth for the board;
- card IDs are unique within the board.
```

Board validation must also report any card whose ID suffix does not match the
board `sequenceWidth` (wrong padding length).

### 17.3 Repository validation

Since Git is mandatory, Devflow must validate:

```text
- current project is inside a Git work tree;
- .devflow is inside the Git work tree;
- .gitignore ignores `.devflow/.lock/` and `.devflow/**/.lock/` (section 4.2);
- Git command is available.
```

---

## 18. Environment Variables for Scripts

When Devflow invokes **any** script (exit script or `<phase>.commit-message`),
it must set the following environment variables in addition to positional
arguments.

Required positional arguments:

```bash
<script> <board-name> <card-id>
```

Required environment variables:

```text
DEVFLOW_ROOT          # absolute path to .devflow/
DEVFLOW_BOARD         # board name
DEVFLOW_BOARD_DIR     # absolute path to .devflow/boards/<board>/
DEVFLOW_CARD_ID
DEVFLOW_CARD_DIR      # absolute path to card directory
DEVFLOW_FROM_PHASE    # phase being exited (this hop)
DEVFLOW_TO_PHASE      # next phase after this hop
DEVFLOW_CURRENT_PHASE # same as FROM_PHASE for this hop
DEVFLOW_NEXT_PHASE    # same as TO_PHASE for this hop
DEVFLOW_RUN_DIR       # absolute path to the current hop's run directory (updated each hop)
DEVFLOW_LOG_LEVEL     # console output level: info | verbose | summary (section 16.2)
DEVFLOW_REPO_ROOT     # Git work tree root (same as the script working directory)
```

**Additional environment variables for loop steps** (section 9.11):

```text
DEVFLOW_SCRIPT_PARENT # name of the invoking script (set for child scripts invoked by parent or loop orchestrator)
DEVFLOW_SCRIPT_ROUND  # current loop round (1-indexed); unset if not in a loop block
DEVFLOW_LOOP_MAX      # maxRounds configured for the loop; unset if not in a loop block
```

`DEVFLOW_LOG_LEVEL` reflects the active Devflow console output mode:

| Value     | Set when                                      |
| --------- | --------------------------------------------- |
| `info`    | Neither `--verbose` nor `--summary` (default) |
| `verbose` | `--verbose`                                   |
| `summary` | `--summary`                                   |

Scripts may read `DEVFLOW_LOG_LEVEL` to adjust their own logging. During a
multi-phase advance, `DEVFLOW_RUN_DIR` points to the current hop's run directory
only.

Devflow passes the same log level to nested `devflow` invocations unless the
child command passes `--verbose` or `--summary`.

---

## 19. Example Workflow

### 19.1 Initialize board

```bash
devflow board init stories unplanned planning planned building built verifying verified finishing finished
```

### 19.2 Create card

```bash
devflow card create stories "Beneficiary Add"
```

Output:

```text
stories-000001
```

### 19.3 Show card

```bash
devflow card show stories-000001
```

### 19.4 Get card directory

```bash
devflow card dir stories-000001
```

Output (absolute path):

```text
/Users/me/project/.devflow/boards/stories/cards/stories-000001
```

### 19.5 Advance to planned

```bash
devflow card advance stories-000001 planned
```

If currently in `unplanned`, this advances:

```text
unplanned -> planning -> planned
```

For each hop it runs that phase's exit scripts (for example `unplanned-001-*`
verification scripts, then `planning-001-*` through `planning-005-*`), then each
phase's commit-message script if present, then **one Git commit per hop**.

### 19.6 Block card

```bash
devflow card block stories-000001 "Waiting for API contract"
```

### 19.7 Unblock card

```bash
devflow card unblock stories-000001
```

The card returns to its previous phase.
