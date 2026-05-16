# Agent instructions

Guidance for humans and coding agents working in this repository.

## Git commit messages

Use [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) for every commit.

```
<type>[optional scope]: <description>
```

Common types: `feat`, `fix`, `docs`, `chore`, `test`, `refactor`, `build`, `ci`.

- Subject: imperative mood, concise summary of *why* or *what* changed.
- Scope (optional): area of the codebase, e.g. `feat(cli):`, `fix(board):`.
- Body (optional): extra context, separated from the subject by a blank line.
- Breaking changes: `type!:` or a `BREAKING CHANGE:` footer.

Examples:

```
feat(cli): add init-board command
fix(board): release lock when script exits non-zero
docs: add conventional commit guidance
chore: initialize repository
```

Only create commits when explicitly requested.

## Project context

- Requirements: [`docs/devflow-requirements.md`](docs/devflow-requirements.md)
- CLI entry: [`main.ts`](main.ts), implementation under [`src/`](src/)
- Run tests: `deno test`
- Run CLI: `./devflow`
