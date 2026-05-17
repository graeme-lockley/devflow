# Devflow

Devflow is a deterministic workflow harness for filesystem-backed development
boards. Work moves through an ordered sequence of **phases** as **cards**. At
each phase boundary, Devflow runs board-defined shell scripts, then updates card
state and creates a Git commit.

Scripts may perform mechanical checks or invoke tools such as `pi-mono` with
board-local **skills**. Devflow owns orchestration, locking, history, and Git
commits. Scripts signal success or failure with exit codes; they do not commit
during transitions.

Full behaviour is specified in
[`docs/devflow-requirements.md`](./docs/devflow-requirements.md).

## Concepts

| Concept        | Description                                                                 |
| -------------- | --------------------------------------------------------------------------- |
| **Board**      | Ordered phases, scripts, skills, and cards under `.devflow/boards/<name>/`  |
| **Card**       | A unit of work with `state.json`, `card.md`, optional `files/`, and `logs/` |
| **Phase**      | A step on the board; scripts run when **leaving** a phase (exit actions)    |
| **Transition** | Advancing a card one or more phases via `devflow card advance`              |
| **Blocked**    | Exceptional phase (`blocked`) for cards waiting on external input           |

## Layout

```text
.devflow/
  boards/
    stories/
      board.json
      scripts/          # phase exit scripts and <phase>.commit-message
      skills/           # used by scripts (e.g. pi-mono)
      cards/
        stories-000001/
          state.json    # machine-owned
          card.md       # human/agent-owned
          files/
          logs/
  templates/            # bundled board templates (e.g. stories)
```

Add to `.gitignore` (also ensured automatically on `board init`):

```gitignore
.devflow/.lock/
.devflow/**/.lock/
```

## CLI

Commands use **object-first** form. Each command has a **verb-command** synonym
(`board init` → `init-board`).

| Command                                             | Notes                                                                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `devflow`                                           | Prints usage                                                                                |
| `devflow help`                                      | Prints usage (same as `devflow` with no args or `--help`/`-h`)                              |
| `devflow validate`                                  | Repository, all boards, all cards (§17)                                                     |
| `devflow board init` / `init-board`                 | Creates board layout; `--template`, `--sequence-width`; repo lock                           |
| `devflow board list` / `list-boards`                | Board names, one per line (plain stdout)                                                    |
| `devflow board show` / `show-board`                 | Board metadata on stdout                                                                    |
| `devflow board validate` / `validate-board`         | §17.1 checks; exit 0 when valid                                                             |
| `devflow card create` / `create-card`               | New card ID on stdout                                                                       |
| `devflow card list` / `list-cards`                  | Card IDs; `--phase` filter                                                                  |
| `devflow card show` / `show-card`                   | YAML frontmatter + `card.md`                                                                |
| `devflow card dir` / `card-dir`                     | Absolute card path on stdout                                                                |
| `devflow card rename` / `rename-card`               | Updates title in `state.json` and `card.md`                                                 |
| `devflow card add-file` / `add-card-file`           | Attachment under `files/`                                                                   |
| `devflow card validate` / `validate-card`           | §17.2 checks; exit 0 when valid                                                             |
| `devflow card advance` / `advance-card`             | Exit scripts, commit per hop; `--skip` omits named actions; `--force` skips all scripts/git |
| `devflow card block` / `block-card`                 | Move card to blocked phase with reason                                                      |
| `devflow card unblock` / `unblock-card`             | Restore card to `previousPhase`                                                             |
| `devflow variable get` / `get-variable`             | Variable value on stdout                                                                    |
| `devflow variable set` / `set-variable`             | Set card variable; `--ignore-lock` for nested CLI during advance                            |
| `devflow lock release` / `release-lock`             | Release stale card lock (`--force`)                                                         |
| `devflow lock release-board` / `release-board-lock` | Release stale board lock (`--force`)                                                        |
| `devflow lock release-repo` / `release-repo-lock`   | Release stale repository lock (`--force`)                                                   |

Global flags: `--help` / `-h` (print usage and exit 0), `--verbose` (extra
diagnostics), `--summary` (phase lines and errors only). Machine-parseable
stdout never includes ANSI codes.

Argument and parsing errors emit a single structured error line on stderr; the
full usage block is printed only by `devflow` with no args, `devflow help`, or
`--help`/`-h`.

`--ignore-lock` on `variable set` and `card add-file` only (skip card lock when
the parent advance already holds it).

```bash
devflow board init stories unplanned planning planned --template stories
devflow validate
devflow card create stories "My card"
devflow card create stories "My card" --description "One-line context for the card body."
devflow card create stories "My card" --description-file ./body.md
devflow card advance stories-000001 planned
devflow card advance stories-000001 planned --skip planning-003
devflow card block stories-000001 "Waiting for API contract"
devflow card unblock stories-000001
```

See [`docs/devflow-requirements.md`](./docs/devflow-requirements.md) for the
full specification and [`docs/architecture.md`](./docs/architecture.md) for
implementation structure.

## Typical flow

1. Initialize a board (optionally from the `stories` template).
2. Create a card; it starts in the first phase.
3. Commit setup work (new boards, cards) before advancing.
4. Run `devflow card advance <card-id> <target-phase>` to move forward.
5. For each phase hop, Devflow runs exit scripts, optional
   `<phase>.commit-message`, updates `state.json`, then `git add -A` and
   `git commit`.
6. On failure, the card stays in place; fix the issue and advance again, use
   `--skip` to bypass a known-broken exit action, or use `--force` where allowed
   (`--skip` and `--force` cannot be combined).

Advance one card at a time per repository.

## Using Devflow in another repository

Devflow can be run remotely from JSR (the Deno registry) without cloning the
Devflow repository into your project. This keeps consumer projects lightweight
while providing access to built-in templates.

### Install and run

**One-off command:**

```bash
deno run --allow-read --allow-write --allow-run --allow-env \
  jsr:@devflow/devflow@0.1.0 board init stories preparing planning building verifying finishing done --template stories
```

**Install globally:**

```bash
deno install --global --allow-read --allow-write --allow-run --allow-env \
  --name devflow \
  jsr:@devflow/devflow@0.1.0

devflow board init stories preparing planning building verifying finishing done --template stories
```

**Local wrapper (recommended):**

Create a `devflow` wrapper in your repository root:

```bash
#!/usr/bin/env bash
set -euo pipefail
exec deno run \
  --allow-read --allow-write --allow-run --allow-env \
  jsr:@devflow/devflow@0.1.0 "$@"
```

Then `chmod +x devflow` and use `./devflow` as usual.

### Required permissions

Devflow needs:

- `--allow-read` — read board state, scripts, and repository files
- `--allow-write` — update card state and create `.devflow/` structure
- `--allow-run` — invoke exit scripts and Git commands
- `--allow-env` — pass environment variables to scripts

### Version pinning

**Exact version (recommended for reproducibility):**

```bash
jsr:@devflow/devflow@0.1.0
```

**Compatible updates (accept patch-level changes):**

```bash
jsr:@devflow/devflow@^0.1.0
```

### Consumer project requirements

- **Git repository** — Devflow creates commits on phase transitions
- **Deno installed** — Devflow is a Deno CLI tool
- **`deno.json` with `test` and `ci` tasks** (if using the `stories` template):

  ```json
  {
    "tasks": {
      "lint": "deno lint",
      "fmt:check": "deno fmt --check",
      "test": "deno test --allow-read --allow-write --allow-run --allow-env",
      "ci": "deno task lint && deno task fmt:check && deno task test"
    }
  }
  ```

### Example setup

```bash
cd /path/to/your-project
git init

# Create local wrapper
cat > devflow << 'EOF'
#!/usr/bin/env bash
set -euo pipefail
exec deno run \
  --allow-read --allow-write --allow-run --allow-env \
  jsr:@devflow/devflow@0.1.0 "$@"
EOF
chmod +x devflow

# Initialize board from template
./devflow board init stories preparing planning building verifying finishing done --template stories

# Create your first card
./devflow card create stories "My first story"

# Advance it through phases
./devflow card advance stories-000001 planning
```

## Board script composition

Boards may use **hierarchical script layout** and **phase loop blocks** to
compose multi-step validation workflows:

### Flat layout (default)

Scripts directly in `.devflow/boards/<board>/scripts/` matching
`<phase>-NNN-<name>` are run in lexical order on phase exit.

### Hierarchical layout

Organize scripts into:

- **Root scripts** (auto-discovered): `scripts/<phase>-NNN-<name>` (executable
  files directly in `scripts/`)
- **Child scripts** (parent-invoked): `scripts/<phase>/steps/01-name.sh`,
  `scripts/<phase>/lib/common.sh`
- **Helpers** (sourced): non-executable libraries in subdirectories

### Loop blocks

Boards may configure **retry loops** for phases in `board.json`:

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

**Semantics:**

- Root scripts **lexically before** first loop step run first (entry scripts).
- Loop steps run sequentially; any failure **restarts from first step** (new
  round).
- After `maxRounds` with failure, the transition fails (phase unchanged).
- Root scripts **lexically after** last loop step run after loop completes (exit
  scripts).
- Loop steps receive `DEVFLOW_SCRIPT_ROUND` (1-indexed), `DEVFLOW_LOOP_MAX`,
  `DEVFLOW_SCRIPT_PARENT` environment variables.

Phases without loop config use flat lexical discovery (backward compatible).

See [§9.11](./docs/devflow-requirements.md#911-phase-loop-blocks) and
[ADR-0014](./docs/adr/0014-script-composition-and-loops.md) for full
specification.

## This repository

| Path                                                             | Purpose                            |
| ---------------------------------------------------------------- | ---------------------------------- |
| [`docs/devflow-requirements.md`](./docs/devflow-requirements.md) | Requirements specification         |
| [`main.ts`](./main.ts)                                           | CLI entry point                    |
| [`src/`](./src/)                                                 | TypeScript implementation          |
| [`devflow`](./devflow)                                           | Shell wrapper (`deno run main.ts`) |

## Requirements

To run Devflow and the **stories** board workflow in this repository:

| Tool                                                             | Required for                                   | Notes                                                                                                                            |
| ---------------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| [Deno](https://docs.deno.com/runtime/)                           | Devflow CLI and tests                          | Version per [`deno.json`](./deno.json)                                                                                           |
| [Git](https://git-scm.com/)                                      | Transitions (`git add` / `git commit` per hop) | Repository must be a git work tree                                                                                               |
| [jq](https://jqlang.github.io/jq/)                               | Stories board pi deliberation renderer         | Parses `pi --mode json` events in `scripts/lib/pi-render.sh`; if missing, the renderer falls back to pass-through with a warning |
| `pi` ([pi-mono](https://github.com/badlogic/pi-mono), on `PATH`) | LLM-driven phase scripts on the stories board  | Optional for CI (`DEVFLOW_SKIP_PI=1`); required for full prepare/plan/build/verify/finish flows                                  |

Other boards may define different script dependencies; the table above reflects
this repo’s dogfood **stories** board.

### Deno permissions

The CLI and tests use these flags (see [`devflow`](./devflow) and
[`deno.json`](./deno.json)):

| Flag            | Purpose                                               |
| --------------- | ----------------------------------------------------- |
| `--allow-read`  | Read boards, cards, templates, git metadata           |
| `--allow-write` | Write state, logs, locks, atomic JSON updates         |
| `--allow-run`   | Execute board scripts and `git` subprocesses          |
| `--allow-env`   | Set `DEVFLOW_*` for scripts; read `DEVFLOW_LOG_LEVEL` |

### Pi visibility under Devflow

When running Devflow transitions that invoke **pi** for story skills (prepare,
plan, build, verify, finish), the stories board scripts surface pi's
deliberation, tool use, and progress on the console:

- **`info` / `verbose` log level (default):** Live human-readable stream of pi's
  thinking (verbose only), tool calls, and output appears on stderr during the
  transition. This visibility is provided by `scripts/lib/pi-render.sh`, which
  parses `pi --mode json` events.
- **`--summary`:** No script or pi output is streamed to the console (only
  phase-level messages and errors). The full transcript is still captured in the
  card's `logs/` directory.
- **`DEVFLOW_SKIP_PI=1`:** Pi is not invoked; existing skip messages still apply
  (useful for CI or when pi is not available).

The renderer requires **jq** to parse JSON events. If jq is missing at runtime,
the renderer emits a single grey warning and falls back to pass-through mode
(raw events are still logged, but not transformed into human-readable output).

**Commit-message scripts** continue to use plain text mode (`--mode text`)
rather than JSON, as their stdout must remain clean for use as commit messages.

## Development

Commit messages follow
[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) — see
[`AGENTS.md`](./AGENTS.md).

```bash
./devflow
deno lint
deno fmt --check
deno task test
```

Or run the full CI checks locally:

```bash
deno task ci
```

### Git hooks

Install the pre-commit hook (runs `deno lint` and `deno fmt --check`):

```bash
./scripts/setup-git-hooks.sh
```

### Continuous integration

GitHub Actions runs the same checks on push and pull requests: `deno lint`,
`deno fmt --check`, and `deno task test` (see
[`.github/workflows/ci.yml`](./.github/workflows/ci.yml)).
