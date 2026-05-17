---
name: commit-message
version: 1.1.0
description: >-
  Write one Conventional Commits 1.0.0 message for a Devflow transition commit
  from card context and the staged diff.
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
message for the current Devflow transition commit. Print **only** the message
text on stdout — no fences, no preamble, no commentary.

**Harness contract:** Devflow captures stdout as the commit message (req §13.4)
and creates the commit itself. Do not write files or run `git commit`.

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

## Environment

| Variable             | Meaning                          |
| -------------------- | -------------------------------- |
| `DEVFLOW_CARD_ID`    | Card identifier                  |
| `DEVFLOW_CARD_DIR`   | Path to card directory           |
| `DEVFLOW_FROM_PHASE` | Phase being exited               |
| `DEVFLOW_TO_PHASE`   | Next phase                       |
| `DEVFLOW_REPO_ROOT` | Git repository root               |

## Procedure

1. Read `card.md` in `DEVFLOW_CARD_DIR` for the title and a one-line summary.
2. From `DEVFLOW_REPO_ROOT`, inspect what will be committed:
   `git status --porcelain`, `git diff`, `git diff --cached`.
3. Choose **type** and **scope** from the diff:
   - Card-only changes under `.devflow/boards/.../cards/...` → usually
     `docs(stories):` or `chore(stories):`.
   - `src/` product code → `feat`, `fix`, or `refactor` with a fitting scope.
4. Write a subject stating **what** changed and **why**. Include the card id
   when it aids traceability — e.g.
   `docs(stories): prepare stories-000001 — <short title>`.
5. Print the message to **stdout** only; end with a newline.

## Out of scope

- Running `git commit` or `git push`
- Writing to files
- Multiple messages or markdown decoration
