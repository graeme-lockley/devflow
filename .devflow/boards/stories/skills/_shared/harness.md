# Stories board — shared harness

Read this once per skill run. Phase-specific rules live in each `SKILL.md`.

## Template

[story.template.md](../../assets/story.template.md) — keep every `##` heading and
`<!-- phase-gate -->` comment.

## Harness contract (card skills)

Devflow owns phase transitions, locks, history, exit-script gates, and commits.
You only read context and edit `card.md` (and docs when a skill explicitly allows).

**DO NOT:** `git commit`, `git push`, `devflow card advance`, or modify `state.json`.

Read `state.json` for `title` and phase; never write it.

## Environment

| Variable              | Use                                      |
| --------------------- | ---------------------------------------- |
| `DEVFLOW_CARD_ID`     | Card identifier (e.g. `stories-000007`)  |
| `DEVFLOW_CARD_DIR`    | Absolute path to card folder             |
| `DEVFLOW_CARD_MD`     | Absolute path to `card.md` — **read this first** |
| `DEVFLOW_STATE_JSON`  | Absolute path to `state.json` (read-only)|
| `DEVFLOW_REPO_ROOT`   | Git root (cwd for code/tests)            |

**Do not search** for the card by name. Open `DEVFLOW_CARD_MD` directly; pi
prompts and Devflow scripts pass the full path.

Manual run: `./devflow card dir <card-id>` → card directory.

## Immutable docs

`docs/devflow-requirements.md`, `docs/architecture.md`, and `docs/adr/*` change
only with explicit user approval (AGENTS.md). Plan pending edits in **Spec
Updates**; apply them in **finish-story** when approved.

## Harness contract (commit-message skill)

Devflow captures **stdout** as the commit message (req §13.4) and creates the
commit. Print only the message text — no fences, preamble, or commentary.

**DO NOT:** `git commit`, `git push`, or write files.

### Commit environment

| Variable             | Meaning                |
| -------------------- | ---------------------- |
| `DEVFLOW_CARD_ID`    | Card identifier        |
| `DEVFLOW_CARD_DIR`   | Path to card directory |
| `DEVFLOW_FROM_PHASE` | Phase being exited     |
| `DEVFLOW_TO_PHASE`   | Next phase             |
| `DEVFLOW_REPO_ROOT`  | Git repository root    |
