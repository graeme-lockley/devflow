# ADR-0012: Inline validation without JSON Schema

**Status:** Accepted  
**Date:** 2026-05-16

## Context

`board.json` and `state.json` have documented shapes in the requirements ([§5.4](../devflow-requirements.md#54-board-configuration-file), [§6.4](../devflow-requirements.md#64-card-state-file)). `devflow validate` must check dozens of rules ([§17](../devflow-requirements.md#17-validation-requirements)).

Options: JSON Schema + validator library, runtime types (Zod), or hand-written checks in TypeScript.

## Decision

Validate with **inline TypeScript functions** in `domain/` that mirror requirement checklists:

- Parse JSON with `JSON.parse`; catch syntax errors.
- Type guards for required fields and types.
- Regex checks for identifiers and phase names.
- Consistency rules (blocked metadata, history shape, sequence width).

Do **not** introduce JSON Schema or Zod in the initial implementation.

## Consequences

**Positive**

- No extra dependencies; Deno.lock stays small.
- Validation errors can cite requirement concepts in messages.
- Tests can call validators directly.

**Negative**

- Schema drift if requirements change without updating validators (mitigate: tests per §17 bullet).
- Duplication between TypeScript interfaces and validation logic (keep interfaces next to validators).

## References

- Requirements [§17](../devflow-requirements.md#17-validation-requirements)
- [`implementation-roadmap.md` M1, M2, M7](../implementation-roadmap.md)
