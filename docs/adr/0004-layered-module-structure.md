# ADR-0004: Layered CLI module structure

**Status:** Accepted\
**Date:** 2026-05-16

## Context

The CLI will grow to ~20 commands, a transition runner, script execution, Git
integration, and locking. A flat `src/` tree will become hard to navigate and
test.

## Decision

Organize implementation in **layers** with strict dependency direction:

```text
cli → commands → services → domain → infra
```

- **cli** — parsing and dispatch only.
- **commands** — thin handlers per user verb.
- **services** — transition, scripts, git, locks, console, templates.
- **domain** — board/card types, validation, history, phase logic.
- **infra** — paths, git-root, atomic I/O, subprocess helpers.

Lower layers must not import from higher layers.

## Consequences

**Positive**

- Transition logic is testable without argv parsing.
- Multiple commands can share locks and script services.
- Clear place for new commands (`commands/`).

**Negative**

- M0 must refactor existing `src/cli.ts`, `src/paths.ts` into the new layout.
- Some indirection for simple commands (e.g. `board list`).

## References

- [`architecture.md` §2–3](../architecture.md#2-layered-structure)
