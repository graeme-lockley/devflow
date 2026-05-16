# ADR-0006: Directory-based locks via `mkdir`

**Status:** Accepted\
**Date:** 2026-05-16

## Context

Multiple processes may run Devflow (operator + agent, or nested `devflow` from
scripts). We need mutual exclusion for board sequence allocation, card mutation,
and repository-wide `git add` during advance.

Requirements ([§14.4](../devflow-requirements.md#144-lock-implementation)): use
**atomic directory creation**, not lock files.

## Decision

Implement locks as **`.lock/` directories**:

| Lock       | Path                                             |
| ---------- | ------------------------------------------------ |
| Repository | `.devflow/.lock/`                                |
| Board      | `.devflow/boards/<board>/.lock/`                 |
| Card       | `.devflow/boards/<board>/cards/<card-id>/.lock/` |

Acquire: `Deno.mkdir(lockPath)` — success means lock held.\
Release: `Deno.remove(lockPath)` in `finally`.\
Stale locks: manual `devflow lock release*` commands.

`--ignore-lock` skips acquire only (does not delete existing lock dirs) for
nested CLI during advance
([§16.1](../devflow-requirements.md#161-global-flags)).

## Consequences

**Positive**

- `mkdir` atomicity is well-defined on POSIX and common filesystems.
- Lock paths are visible and debuggable.
- Matches `.gitignore` rules
  ([§4.2](../devflow-requirements.md#42-git-ignore-entries)).

**Negative**

- No automatic stale-lock TTL; operators must release manually after crashes.
- NFS or exotic FS may have weaker mkdir guarantees (acceptable for target use).

## References

- Requirements [§14](../devflow-requirements.md#14-locking)
- [`architecture.md` §5.6](../architecture.md#56-lock-service-srcserviceslocksts)
