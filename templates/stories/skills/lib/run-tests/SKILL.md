---
name: run-tests
version: 1.0.0
description: >-
  Generic guidance for running tests in a Deno project. Lib-skill referenced by
  phase skills; not invoked directly.
---

# Run Tests

**Purpose:** Run the project's test suite. This is a lib-skill that documents
the generic command; consumer projects must have a `test` task in `deno.json`.

## Command

From the repository root:

```bash
deno task test
```

## Exit codes

- **0** — all tests passed
- **non-zero** — one or more tests failed

## Requirements

Consumer project must define `test` in `deno.json` tasks, for example:

```json
{
  "tasks": {
    "test": "deno test --allow-read --allow-write --allow-run --allow-env"
  }
}
```

## Usage in phase skills

Phase skills that need to verify tests pass should cite this lib-skill and use
the command above. For example:

> 5. **Tests pass** — run `deno task test` from repo root (lib-skill:
>    `skills/lib/run-tests`); do not mark a test-related task `[x]` until tests
>    pass.
