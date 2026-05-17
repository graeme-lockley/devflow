---
name: invoke-devflow
version: 1.0.0
description: >-
  Generic guidance for invoking the Devflow CLI from scripts. Lib-skill
  referenced by phase skills and scripts; not invoked directly.
---

# Invoke Devflow

**Purpose:** Call the Devflow CLI from within scripts. This lib-skill documents
the portable approach that works for both local checkouts and JSR installs.

## Command

From any script that has access to `DEVFLOW_CLI` environment variable:

```bash
"$DEVFLOW_CLI" <command> [args...]
```

For example:

```bash
"$DEVFLOW_CLI" validate-card "$card_id"
"$DEVFLOW_CLI" card list stories --phase building
```

## Environment variable

`DEVFLOW_CLI` is set by the Devflow harness when invoking exit scripts. It
resolves to:

- `./devflow` — when a local wrapper exists in the repository root
- `deno run --allow-read --allow-write --allow-run --allow-env <module>` — for
  JSR-installed or raw module invocations

Scripts **must not** hardcode `./devflow` or construct `deno run` commands
themselves; always use `"$DEVFLOW_CLI"`.

## Usage in scripts

Exit scripts and child scripts should use `"$DEVFLOW_CLI"` for nested Devflow
calls:

```bash
#!/usr/bin/env bash
set -euo pipefail

card_id="${2:?card id required}"
repo_root="${DEVFLOW_REPO_ROOT:?}"
cli="${DEVFLOW_CLI:?DEVFLOW_CLI not set}"

cd "$repo_root"

echo "Validating card ${card_id}..." >&2
if ! "$cli" validate-card "$card_id" 2>&1 | tee validation.log; then
  echo "Validation failed" >&2
  exit 1
fi
```

## Usage in phase skills

Phase skills that describe script behaviour should cite this lib-skill when
documenting nested CLI calls:

> 4. **Nested CLI** — scripts that call `devflow` must use `"$DEVFLOW_CLI"`
>    (lib-skill: `skills/lib/invoke-devflow`); supports both local checkouts and
>    JSR installs.
