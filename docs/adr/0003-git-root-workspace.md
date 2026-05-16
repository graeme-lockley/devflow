# ADR-0003: Git repository root as workspace

**Status:** Accepted\
**Date:** 2026-05-16

## Context

Devflow boards live in `.devflow/` at the repository root. Scripts run with cwd
at the repo root and may modify files anywhere in the tree. Commands may be
invoked from subdirectories.

Requirements ([§4.3](../devflow-requirements.md#43-repository-workspace)):
resolve the Git work tree root and treat it as the working directory before any
operation.

## Decision

On every CLI invocation:

1. Resolve the Git repository root (e.g. `git rev-parse --show-toplevel` or walk
   upward for `.git`).
2. Fail fast if not inside a Git work tree (for commands that need it).
3. Perform all path operations relative to that root.

**Implementation choice:** `Deno.chdir(repoRoot)` once at the start of `runCli`,
then use relative paths from infra helpers. Alternative (passing `root` into
every function) is acceptable if tests need isolation without chdir.

## Consequences

**Positive**

- Matches script cwd semantics
  ([§9.9](../devflow-requirements.md#99-script-execution-environment)).
- `git add -A` behaviour is predictable
  ([§13.6](../devflow-requirements.md#136-staging-scope)).

**Negative**

- Tests must chdir to a temp repo or pass root explicitly.
- `board init` requires an existing Git repo; Devflow does not run `git init`.

## References

- Requirements [§4.3](../devflow-requirements.md#43-repository-workspace),
  [§13.1](../devflow-requirements.md#131-git-repository)
- [`architecture.md` §4](../architecture.md#4-request-lifecycle)
