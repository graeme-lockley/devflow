---
name: run-ci
version: 1.0.0
description: >-
  Generic guidance for running CI checks (lint, fmt check, tests) in a Deno
  project. Lib-skill referenced by phase skills; not invoked directly.
---

# Run CI

**Purpose:** Run continuous integration checks — lint, format check, and tests.
This is a lib-skill that documents the generic command; consumer projects must
define a `ci` task in `deno.json`.

## Command

From the repository root:

```bash
deno task ci
```

## Exit codes

- **0** — all CI checks passed (lint, fmt, tests)
- **non-zero** — one or more checks failed

## Requirements

Consumer project must define `ci` in `deno.json` tasks, for example:

```json
{
  "tasks": {
    "lint": "deno lint --ignore=.devflow",
    "fmt:check": "deno fmt --check --ignore=.devflow",
    "test": "deno test --allow-read --allow-write --allow-run --allow-env",
    "ci": "deno task lint && deno task fmt:check && deno task test"
  }
}
```

## Usage in phase skills and scripts

Phase skills and build loop gate scripts that need to verify CI passes should
cite this lib-skill and use the command above. For example in a gate script:

```bash
if ! deno task ci >"${run_dir}/ci.log" 2>&1; then
  echo "gate-ci: CI failed; see ${run_dir}/ci.log" >&2
  exit 1
fi
```
