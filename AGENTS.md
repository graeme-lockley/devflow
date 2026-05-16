# Agent instructions

Guidance for humans and coding agents working in this repository.

## Documentation (read before implementing)

These documents define **what** Devflow is and **how** it is built. They are the source of truth for all implementation work.

| Document | Path | Purpose |
|----------|------|---------|
| **Requirements** | [`docs/devflow-requirements.md`](docs/devflow-requirements.md) | Authoritative behavioural specification: product purpose, conceptual model, CLI commands, data formats, transition rules, locking, validation, and error handling. |
| **Architecture** | [`docs/architecture.md`](docs/architecture.md) | Implementation structure: module boundaries, data flow, dependency direction, and how CLI, stores, runner, and services fit together. Behavioural rules stay in requirements; this doc covers shape only. |
| **ADRs** | [`docs/adr/README.md`](docs/adr/README.md) | Architecture Decision Records for significant, hard-to-reverse choices (runtime, durability, locks, git boundaries, etc.). Each ADR links back to relevant requirement sections. |
| **Roadmap** | [`docs/implementation-roadmap.md`](docs/implementation-roadmap.md) | Command-ordered build plan: milestones, current gaps, and checklist of what to implement next. Use this to sequence work and align with the spec. |

### How to use these docs

1. **Before coding**, read the relevant requirements sections, architecture areas, and any ADRs that apply to the task.
2. **During implementation**, match behaviour to requirements and structure to architecture and ADRs. If code and docs disagree, the docs win unless the user explicitly asks to change the docs.
3. **When choosing approach**, prefer decisions already recorded in ADRs; do not invent alternate patterns without user approval and a new ADR.

### Immutable documents

**Unless the user explicitly asks you to edit them, do not modify:**

- [`docs/devflow-requirements.md`](docs/devflow-requirements.md)
- [`docs/architecture.md`](docs/architecture.md)
- Any file under [`docs/adr/`](docs/adr/)

These documents **guide all execution**. Implement and test against them; do not rewrite them to match the code. If you believe a doc is wrong or incomplete, stop and ask the user—do not silently “fix” the spec.

The implementation roadmap may be updated to reflect completed milestones when that is part of the agreed task; requirements, architecture, and ADRs change only when the user explicitly requests it (and typically with a deliberate review).

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

- **Specification:** [`docs/devflow-requirements.md`](docs/devflow-requirements.md)
- **Architecture:** [`docs/architecture.md`](docs/architecture.md)
- **Decisions:** [`docs/adr/README.md`](docs/adr/README.md)
- **Build plan:** [`docs/implementation-roadmap.md`](docs/implementation-roadmap.md)
- **CLI entry:** [`main.ts`](main.ts), implementation under [`src/`](src/)
- **Run tests:** `deno test`
- **Run CLI:** `./devflow`
