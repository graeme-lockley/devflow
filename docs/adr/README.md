# Architecture Decision Records (ADR)

Records of significant implementation choices for Devflow. Behavioural
requirements remain authoritative in
[`../devflow-requirements.md`](../devflow-requirements.md).

| ADR                                               | Title                                            | Status   |
| ------------------------------------------------- | ------------------------------------------------ | -------- |
| [0001](./0001-deno-runtime.md)                    | Deno as the sole runtime                         | Accepted |
| [0002](./0002-filesystem-durability.md)           | Filesystem as the primary store                  | Accepted |
| [0003](./0003-git-root-workspace.md)              | Git repository root as workspace                 | Accepted |
| [0004](./0004-layered-module-structure.md)        | Layered CLI module structure                     | Accepted |
| [0005](./0005-atomic-json-writes.md)              | Atomic JSON writes (temp + rename)               | Accepted |
| [0006](./0006-directory-locks.md)                 | Directory-based locks via `mkdir`                | Accepted |
| [0007](./0007-script-invocation.md)               | Direct script execution with shebang             | Accepted |
| [0008](./0008-transition-runner-orchestration.md) | Dedicated transition runner service              | Accepted |
| [0009](./0009-git-commit-boundary.md)             | Git commits only on successful advance hops      | Accepted |
| [0010](./0010-signal-forwarding.md)               | Signal forwarding to child scripts               | Accepted |
| [0011](./0011-console-output-levels.md)           | Three console output levels                      | Accepted |
| [0012](./0012-inline-validation.md)               | Inline validation without JSON Schema            | Accepted |
| [0013](./0013-cli-command-duality.md)             | Object-first commands with verb-command synonyms | Accepted |
| [0014](./0014-script-composition-and-loops.md)    | Script composition and phase loops               | Accepted |

## Format

Each ADR uses:

- **Status** — Proposed | Accepted | Superseded
- **Context** — Problem and constraints
- **Decision** — What we chose
- **Consequences** — Trade-offs
- **References** — Requirements sections

## When to add an ADR

Add a new ADR when a choice is hard to reverse, affects multiple modules, or is
not fully specified in the requirements document. Do not duplicate requirement
text; link to it.
