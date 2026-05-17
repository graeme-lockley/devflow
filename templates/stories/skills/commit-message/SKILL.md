---
name: commit-message
version: 1.2.0
description: >-
  Writes one Conventional Commits 1.0.0 message for a Devflow transition commit
  from card context and the staged diff. Use on phase transitions when Devflow
  requests a commit message on stdout.
outputs:
  - One commit message printed to stdout (subject and optional body)
allowed-tools:
  - read
  - bash
forbids:
  - git commit
  - git push
---

# Commit Message

Produce **one**
[Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)
message for the current Devflow transition commit.

**Philosophy:** The subject states **what** changed and **why** in one line; the
body adds context only when the diff needs it. Traceability beats cleverness.

Shared rules: [_shared/harness.md](../_shared/harness.md) (commit section).

## Format

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
| `refactor`     | Neither feat nor fix                                                 |
| `build` / `ci` | Build or CI changes                                                  |

- Lowercase types; imperative subject; no trailing period; ~72-char subject.
- Body separated from subject by a blank line; wrap at ~72 chars when used.
- Breaking changes: `type(scope)!: …` or `BREAKING CHANGE:` footer.

## Procedure

1. Read `DEVFLOW_CARD_MD` (or `${DEVFLOW_CARD_DIR}/card.md`) for the title and a
   one-line summary. Do not search for the card by id.
2. From `DEVFLOW_REPO_ROOT`, inspect what will be committed:
   `git status --porcelain`, `git diff`, `git diff --cached`.
3. Choose **type** and **scope** from the diff.
4. Write the subject; include the card id when it aids traceability.
5. Print the message to **stdout** only; end with a newline.

## Examples

**Card-only transition (good):**

```text
docs(stories): prepare stories-000007 — board template assets

Fill preparing sections from StoryDetail; no src changes.
```

**Product code transition (good):**

```text
feat(cli): run exit scripts on card advance

Wire advance command to phase scripts per requirements §11.
```

## Anti-patterns

| DO NOT                                     | DO INSTEAD                            |
| ------------------------------------------ | ------------------------------------- |
| `find` / search for `card.md` by card id   | Open `DEVFLOW_CARD_MD` directly       |
| Markdown fences or commentary on stdout    | Raw message text only                 |
| Run `git commit` or write files            | Devflow commits                       |
| Vague subject (`update stuff`)             | Imperative what + why                 |
| Wrong type for diff (`feat` for card-only) | `docs(stories):` or `chore(stories):` |

## Before exiting

- [ ] Subject is imperative, ≤72 chars, no trailing period
- [ ] Type/scope match the staged diff
- [ ] stdout contains only the message (no fences)

## Out of scope

- Running `git commit` or `git push`
- Writing to files
- Multiple messages
