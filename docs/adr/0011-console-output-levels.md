# ADR-0011: Three console output levels

**Status:** Accepted\
**Date:** 2026-05-16

## Context

Operators want readable transition output; agents need parseable stdout; CI may
want minimal noise. Requirements define `info`, `verbose`, and `summary`
([§16.2](../devflow-requirements.md#162-console-output)).

## Decision

Implement **`services/console.ts`** with a global output level per invocation:

| Level     | Flag        | Behaviour summary                                               |
| --------- | ----------- | --------------------------------------------------------------- |
| `info`    | (default)   | Grey boilerplate; stream script stdout/stderr; green/red status |
| `verbose` | `--verbose` | Info + internal diagnostics (paths, git, locks)                 |
| `summary` | `--summary` | Phase transition lines and errors only; no script stream        |

Rules:

- `--verbose` and `--summary` are mutually exclusive → exit non-zero if both
  set.
- Set `DEVFLOW_LOG_LEVEL` on every script invocation to match active level.
- **Machine stdout** (`card create`, `card dir`, `variable get`, list commands)
  never includes ANSI codes, even when colours are enabled on stderr.
- Disable colours when stdout/stderr is not a TTY.

Commit-message script stdout is never streamed to console
([§13.4](../devflow-requirements.md#134-commit-message-scripts)); always logged
under `logs/`.

## Consequences

**Positive**

- Single module owns formatting; commands stay thin.
- Agents can rely on clean stdout for parsing.

**Negative**

- Every command must route human messages through console service, not raw
  `console.log` for stderr boilerplate.

## References

- Requirements [§16.1](../devflow-requirements.md#161-global-flags),
  [§16.2](../devflow-requirements.md#162-console-output)
- [`architecture.md` §5.9](../architecture.md#59-console-output-srcservicesconsolets)
