# ADR-0007: Direct script execution with shebang

**Status:** Accepted\
**Date:** 2026-05-16

## Context

Board scripts are shell (or other) executables with shebang lines. They must run
with cwd at the repository root and receive `board-name` and `card-id` as
arguments.

Requirements
([§9.9](../devflow-requirements.md#99-script-execution-environment)): execute
the script file directly so the shebang is honoured (e.g. execve on the script
path after verifying executable).

## Decision

The script service will:

1. Verify the file exists and is executable (`mode & 0o111` or platform
   equivalent).
2. Invoke via `Deno.Command` with **script path as the executable** (not
   `bash script.sh`), so the kernel interprets the shebang.
3. Set `cwd` to the Git repository root.
4. Pass positional args: `<board-name> <card-id>`.
5. Inject all `DEVFLOW_*` environment variables
   ([§18](../devflow-requirements.md#18-environment-variables-for-scripts)).

Do **not** impose Devflow-level script timeouts
([§9.9](../devflow-requirements.md#99-script-execution-environment)).

## Consequences

**Positive**

- Scripts control their own interpreter (`#!/usr/bin/env bash`, etc.).
- Matches operator mental model (scripts are first-class executables).

**Negative**

- Requires `--allow-run` and executable bit on scripts.
- Windows support is non-goal unless shebang + WSL.

## References

- Requirements [§9.4](../devflow-requirements.md#94-script-arguments),
  [§9.9](../devflow-requirements.md#99-script-execution-environment)
- [`architecture.md` §5.4](../architecture.md#54-script-service-srcservicesscriptsts)
- [ADR-0015](./0015-script-flow-control.md) — script flow driver (root exit
  scripts)
- [ADR-0014](./0014-script-composition-and-loops.md) — legacy loop child scripts
  (deprecated): `DEVFLOW_SCRIPT_PARENT`, `DEVFLOW_SCRIPT_ROUND`,
  `DEVFLOW_LOOP_MAX`
