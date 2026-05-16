# ADR-0001: Deno as the sole runtime

**Status:** Accepted\
**Date:** 2026-05-16

## Context

Devflow is a CLI tool that orchestrates shell scripts, filesystem state, and
Git. We need a runtime that is easy to install, supports TypeScript without a
separate build step, and provides built-in testing.

Alternatives considered: Node.js (requires bundling or ts-node), Rust (higher
implementation cost for a script-orchestration tool), Go (similar).

## Decision

Implement Devflow in **Deno** with:

- Entry point `main.ts` invoked via `./devflow` (`deno run …`).
- `@std/assert` and `deno test` for tests.
- `Deno.Command` for subprocess invocation (Git and board scripts).

## Consequences

**Positive**

- Single toolchain: format, test, run without npm.
- TypeScript-first matches agent-friendly codebase goals.
- Permissions are explicit (`--allow-read`, `--allow-write`, `--allow-run`).

**Negative**

- Operators must install Deno (document in README).
- Script execution requires `--allow-run` (and typically `--allow-env` for
  `DEVFLOW_*` propagation).

## References

- [`architecture.md` §9](../architecture.md#9-deno-runtime)
- Repository: `deno.json`, `main.ts`, `devflow` wrapper
