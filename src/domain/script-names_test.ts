import { assertEquals } from "@std/assert";
import {
  exitScriptSequenceNumber,
  isCommitMessageScript,
  matchesExitScript,
  partitionLoopRootScripts,
  sortExitScriptNames,
} from "./script-names.ts";

Deno.test("matchesExitScript (req §9.3)", () => {
  const phase = "planning";
  assertEquals(
    matchesExitScript("planning-001-check-git-empty-status", phase),
    true,
  );
  assertEquals(
    matchesExitScript("planning-002-check-card-structure", phase),
    true,
  );
  assertEquals(matchesExitScript("planning.commit-message", phase), false);
  assertEquals(matchesExitScript("planning-backup-001-foo", phase), false);
  assertEquals(matchesExitScript("README", phase), false);
});

Deno.test("isCommitMessageScript (req §9.3, §13)", () => {
  assertEquals(
    isCommitMessageScript("planning.commit-message", "planning"),
    true,
  );
  assertEquals(
    isCommitMessageScript("planning-001-check-git-empty-status", "planning"),
    false,
  );
});

Deno.test("sortExitScriptNames lexical order", () => {
  assertEquals(
    sortExitScriptNames([
      "planning-010-z",
      "planning-002-b",
      "planning-001-a",
    ]),
    ["planning-001-a", "planning-002-b", "planning-010-z"],
  );
});

Deno.test("partitionLoopRootScripts entry and exit bands (req §9.11.3)", () => {
  const names = [
    "building-001-check-entry",
    "building-003-check-building-quality",
    "building-005-check-spec-updates",
    "building-007-check-git-scope",
  ];
  const { entry, exit } = partitionLoopRootScripts(names, "building");
  assertEquals(entry, ["building-001-check-entry"]);
  assertEquals(exit, [
    "building-003-check-building-quality",
    "building-005-check-spec-updates",
    "building-007-check-git-scope",
  ]);
});

Deno.test("exitScriptSequenceNumber parses phase-NNN prefix", () => {
  assertEquals(
    exitScriptSequenceNumber("building-003-check-exit", "building"),
    3,
  );
  assertEquals(
    exitScriptSequenceNumber("planning.commit-message", "planning"),
    null,
  );
});

Deno.test("matchesExitScript accepts hierarchical child naming", () => {
  // Child scripts like `building-002-01-pi` match the root exit pattern
  // (hyphenated extension of NNN). Discovery logic (scripts service) filters
  // by directory location to distinguish root (scripts/) from child
  // (scripts/building/ or invoked by parent only).
  assertEquals(matchesExitScript("building-002-01-pi", "building"), true);
  assertEquals(matchesExitScript("building-002-02-gate-ci", "building"), true);
});
