# Devflow — agent usage

Instructions for coding agents operating in a **consumer** repository that uses
Devflow. Paste the block in [`AGENT-USAGE.include.md`](./AGENT-USAGE.include.md)
into the repo's `AGENTS.md` (or equivalent).

Normative behaviour: [`devflow-requirements.md`](./devflow-requirements.md).
Human-oriented overview: [`../README.md`](../README.md).

---

## Role split

| Actor             | Responsibility                                                                                      |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| **Devflow**       | Phase sequencing, locks, `state.json`, history, running exit scripts, Git commit per successful hop |
| **You (agent)**   | Edit `card.md`, `files/`, and product source; invoke CLI; never orchestrate phases by hand          |
| **Board scripts** | Validation, mechanical work, bounded LLM calls (`pi-mono` + skills); exit `0` / non-zero only       |

Devflow does **not** auto-retry failed transitions. You recover manually.

---

## Preconditions

- Run every `devflow` command from the **Git repository root** (work tree root).
- Use the project's Devflow entrypoint (`./devflow`, global `devflow`, or
  `deno run … jsr:@kestrel/devflow@…`) consistently.
- Repository must be a Git work tree. Devflow commits on successful phase hops
  during `card advance`.
- Advance **one card at a time** per repository. Do not run parallel
  `card advance` on different cards in the same repo.

---

## Filesystem ownership

Under `.devflow/boards/<board>/cards/<card-id>/`:

| Path         | You                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------ |
| `card.md`    | **MAY** read and edit when no transition is running for this card                          |
| `files/`     | **MAY** read and edit; prefer `devflow card add-file` for new attachments                  |
| `state.json` | **MUST NOT** edit — use CLI (`variable set`, `card advance`, `block`, `unblock`, `rename`) |
| `logs/`      | **MUST NOT** edit — read only for diagnosis                                                |

Board scripts and skills live under `.devflow/boards/<board>/scripts/` and
`skills/`. Do not change them unless the user asked you to modify the workflow.

While a transition is **in progress** for a card, do **not** edit that card's
`card.md`, `files/`, or repo source. Wait until the command finishes.

---

## Standard work loop

1. **Discover context**

   ```bash
   devflow board list
   devflow card list <board> [--phase <phase>]
   devflow card show <card-id>
   ```

2. **Open workspace**

   ```bash
   CARD_DIR="$(devflow card dir <card-id>)"
   ```

   Parse **only** the single stdout line (no ANSI). Paths are absolute.

3. **Do work** — edit `card.md`, `files/`, and application code per the card and
   user request. Follow board script expectations (structure checks run on
   advance).

4. **Persist script-oriented values** (when needed)

   ```bash
   devflow variable set <card-id> <NAME> "<value>"
   devflow variable get <card-id> <NAME>
   ```

5. **Validate before advance** (when unsure)

   ```bash
   devflow card validate <card-id>
   devflow validate
   ```

6. **Advance phase** — only when exit criteria for the current phase are met and
   the user wants the transition:

   ```bash
   devflow card advance <card-id> <target-phase>
   ```

   `<target-phase>` may be one or more hops forward on the board's phase order.
   Exit scripts for each hop run when **leaving** the current phase, then
   Devflow updates state and runs `git add -A` + `git commit` at repo root.

7. **On failure** — card stays in the phase reached before failure. Read `logs/`
   under the card directory and stderr. Fix workspace or scripts, then
   `card advance` again. Do **not** assume idempotent scripts.

---

## CLI rules for automation

- Prefer **verb-command** synonyms if argv is simpler: `create-card`,
  `card-dir`, `advance-card`, `get-variable`, `set-variable`, `list-boards`,
  `list-cards`, `show-card`, `block-card`, `unblock-card`.
- Object-first form is equivalent: `devflow card create`, `devflow card dir`, …
- Commands that print machine data (`card create`, `card dir`, `variable get`,
  `board list`, `card list`, …): capture **stdout** only; one value or one
  record per line; no colour codes on stdout.
- Errors: single line `Error: …` on stderr. Full usage appears only for
  `devflow`, `devflow help`, or `--help` / `-h`.
- Default log level is `info` (script output streamed). Use `--summary` when you
  need less console noise; transcripts remain in `logs/`.

---

## Commands you will use

| Intent                | Command                                                        |
| --------------------- | -------------------------------------------------------------- |
| New card              | `devflow card create <board> "<title>"` → stdout = new card ID |
| Card path             | `devflow card dir <card-id>`                                   |
| Show state + body     | `devflow card show <card-id>`                                  |
| Rename title          | `devflow card rename <card-id> "<title>"`                      |
| Attach file           | `devflow card add-file <card-id> <src> [--dest name]`          |
| Advance               | `devflow card advance <card-id> <target-phase>`                |
| Block (external wait) | `devflow card block <card-id> "<reason>"`                      |
| Unblock               | `devflow card unblock <card-id>`                               |
| Read variable         | `devflow variable get <card-id> <NAME>`                        |
| Write variable        | `devflow variable set <card-id> <NAME> "<value>"`              |
| Stale card lock       | `devflow lock release <card-id> [--force]`                     |
| Repo / board locks    | `devflow lock release-repo` / `release-board <board>`          |

Do **not** call `card advance`, `card block`, `card unblock`, or `card rename`
from inside board exit scripts (only the operator/agent at the shell).

---

## Flags that matter

| Flag                    | When                                                                                                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--ignore-lock`         | **Only** on `variable set` and `card add-file` when a parent `card advance` already holds the card lock (including calls from scripts). Other commands reject it. |
| `--skip <phase>-<seq>…` | `card advance` only — skip named root exit scripts for this hop. Mutually exclusive with `--force`.                                                               |
| `--force`               | `card advance` only — skip all exit scripts and Git steps for the requested hop(s). Use only when the user explicitly wants recovery bypass.                      |
| `--summary`             | Less console output; use when parsing human messages is noisy                                                                                                     |
| `--verbose`             | More Devflow diagnostics; do not combine with `--summary`                                                                                                         |

---

## Git

- Devflow creates commits on **successful** normal hops during `card advance`.
- **MUST NOT** `git commit` as a substitute for advancing when the workflow
  expects a phase hop.
- **MUST NOT** commit inside board scripts during transitions (scripts may use
  read-only git checks).
- Earlier hops in a multi-phase advance are **not** rolled back if a later hop
  fails; repair forward from the phase you are in.
- Ensure working tree state board scripts expect **before** `card advance` (many
  boards run `git status` / clean-tree checks in exit scripts).

---

## Blocked phase

- `blocked` is a reserved exceptional phase (not listed in `board init` phases).
- Use `card block` when work cannot proceed until external input.
- Use `card unblock` to return to `previousPhase`.
- Do not advance into `blocked` via `card advance` unless requirements for that
  path apply; prefer `card block`.

---

## Variables and `NEXT_SCRIPT`

- Card variables live in `state.json` but **MUST** be read/written via CLI.
- Reserved: `NEXT_SCRIPT` — set by **scripts** (not you) during transitions to
  jump between root exit scripts in the same phase:
  `devflow variable set <card-id> NEXT_SCRIPT "building-002" --ignore-lock`.
- Do not use `NEXT_SCRIPT` for your own bookkeeping.

---

## Failure recovery checklist

1. Note card ID and current phase (`card show` or frontmatter).
2. Read latest run under `<card-dir>/logs/`.
3. Fix `card.md`, `files/`, code, or variables.
4. Re-run `devflow card validate <card-id>` if helpful.
5. `devflow card advance <card-id> <target-phase>` again.
6. If a specific exit script is broken but advance must proceed, user may
   authorize `--skip` or `--force` — do not use without explicit user consent.
7. If lock errors persist after a crashed run:
   `devflow lock release <card-id> --force` (only when stale; understand why).

---

## What not to do

- Edit `state.json` or `logs/` directly.
- Run `card advance` on two cards concurrently in one repo.
- Edit the card workspace during an active `card advance` for that card.
- Parse coloured stderr as structured data.
- Retry `card advance` in a tight loop without fixing the underlying failure.
- Change board phase order or `board.json` unless the user asked.
- Invoke LLM orchestration yourself for phase changes — LLMs belong in board
  scripts with bounded tasks and exit codes.

---

## Include in consumer `AGENTS.md`

See [`AGENT-USAGE.include.md`](./AGENT-USAGE.include.md).
