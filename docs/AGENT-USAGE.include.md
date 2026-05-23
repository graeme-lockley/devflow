## Devflow

When working on Devflow cards in this repository, follow
[`docs/AGENT-USAGE.md`](docs/AGENT-USAGE.md) (or the copy vendored from the
Devflow package at the version you pin).

- Run `./devflow` (or documented wrapper) from the **repository root**.
- **Do not** edit `.devflow/**/cards/**/state.json` or `logs/` directly.
- Use `devflow card dir`, `card show`, `variable get` / `set`, and
  `card advance` for workflow state.
- **Do not** `git commit` to simulate a phase hop; Devflow commits on successful
  `card advance`.
- Advance **one card at a time** per repository.
- On transition failure, read `logs/`, fix, then advance again; do not
  auto-retry in a loop.
