# Remote Runnable

As a developer using Devflow across multiple repositories and machines, I want
to install and run Devflow remotely (without cloning the Devflow repo into each
consumer project) so that I can initialise boards from bundled templates and
run the full CLI workflow from any git repo with only Deno installed.

## Current State

<!-- phase-gate: complete by exit preparing -->

- Devflow today is run from a **local checkout** via [`devflow`](../../../../../devflow)
  (`deno run … main.ts`). Built-in templates resolve from the package tree at
  `templates/<name>/` via `devflowPackageRoot()` (`import.meta.url` in
  [`src/infra/package-root.ts`](../../../../../src/infra/package-root.ts)).
- [`src/services/templates.ts`](../../../../../src/services/templates.ts) copies
  only `scripts/` and `skills/` on `board init --template`; it does **not** copy
  `assets/` (e.g. `story.template.md`). The live stories board under
  `.devflow/boards/stories/` is ahead of [`templates/stories/`](../../../../../templates/stories/)
  (extra phases: preparing, verifying, finishing; more scripts/skills/assets).
- **Remote `deno run` of `main.ts` alone is insufficient for templates:** Deno
  caches the module import graph only; `templates/` is read via filesystem APIs
  and is not pulled automatically when invoking a raw GitHub URL.
- **Rejected approaches (discussion):**
  - **Submodule / per-repo clone of Devflow** — works but adds clutter the
    operator does not want in consumer repos.
  - **Repo-local templates only** (`.devflow/templates/`) — avoids packaging
    problem but duplicates template content in every project.
  - **Thin wrapper + `ROOT=https://raw.githubusercontent.com/…/main.ts` +
    GitHub API template fetch** — feasible but needs custom list/copy logic,
    `--allow-net`, rate limits, and ongoing maintenance; not chosen.
- **Chosen approach (decision): Option B — publish Devflow to [JSR](https://jsr.io/)**
  with `templates/**` included in the published artifact so
  `import.meta.url` resolves to a cached package root that contains templates
  on disk (existing copy logic can remain filesystem-based).

### Two roots (unchanged mental model)

| Root | Role |
| ---- | ---- |
| **Consumer git repo** | Where the operator `cd`s; `.devflow/boards/` lives here |
| **Devflow package** | CLI + built-in templates (local checkout, JSR cache after install) |

## Objectives

<!-- phase-gate: complete by exit preparing -->

1. **JSR package** — Publish Devflow to JSR with `main.ts` exported and
   `publish.include` covering `src/`, `main.ts`, and `templates/**/*` so
   `board init --template stories` works from a JSR install without a Devflow
   clone.
2. **Consumer setup documentation** — Update [`README.md`](../../../../../README.md)
   with how to run Devflow in a remote consumer repo (e.g. `deno run` /
   `deno install` from JSR, required permissions, example `board init`, pin
   versions). Document that consumer repos need git; Devflow is not installed
   *into* the repo except `.devflow/` board state.
3. **Generic stories template** — Sync current stories board
   `scripts/`, `skills/`, and `assets/` into `templates/stories/`, make paths
   and copy generic (not Devflow-repo-specific where possible), extend template
   copy to include `assets/`, and introduce **`skills/lib/`** lib-skills to
   externalise testing/CI/devflow-invocation guidance used by phase skills and
   thin exit scripts.
4. **Nested CLI from scripts** — Scripts that call `devflow` (e.g.
   `finishing-005-check-tests`) must work when the CLI is JSR-backed, not only
   `./devflow` in the consumer repo (e.g. `DEVFLOW_CLI` env set by the harness
   or documented wrapper).

## Spec References

<!-- phase-gate: draft by exit preparing | complete by exit planning -->

_Specification and architecture pointers. Use paths and section anchors._

- [ ] `docs/devflow-requirements.md` — §5.6 (board templates), §16 (CLI); may
      need a short note on JSR distribution if behaviour is unchanged
- [ ] `docs/architecture.md` — §7 (templates), §9 (Deno runtime)
- [ ] `docs/adr/` — consider ADR for JSR as distribution channel (if rationale
      beyond ADR-0001 is needed); N/A until planning

## Acceptance Criteria

<!-- phase-gate: draft by exit preparing | complete by exit planning | all [x] by exit verifying -->

1. [ ] `deno.json` defines a JSR package (`name`, `version`, `exports`, `publish.include`
       with `templates/**/*`) and `deno publish --dry-run` (or publish docs) shows
       templates in the artifact.
2. [ ] From a clean consumer repo (no Devflow clone), an operator can run Devflow
       via JSR (documented command) and successfully
       `devflow board init <board> preparing planning building verifying finishing done --template stories`
       with `scripts/`, `skills/`, and `assets/` present on the new board.
3. [ ] [`README.md`](../../../../../README.md) documents remote/consumer setup
       (install/run, permissions, init example, version pinning).
4. [ ] `templates/stories/` matches the current stories workflow (phases, loop
       config, preparing/finishing/verifying scripts) and uses generic doc paths
       in `assets/story.template.md` and skills where appropriate.
5. [ ] `skills/lib/` exists with lib-skills for shared concerns (e.g. run tests,
       run CI, invoke Devflow CLI); phase skills reference them.
6. [ ] `deno task test` passes; template/init tests cover assets copy if
       implemented.

## Impact Analysis

<!-- phase-gate: complete by exit planning -->

### Scope

_To be completed in planning._

**Expected touchpoints (preliminary):**

- `deno.json` — JSR metadata and `publish.include` / `publish.exclude`
- `src/services/templates.ts` — copy `assets/` (and tests)
- `src/services/scripts.ts` — optional `DEVFLOW_CLI` in script env
- `templates/stories/**` — full sync from `.devflow/boards/stories/`, genericise,
  add `skills/lib/`
- `README.md` — consumer / remote setup section
- `devflow` wrapper — may remain local-dev oriented; README points consumers to JSR

### Risks and constraints

_To be completed in planning._

- JSR scope/name must be chosen and package published (operator action outside
  repo CI unless automated).
- Pinning (`@^0.1.0` vs exact) affects reproducibility across machines.
- Generic template must not break this repo's dogfood board unless intentionally
  updated; clarify whether `.devflow/boards/stories/` stays Devflow-specific
  while `templates/stories/` is portable.

## Test Scenarios

<!-- phase-gate: complete by exit planning | executed by exit verifying -->

| # | Type | Scenario | Expected |
| - | ---- | -------- | -------- |
| 1 | automated | `initBoard` with `--template stories` in temp dir | `assets/story.template.md`, key scripts, and `skills/lib/` exist on board |
| 2 | automated | `resolveTemplateDir("stories")` when package root is local | Returns `…/templates/stories` |
| 3 | manual | Fresh consumer repo; run Devflow via JSR per README; `board init --template stories` | Board created; advance smoke test optional |

_To be expanded in planning._

## Build Tasks

<!-- phase-gate: complete by exit planning | all [x] by exit building -->

1. [ ] Add JSR package config to `deno.json` and verify publish manifest includes templates
2. [ ] Publish to JSR (or document publish steps) and pin version in README examples
3. [ ] Extend `copyTemplateScriptsAndSkills` (or rename) to copy `assets/`
4. [ ] Sync `.devflow/boards/stories/` → `templates/stories/`; genericise template + `board.phaseScripts.json`
5. [ ] Add `skills/lib/*`; update phase skills and script helpers (`board-lib.sh` or equivalent)
6. [ ] Set `DEVFLOW_CLI` in script environment; update scripts that invoke nested `devflow`
7. [ ] README: “Using Devflow in another repository” (JSR install, permissions, init)
8. [ ] Tests and `deno task ci`

## Spec Updates

<!-- phase-gate: planned by exit planning | completed by exit finishing -->

| Document | Planned change | Status |
| -------- | -------------- | ------ |
| `docs/devflow-requirements.md` | §5.6 note on built-in templates via JSR if needed | pending |
| `docs/architecture.md` | §7 template shipping path (JSR); optional §9 | pending |
| `README.md` | Remote consumer setup section | pending |

## Notes

<!-- phase-gate: optional; ongoing across phases -->

### Decision: Option B — JSR (2026-05-17)

**Use JSR as the distribution channel** for Devflow CLI + bundled templates.

Rationale:

- Consumer projects stay uncluttered (no Devflow submodule).
- Published tarball can include non-module assets (`templates/`) via
  `publish.include`.
- After `deno install` / `deno run jsr:…`, `import.meta.url` points at a local
  cache directory; existing `devflowPackageRoot()` + filesystem template copy
  continue to work with minimal code change.
- Preferable to maintaining GitHub Contents API fetch logic for a raw-URL wrapper.

**Consumer wrapper sketch (documentation only, not implemented here):**

```bash
#!/usr/bin/env bash
exec deno run \
  --allow-read --allow-write --allow-run --allow-env \
  jsr:@<scope>/devflow@<version> "$@"
```

### Discussion summary (strategy)

| Approach | Verdict |
| -------- | ------- |
| Local clone + `./devflow` | Works today; not desired for multi-repo use |
| Raw GitHub URL + `deno run main.ts` | CLI OK; templates **not** on disk without extra fetch |
| GitHub API template download | Feasible; rejected in favour of JSR |
| Repo-local `.devflow/templates/` | Feasible; rejected (clutter) |
| **JSR with `templates/**` in publish** | **Selected** |

### Implementation deferred

Card captures intent only; **no implementation in this pass.** Implement in a
later phase per Build Tasks.

## Build Notes

<!-- phase-gate: started by exit building | complete by exit finishing -->

_To be completed in building._

## Related Cards

<!-- phase-gate: complete or explicit none by exit preparing -->

- Related to template/board evolution in stories-000003 (script composition);
  distribution is new scope.

## Attachments

<!-- phase-gate: optional preparing–building | evidence by exit verifying when cited in ACs -->

_None._
