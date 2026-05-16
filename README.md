# Devflow

Devflow is a deterministic workflow harness for filesystem-backed development boards. Work moves through an ordered sequence of **phases** as **cards**. At each phase boundary, Devflow runs board-defined shell scripts, then updates card state and creates a Git commit.

Scripts may perform mechanical checks or invoke tools such as `pi-mono` with board-local **skills**. Devflow owns orchestration, locking, history, and Git commits. Scripts signal success or failure with exit codes; they do not commit during transitions.

Full behaviour is specified in [`docs/devflow-requirements.md`](./docs/devflow-requirements.md).

## Concepts

| Concept | Description |
|---------|-------------|
| **Board** | Ordered phases, scripts, skills, and cards under `.devflow/boards/<name>/` |
| **Card** | A unit of work with `state.json`, `card.md`, optional `files/`, and `logs/` |
| **Phase** | A step on the board; scripts run when **leaving** a phase (exit actions) |
| **Transition** | Advancing a card one or more phases via `devflow card advance` |
| **Blocked** | Exceptional phase (`blocked`) for cards waiting on external input |

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

Add to `.gitignore`:

```gitignore
.devflow/**/.lock/
```

## CLI

Commands use **object-first** form. Each command has a **verb-command** synonym (`board init` → `init-board`).

Global flags (all commands): `--ignore-lock`, `--verbose`, `--summary`.

```bash
# Board
devflow board init stories unplanned planning planned building built verifying verified finishing finished
devflow init-board stories unplanned planning planned building built verifying verified finishing finished --template stories
devflow board list
devflow board show stories

# Card
devflow card create stories "Add beneficiary validation"
devflow card advance stories-000001 planned
devflow card show stories-000001
devflow card dir stories-000001
devflow card block stories-000001 "Waiting for API contract"
devflow card unblock stories-000001

# Variables (use --ignore-lock when called from a script during card advance)
devflow variable set stories-000001 SESSION_ID "abc" --ignore-lock
devflow variable get stories-000001 SESSION_ID

devflow card rename stories-000001 "New title"

# Validation
devflow validate
```

Git commits are created only by `card advance` (one per successful phase hop). Other commands do not commit.

See [`docs/devflow-requirements.md`](./docs/devflow-requirements.md) for the full specification.

## Typical flow

1. Initialize a board (optionally from the `stories` template).
2. Create a card; it starts in the first phase.
3. Run `devflow card advance <card-id> <target-phase>` to move forward.
4. For each phase hop, Devflow runs exit scripts, optional `<phase>.commit-message`, updates `state.json`, then `git add -A` and `git commit`.
5. Commit setup work (new boards, cards, variables) manually before advancing.
6. On failure, the card stays in place; fix the issue and advance again, or use `--force` where allowed.

Advance one card at a time per repository.

## This repository

| Path | Purpose |
|------|---------|
| [`docs/devflow-requirements.md`](./docs/devflow-requirements.md) | Requirements specification |
| [`main.ts`](./main.ts) | CLI entry point |
| [`src/`](./src/) | TypeScript implementation |
| [`devflow`](./devflow) | Shell wrapper (`deno run main.ts`) |

## Requirements

- [Deno](https://docs.deno.com/runtime/) (see [`deno.json`](./deno.json))

## Development

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) — see [`AGENTS.md`](./AGENTS.md).

```bash
./devflow
deno test
```

The CLI is being built to match the requirements specification. Until that work is complete, only a subset of commands may be available.
