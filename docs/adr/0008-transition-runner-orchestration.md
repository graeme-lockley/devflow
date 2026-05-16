# ADR-0008: Dedicated transition runner service

**Status:** Accepted\
**Date:** 2026-05-16

## Context

`card advance` is the most complex command: multi-phase hops, script sequencing,
logging, state updates, Git commits, locks, and failure handling. Putting this
logic in `commands/card-advance.ts` would be unmaintainable.

Requirements define the algorithm explicitly
([§11.4](../devflow-requirements.md#114-transition-algorithm)).

## Decision

Implement a **`services/transition.ts`** module that:

- Accepts resolved board, card, target phase, and options (`force`, log level).
- Computes the list of single-phase hops.
- For each hop, calls script service → (M6) commit-message → domain state update
  → (M6) git service.
- Returns structured failure (script name, log path) for the command layer to
  print.
- (ADR-0014) Orchestrates loop blocks when configured for a phase: runs loop
  steps with round counter, restarts on failure, fails transition when max
  rounds exhausted.

The `card-advance` command handler only: validates preconditions (blocked,
backward phase), acquires locks, calls `transition.runAdvance`, releases locks.

## Consequences

**Positive**

- Algorithm is unit-testable with mock script and git services.
- [`implementation-roadmap.md`](../implementation-roadmap.md) can land M5 (no
  git) before M6.

**Negative**

- Service interface must stay stable as Git integration lands.

## References

- Requirements [§11](../devflow-requirements.md#11-transition-model)
- [`architecture.md` §5.3](../architecture.md#53-transition-runner-srcservicestransitionts)
- [ADR-0014](./0014-script-composition-and-loops.md) — loop block orchestration
