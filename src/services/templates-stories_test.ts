import { assertEquals } from "@std/assert";
import { listExitScripts } from "./scripts.ts";
import { initBoard } from "../commands/init-board.ts";
import { withTempGitRepo } from "../../test/helpers/git-repo.ts";

Deno.test("stories template planning scripts discovered (req §9.3)", async () => {
  await withTempGitRepo(async (dir) => {
    await initBoard(
      "stories",
      ["preparing", "planning", "building", "verifying", "finishing", "done"],
      dir,
      { template: "stories" },
    );
    const scripts = await listExitScripts(dir, "stories", "planning");
    assertEquals(scripts.includes("planning-001-check-git-clean"), true);
    assertEquals(scripts.includes("planning-002-check-card-structure"), true);
    assertEquals(scripts.includes("planning.commit-message"), false);
  });
});

Deno.test("stories template preparing scripts discovered (req §9.3)", async () => {
  await withTempGitRepo(async (dir) => {
    await initBoard(
      "stories",
      ["preparing", "planning", "building", "verifying", "finishing", "done"],
      dir,
      { template: "stories" },
    );
    const scripts = await listExitScripts(dir, "stories", "preparing");
    assertEquals(scripts.includes("preparing-001-check-git-clean"), true);
    assertEquals(scripts.includes("preparing-002-do-create-story"), true);
  });
});

Deno.test("stories template ships assets and lib-skills", async () => {
  await withTempGitRepo(async (dir) => {
    await initBoard(
      "stories",
      ["preparing", "planning", "building", "verifying", "finishing", "done"],
      dir,
      { template: "stories" },
    );

    // Assert assets/story.template.md exists
    const assetPath = `${dir}/.devflow/boards/stories/assets/story.template.md`;
    const assetContent = await Deno.readTextFile(assetPath);
    assertEquals(assetContent.length > 0, true);

    // Assert lib-skills exist
    await Deno.stat(
      `${dir}/.devflow/boards/stories/skills/lib/run-tests/SKILL.md`,
    );
    await Deno.stat(
      `${dir}/.devflow/boards/stories/skills/lib/run-ci/SKILL.md`,
    );
    await Deno.stat(
      `${dir}/.devflow/boards/stories/skills/lib/invoke-devflow/SKILL.md`,
    );
  });
});
