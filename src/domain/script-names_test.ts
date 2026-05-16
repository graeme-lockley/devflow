import { assertEquals } from "@std/assert";
import {
  isCommitMessageScript,
  matchesExitScript,
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
