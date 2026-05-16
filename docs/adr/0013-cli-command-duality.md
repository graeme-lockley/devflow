# ADR-0013: Object-first commands with verb-command synonyms

**Status:** Accepted  
**Date:** 2026-05-16

## Context

The CLI must be ergonomic for humans (`devflow board init`) and for agents that prefer hyphenated verbs (`devflow init-board`). Requirements ([§16](../devflow-requirements.md#16-cli-requirements)): object-first commands are canonical; verb-command aliases provided.

Legacy `idea.md` used flat commands (`devflow init`, `devflow move`); the specification supersedes that.

## Decision

Implement a **single parser** that normalizes argv to `(object, verb, args)`:

| Canonical | Synonym |
|-----------|---------|
| `devflow board init` | `devflow init-board` |
| `devflow card advance` | `devflow advance-card` |
| … | (full table in [§16.0](../devflow-requirements.md#160-command-index)) |

- Synonyms use the **same argument order** as canonical form.
- Dispatch table maps `(object, verb)` → one handler in `commands/`.
- Remove legacy `devflow init` without `board` object in M0 (clean break).

Usage text documents both forms; tests cover at least one synonym per object type.

## Consequences

**Positive**

- One handler per operation; no duplicated business logic.
- README and agents can standardize on either style.

**Negative**

- Parser complexity for global flags and nested subcommands.
- Existing tests using `devflow init` must migrate in M0.

## References

- Requirements [§16.0](../devflow-requirements.md#160-command-index)
- [`implementation-roadmap.md` M0](../implementation-roadmap.md#m0--foundation)
- Supersedes informal CLI in `idea.md`
