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

| Command                                             | Notes                                                             |
| --------------------------------------------------- | ----------------------------------------------------------------- |
| `devflow`                                           | Prints usage                                                      |
| `devflow validate`                                  | Repository, all boards, all cards (§17)                           |
| `devflow board init` / `init-board`                 | Creates board layout; `--template`, `--sequence-width`; repo lock |
| `devflow board list` / `list-boards`                | Board names, one per line (plain stdout)                          |
| `devflow board show` / `show-board`                 | Board metadata on stdout                                          |
| `devflow board validate` / `validate-board`         | §17.1 checks; exit 0 when valid                                   |
| `devflow card create` / `create-card`               | New card ID on stdout                                             |
| `devflow card list` / `list-cards`                  | Card IDs; `--phase` filter                                        |
| `devflow card show` / `show-card`                   | YAML frontmatter + `card.md`                                      |
| `devflow card dir` / `card-dir`                     | Absolute card path on stdout                                      |
| `devflow card rename` / `rename-card`               | Updates title in `state.json` and `card.md`                       |
| `devflow card add-file` / `add-card-file`           | Attachment under `files/`                                         |
| `devflow card validate` / `validate-card`           | §17.2 checks; exit 0 when valid                                   |
| `devflow card advance` / `advance-card`             | Exit scripts, commit per hop; `--force` skips scripts/git         |
| `devflow card block` / `block-card`                 | Move card to blocked phase with reason                            |
| `devflow card unblock` / `unblock-card`             | Restore card to `previousPhase`                                   |
| `devflow variable get` / `get-variable`             | Variable value on stdout                                          |
| `devflow variable set` / `set-variable`             | Set card variable; `--ignore-lock` for nested CLI during advance  |
| `devflow lock release` / `release-lock`             | Release stale card lock (`--force`)                               |
| `devflow lock release-board` / `release-board-lock` | Release stale board lock (`--force`)                              |
| `devflow lock release-repo` / `release-repo-lock`   | Release stale repository lock (`--force`)                         |

Global flags: `--verbose` (extra diagnostics), `--summary` (phase lines and
errors only). Machine-parseable stdout never includes ANSI codes.

`--ignore-lock` on `variable set` and `card add-file` only (skip card lock when
the parent advance already holds it).

```bash
devflow board init stories unplanned planning planned --template stories
devflow validate
devflow card create stories "My card"
devflow card create stories "My card" --description "One-line context for the card body."
devflow card create stories "My card" --description-file ./body.md
devflow card advance stories-000001 planned
devflow card block stories-000001 "Waiting for API contract"
devflow card unblock stories-000001
```

See [`docs/devflow-requirements.md`](./docs/devflow-requirements.md) for the
full specification and
[`docs/implementation-roadmap.md`](./docs/implementation-roadmap.md) for build
status.

## Typical flow

1. Initialize a board (optionally from the `stories` template).
2. Create a card; it starts in the first phase.
3. Commit setup work (new boards, cards) before advancing.
4. Run `devflow card advance <card-id> <target-phase>` to move forward.
5. For each phase hop, Devflow runs exit scripts, optional
   `<phase>.commit-message`, updates `state.json`, then `git add -A` and
   `git commit`.
6. On failure, the card stays in place; fix the issue and advance again, or use
   `--force` where allowed.

Advance one card at a time per repository.

## This repository

| Path                                                             | Purpose                            |
| ---------------------------------------------------------------- | ---------------------------------- |
| [`docs/devflow-requirements.md`](./docs/devflow-requirements.md) | Requirements specification         |
| [`main.ts`](./main.ts)                                           | CLI entry point                    |
| [`src/`](./src/)                                                 | TypeScript implementation          |
| [`devflow`](./devflow)                                           | Shell wrapper (`deno run main.ts`) |

## Requirements

- [Deno](https://docs.deno.com/runtime/) (see [`deno.json`](./deno.json))

### Deno permissions

The CLI and tests use these flags (see [`devflow`](./devflow) and
[`deno.json`](./deno.json)):

| Flag            | Purpose                                               |
| --------------- | ----------------------------------------------------- |
| `--allow-read`  | Read boards, cards, templates, git metadata           |
| `--allow-write` | Write state, logs, locks, atomic JSON updates         |
| `--allow-run`   | Execute board scripts and `git` subprocesses          |
| `--allow-env`   | Set `DEVFLOW_*` for scripts; read `DEVFLOW_LOG_LEVEL` |

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
