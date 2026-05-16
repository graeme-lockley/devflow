# ADR-0005: Atomic JSON writes (temp + rename)

**Status:** Accepted  
**Date:** 2026-05-16

## Context

`board.json` and card `state.json` are machine-owned and updated during commands that must not leave partial JSON on disk (e.g. crash mid-write, or `nextSequence` incremented without card directory).

Requirements ([§6.2](../devflow-requirements.md#62-card-creation)): write to a temporary file in the same directory, then rename into place.

## Decision

All Devflow writes to `board.json` and `state.json` use **atomic replace**:

```text
1. Write JSON to <target>.tmp.<pid> in the same directory.
2. fsync if available.
3. rename(tmp, target) — atomic on same filesystem.
```

Implement in `infra/atomic-write.ts`; domain and commands call this helper exclusively for JSON state files.

`card.md` and binary attachments may use the same pattern where consistency matters; `card rename` updates `card.md` after `state.json` succeeds.

## Consequences

**Positive**

- Readers never see half-written JSON.
- Aligns with card-create sequence safety ([§6.2](../devflow-requirements.md#62-card-creation)).

**Negative**

- Leftover `.tmp` files possible on crash; validation may warn (optional, not in v1 spec).

## References

- Requirements [§6.2](../devflow-requirements.md#62-card-creation)
- [`architecture.md` §5.7](../architecture.md#57-board--card-stores-srcdomain)
