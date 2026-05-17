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

- [x] [`docs/devflow-requirements.md`](../../../../../../docs/devflow-requirements.md) — §5.6 Board templates (lookup order, what ships); §5.1 Board creation (`board init --template`); §9.9 Script execution environment (env vars passed to scripts, where `DEVFLOW_CLI` would slot in); §16 CLI surface.
- [x] [`docs/architecture.md`](../../../../../../docs/architecture.md) — §6.3 Nested CLI from scripts; §7 Templates (built-in resolution via `import.meta.url`); §9 Deno runtime.
- [x] [`docs/adr/0001-deno-runtime.md`](../../../../../../docs/adr/0001-deno-runtime.md) — runtime baseline (Deno); JSR is a Deno-native registry, so distribution sits naturally on this ADR. A new ADR is **not** required unless the user wants the JSR choice recorded; default plan is to note distribution in architecture §7 only.
- [x] [`docs/adr/0007-script-invocation.md`](../../../../../../docs/adr/0007-script-invocation.md) — scripts execute under repo root; relevant for `DEVFLOW_CLI` injection.

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

**A. JSR packaging**

- [`deno.json`](../../../../../../deno.json) — add top-level `name`, `version`,
  `exports` (pointing at `./main.ts`), and `publish.include` covering `main.ts`,
  `src/**/*.ts`, `templates/**/*`, `README.md`, `LICENSE` (if present); add
  `publish.exclude` for `*_test.ts`, `.devflow/`, `docs/`.
- Verify with `deno publish --dry-run` (no network).

**B. Template copy of `assets/`**

- [`src/services/templates.ts`](../../../../../../src/services/templates.ts) —
  extend `copyTemplateScriptsAndSkills` (rename to `copyTemplateContents` or
  keep name + add a third copy) to also copy `assets/` when present;
  `templateHasScriptsAndSkills` left as-is (assets optional for backwards
  compatibility with templates that don't ship them).
- [`src/services/templates_test.ts`](../../../../../../src/services/templates_test.ts)
  and [`templates-stories_test.ts`](../../../../../../src/services/templates-stories_test.ts) — add coverage for `assets/` copy and for the
  `stories` template specifically including `story.template.md`.

**C. Generic `templates/stories/` sync**

- [`templates/stories/`](../../../../../../templates/stories/) — rewrite to
  match the current dogfood phase set (`preparing planning building verifying
  finishing done`) and bring across the live `scripts/`, `skills/`, and
  `assets/` from [`.devflow/boards/stories/`](../../../../../../.devflow/boards/stories/),
  removing Devflow-repo-specific paths (e.g. `src/` references, deno-task names
  the consumer may not have). Genericise via the new `skills/lib/` indirection.
- [`templates/stories/board.phaseScripts.json`](../../../../../../templates/stories/board.phaseScripts.json) — align with phase names actually exported.
- Decision recorded in **Notes**: `.devflow/boards/stories/` stays
  Devflow-specific (dogfood); `templates/stories/` is the portable copy. Sync
  is one-shot in this card; ongoing drift is out of scope.

**D. `skills/lib/` lib-skills**

- New `templates/stories/skills/lib/run-tests/SKILL.md`,
  `…/run-ci/SKILL.md`, `…/invoke-devflow/SKILL.md` (final names TBD in
  building) — each documents the generic command shape (`deno task test`,
  `deno task ci`, `$DEVFLOW_CLI …`) so phase skills reference them instead of
  hard-coding Devflow-repo paths.
- Update affected phase skills (`plan-story`, `build-story`, `validate-story`,
  `finish-story`) to cite the lib-skill paths.

**E. Nested CLI from scripts**

- [`src/services/scripts.ts`](../../../../../../src/services/scripts.ts) —
  set `DEVFLOW_CLI` in `buildScriptEnv` to a value that re-invokes the same
  Devflow entry the parent ran from (e.g. `Deno.execPath()` + the current
  module URL/argv pattern; details in building). Local checkouts get
  `./devflow`; JSR installs get the JSR command.
- [`templates/stories/scripts/`](../../../../../../templates/stories/scripts/)
  and any `scripts/lib/*.sh` — replace bare `devflow …` and `./devflow …`
  invocations with `"$DEVFLOW_CLI" …`.
- Documented in `docs/architecture.md` §6.3 (Spec Updates row).

**F. Consumer documentation**

- [`README.md`](../../../../../../README.md) — add a “Using Devflow in another
  repository” section: JSR install command, required `--allow-*` permissions,
  example `board init --template stories`, version pinning guidance, and a
  pointer to the consumer wrapper sketch in this card's **Notes**.

### Risks and constraints

- **JSR namespace not yet allocated.** Publishing requires a JSR scope; this
  card plans the packaging change but actual publish is an operator action.
  Tests rely on `deno publish --dry-run`, which does not require auth.
- **Pinning vs floating versions.** README will recommend exact pins
  (`jsr:@scope/devflow@x.y.z`) for reproducibility; `^x.y.z` only when the
  consumer accepts patch-level drift.
- **Generic template drift.** `templates/stories/` will lag behind the dogfood
  board after this card unless we add a sync check; out of scope here, called
  out in **Notes** as a follow-up candidate.
- **`DEVFLOW_CLI` resolution.** Detecting whether the parent is a local
  checkout vs JSR install needs care (probably inspect
  `devflowPackageRoot()` / `Deno.mainModule`). Wrong value silently breaks
  nested calls; covered by an automated test.
- **Permission scope.** JSR-run Devflow needs at least
  `--allow-read --allow-write --allow-run --allow-env`; README must list these
  explicitly so consumers don't run with `--allow-all`.
- **Backwards compatibility.** Existing dogfood board in this repo must keep
  working after `DEVFLOW_CLI` injection (it already invokes `./devflow`); the
  env var is additive.

## Test Scenarios

<!-- phase-gate: complete by exit planning | executed by exit verifying -->

| # | Type | Scenario | Expected |
| - | ---- | -------- | -------- |
| 1 | automated | `deno task test src/services/templates_test.ts` — extend with a case that creates a temp template dir containing `scripts/`, `skills/`, and `assets/`, then calls `copyTemplateScriptsAndSkills` | All three subtrees copied to the board; existing tests still pass |
| 2 | automated | `deno task test src/services/templates-stories_test.ts` — extend to assert `templates/stories/` ships `scripts/`, `skills/`, `assets/story.template.md`, and `skills/lib/` with at least one lib-skill | Assertions pass against the real `templates/stories/` tree |
| 3 | automated | `deno task test src/services/scripts_test.ts` — assert `buildScriptEnv` sets `DEVFLOW_CLI` to a non-empty value pointing at the current entry; assert child scripts see it | Test passes; value is callable form (string starts with `deno run` or path to `devflow` wrapper) |
| 4 | automated | `deno publish --dry-run` invoked from a test (or `deno task ci`) — list the published file set and assert `templates/stories/scripts/preparing-002-do-create-story` and `templates/stories/assets/story.template.md` are included | Both paths present in the dry-run manifest |
| 5 | automated | `deno task test` (full suite) | All tests pass, including new template/scripts/assets coverage |
| 6 | manual | In a scratch git repo outside this checkout, run the documented JSR command and `devflow board init demo preparing planning building verifying finishing done --template stories`; then `devflow card new demo "smoke"` and `devflow card advance` once | Board directory created with `scripts/`, `skills/`, `assets/`; a card advances at least one phase without missing-template errors |

## Build Tasks

<!-- phase-gate: complete by exit planning | all [x] by exit building -->

1. [ ] Extend `copyTemplateScriptsAndSkills` in `src/services/templates.ts` to copy `assets/` when present; update `src/services/templates_test.ts` with a focused unit test (scope **B**).
2. [ ] Add `DEVFLOW_CLI` to `buildScriptEnv` in `src/services/scripts.ts`, resolving local-checkout vs JSR-install at runtime; add coverage in `src/services/scripts_test.ts` (scope **E**).
3. [ ] Sync `.devflow/boards/stories/scripts/`, `skills/`, and `assets/` into `templates/stories/`, removing Devflow-repo-specific paths and aligning `board.phaseScripts.json` (scope **C**).
4. [ ] Add `templates/stories/skills/lib/` lib-skills (`run-tests`, `run-ci`, `invoke-devflow`) and update phase skills + `building-lib.sh` / `lib/` shell helpers in the template to call them and use `"$DEVFLOW_CLI"` (scopes **C** + **D** + **E**).
5. [ ] Extend `src/services/templates-stories_test.ts` to assert `templates/stories/` ships `assets/story.template.md` and `skills/lib/*` (scope **B**/**C**).
6. [ ] Add JSR metadata to `deno.json` (`name`, `version`, `exports`, `publish.include`, `publish.exclude`) and verify `deno publish --dry-run` includes templates; add an automated test that runs the dry-run and inspects the file list (scope **A**).
7. [ ] Update `README.md` with a “Using Devflow in another repository” section: JSR install/run command, required permissions, `board init --template stories` example, version-pinning advice (scope **F**).
8. [ ] Update `docs/architecture.md` §7 (templates ship via JSR) and §6.3 (`DEVFLOW_CLI` in nested-CLI flow); add a short note to `docs/devflow-requirements.md` §5.6 only if behaviour visibly changes (otherwise mark Spec Updates row n/a in finishing).
9. [ ] `deno task ci` — lint, fmt, full test suite green.

## Spec Updates

<!-- phase-gate: planned by exit planning | completed by exit finishing -->

| Document | Planned change | Status |
| -------- | -------------- | ------ |
| `docs/devflow-requirements.md` | §5.6: optional note that built-in templates ship inside the published Devflow package (JSR-cached on consumer machines) — only if a behavioural detail surfaces; otherwise mark n/a in finishing | pending |
| `docs/architecture.md` | §7 Templates: replace “location TBD” with “shipped inside the JSR-published package; resolved via `import.meta.url` against the cached package root”. §6.3 Nested CLI: document `DEVFLOW_CLI` env var | pending |
| `README.md` | New “Using Devflow in another repository” section covering JSR install/run, required Deno permissions, `board init --template stories` example, and version-pinning guidance | pending |

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

### Planning decisions (2026-05-17)

- **No new ADR for JSR.** Distribution sits under ADR-0001 (Deno runtime); JSR
  is the Deno-native registry. The architectural note in §7 is sufficient. If
  reviewers want the choice formalised, add ADR-0015 in a follow-up card.
- **Dogfood vs portable stories template.** `.devflow/boards/stories/` stays
  Devflow-repo-specific (free to reference `src/`, `deno task`, ADR paths).
  `templates/stories/` is the portable copy and must not contain repo-local
  paths. One-shot sync this card; ongoing drift detection is a follow-up.
- **`DEVFLOW_CLI` is additive.** Existing local-checkout flows that call
  `./devflow` keep working; scripts in the *template* must use
  `"$DEVFLOW_CLI"` instead of `./devflow` so they work under JSR. Scripts in
  the live dogfood board may be migrated opportunistically but it's not a
  blocker for this card.
- **Publish step is operator action.** The card lands the packaging change
  and dry-run verification; actually pushing to JSR happens outside the card
  (it requires JSR scope ownership and auth).
- **AC #6 scope.** Treat template/init/assets-copy tests and the JSR
  dry-run assertion as the “new behaviour covered by automated tests”
  requirement; AC #2 remains a manual end-to-end (covered by Test Scenario #6).

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
