# ADR-0010: Signal forwarding to child scripts

**Status:** Accepted  
**Date:** 2026-05-16

## Context

Transitions can run long-running scripts (e.g. LLM calls via `pi-mono`). Operators may interrupt with Ctrl+C. Devflow must not leave locks or orphan processes.

Requirements ([§14.5](../devflow-requirements.md#145-lock-cleanup-and-signals)): catch SIGINT, SIGTERM, SIGHUP; forward to child; wait briefly; force terminate if needed; release locks; exit non-zero.

## Decision

Register signal handlers **once per Devflow process** when the first script subprocess starts during a command:

1. Forward the signal to the active child process group (if any).
2. Wait up to a short bounded timeout (e.g. 5s) for child exit.
3. Kill child if still running.
4. Release all locks held by this process.
5. Append interrupted/failure event to card history when safe.
6. Exit non-zero.

Only one child script runs at a time per transition ([§9.8](../devflow-requirements.md#98-execution-unit-and-retries)), simplifying handler state.

## Consequences

**Positive**

- No stale `.lock/` after interrupt in the common case.
- Child scripts can handle SIGINT for cleanup.

**Negative**

- Kill-after-timeout may leave partial script side effects (acceptable; same as script failure).
- Signal handling differs slightly across OS; test on macOS and Linux.

## References

- Requirements [§14.5](../devflow-requirements.md#145-lock-cleanup-and-signals)
- [`architecture.md` §5.4](../architecture.md#54-script-service-srcservicesscriptsts)
