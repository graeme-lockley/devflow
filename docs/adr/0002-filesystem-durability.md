# ADR-0002: Filesystem as the primary store

**Status:** Accepted\
**Date:** 2026-05-16

## Context

Devflow manages boards, cards, scripts, skills, logs, and attachments. The
product must be auditable, Git-backed, and directly editable by humans and
agents.

Alternatives considered: SQLite or embedded DB (opaque to agents), cloud API
(out of scope).

## Decision

Use the **filesystem under `.devflow/`** as the only durable store:

- `board.json` for board configuration.
- Per-card `state.json`, `card.md`, `files/`, `logs/`.
- Board-local `scripts/` and `skills/`.

No database, cache, or secondary index. Devflow reads and writes these paths on
every command.

## Consequences

**Positive**

- Agents can open card directories directly (`devflow card dir`).
- All state is versioned with Git like any other project file.
- Backup and inspection use standard tools.

**Negative**

- No query engine beyond listing directories.
- Concurrent writers outside Devflow during transitions are undefined
  ([§9.10](../devflow-requirements.md#910-concurrent-edits-during-transitions)).

## References

- Requirements [§3 principle 3](../devflow-requirements.md#3-design-principles),
  [§4](../devflow-requirements.md#4-filesystem-layout)
- [`architecture.md` §1](../architecture.md#1-system-context)
