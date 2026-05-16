import { assertEquals } from "@std/assert";
import { listExitScripts } from "./scripts.ts";
import { initBoard } from "../commands/init-board.ts";
import { withTempGitRepo } from "../../test/helpers/git-repo.ts";

Deno.test("stories template planning scripts discovered (req §9.3)", async () => {
  await withTempGitRepo(async (dir) => {
    await initBoard(
      "stories",
      ["unplanned", "planning", "planned"],
      dir,
      { template: "stories" },
    );
    const scripts = await listExitScripts(dir, "stories", "planning");
    assertEquals(scripts.includes("planning-001-check-git-empty-status"), true);
    assertEquals(scripts.includes("planning-005-check-git-status"), true);
    assertEquals(scripts.includes("planning.commit-message"), false);
  });
});

Deno.test("stories template unplanned scripts discovered (req §9.3)", async () => {
  await withTempGitRepo(async (dir) => {
    await initBoard(
      "stories",
      ["unplanned", "planning", "planned"],
      dir,
      { template: "stories" },
    );
    const scripts = await listExitScripts(dir, "stories", "unplanned");
    assertEquals(scripts.includes("unplanned-001-check-card-exists"), true);
    assertEquals(scripts.includes("unplanned-002-check-git-ready"), true);
  });
});
