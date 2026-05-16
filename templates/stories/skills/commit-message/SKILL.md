---
name: commit-message
version: 1.0.0
description: >-
  Writes a single Git commit message in Conventional Commits 1.0.0 format from
  card context and repository changes. Use when a phase commit-message script
  invokes pi for stories board transitions.
outputs:
  - One commit message printed to stdout (subject and optional body)
allowed-tools:
  - read
  - bash
forbids:
  - git push
  - git commit
---

# Commit Message

Produce **one**
[Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)
message for the current Devflow transition commit. Output **only** the commit
message text—no markdown fences, no preamble, no trailing commentary.

Devflow captures **stdout** as the commit message (req §13.4). Do not write to
files or run `git commit`.

## Specification

Format:

```text
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

| Type           | Use when                                                             |
| -------------- | -------------------------------------------------------------------- |
| `feat`         | New user-facing behaviour or CLI capability                          |
| `fix`          | Bug fix                                                              |
| `docs`         | Documentation or story card content only                             |
| `chore`        | Tooling, board scripts, maintenance without product behaviour change |
| `test`         | Tests only                                                           |
| `refactor`     | Code change that is neither feat nor fix                             |
| `build` / `ci` | Build or CI changes                                                  |

- Use **lowercase** types.
- **Scope** (optional): area of the codebase, e.g. `stories`, `cli`, `board`.
- **Description:** imperative mood, concise, no trailing period, ~72 characters
  for the subject line.
- **Body:** optional; separate from subject with a blank line; wrap at ~72
  characters when helpful.
- **Breaking changes:** `type(scope)!: description` or a `BREAKING CHANGE:`
  footer.

Reference:
[Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/).

## Environment

When invoked from a board script:

| Variable             | Meaning                                 |
| -------------------- | --------------------------------------- |
| `DEVFLOW_CARD_ID`    | Card identifier (e.g. `stories-000001`) |
| `DEVFLOW_CARD_DIR`   | Path to card directory                  |
| `DEVFLOW_FROM_PHASE` | Phase being exited                      |
| `DEVFLOW_TO_PHASE`   | Next phase after this hop               |
| `DEVFLOW_REPO_ROOT`  | Git repository root                     |

## Procedure

1. Read `card.md` in `DEVFLOW_CARD_DIR` for the `#` title and a one-line summary
   of the story.
2. From `DEVFLOW_REPO_ROOT`, inspect changes that this commit will include:
   - `git status --porcelain`
   - `git diff` and `git diff --cached` (if useful)
3. Choose the **type** and **scope** from the actual diff:
   - Story card content under `.devflow/boards/.../cards/...` → usually
     `docs(stories):` or `chore(stories):`
   - Product code in `src/` → `feat`, `fix`, or `refactor` with a fitting scope
4. Write a subject that states **what** changed and **why** in plain language.
   Include the card id in the subject or body when it aids traceability.
5. For **preparing → planning**, prefer messages like:
   - `docs(stories): prepare stories-000001 — <short title>` when the hop mainly
     adds or updates `card.md`.
6. Print the final message to **stdout** only. Single message; end with a
   newline.

## Quality gate

- [ ] Message conforms to Conventional Commits 1.0.0
- [ ] Subject is imperative and under ~72 characters when possible
- [ ] Type and scope match the diff
- [ ] No markdown code fences or meta-commentary in output
- [ ] stdout contains nothing except the commit message

## pi invocation

Board `preparing.commit-message` (and sibling phase scripts) call:

```bash
pi --skill .devflow/boards/stories/skills/commit-message \
  --model "${DEVFLOW_LIGHT_MODEL}" --print "<prompt>"
```

Set `DEVFLOW_SKIP_PI=1` to use the script’s shell fallback instead.
