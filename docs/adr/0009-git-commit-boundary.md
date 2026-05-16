# ADR-0009: Git commits only on successful advance hops

**Status:** Accepted\
**Date:** 2026-05-16

## Context

Devflow is Git-backed workflow tooling. Operators and scripts may change many
files; we need clear rules for when Devflow creates commits vs when operators
commit manually.

Requirements ([§13.2](../devflow-requirements.md#132-when-devflow-commits)):
only `card advance` (each successful normal hop) creates commits; most other
commands do not.

## Decision

Centralize Git writes in **`services/git.ts`**, callable only from the
transition runner after:

1. All exit scripts for the hop succeeded.
2. Commit-message script succeeded (or default message used).
3. Card `state.json` updated for the hop.

Per hop: `git add -A` from repo root, then `git commit -m <message>`.

**Explicit non-committers:** `card create`, `variable set`, `card block`,
`board init`, `card advance --force`, etc.
([§13.2](../devflow-requirements.md#132-when-devflow-commits)).

Scripts must not call `git commit` during transitions; Devflow does not enforce
this at runtime (trust model
[§9.6](../devflow-requirements.md#96-script-execution-trust)).

## Consequences

**Positive**

- One commit per phase hop gives auditable progress
  ([§3 principle 5](../devflow-requirements.md#3-design-principles)).
- Operators know to commit setup work before first advance.

**Negative**

- Failed hop after state update but before commit leaves manual recovery
  ([§13.7](../devflow-requirements.md#137-git-commit-failure)).
- `git add -A` stages entire repo, not just `.devflow/`.

## References

- Requirements [§13](../devflow-requirements.md#13-git-and-commit-semantics)
- [`architecture.md` §5.5](../architecture.md#55-git-service-srcservicesgits)
