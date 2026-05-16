import { assertEquals } from "@std/assert";
import { DEVFLOW_GITIGNORE_PATTERNS } from "../infra/gitignore.ts";
import { validateCommand } from "./validate-cmd.ts";
import { initBoard } from "./init-board.ts";
import { createCard } from "./create-card.ts";
import { withTempGitRepo } from "../../test/helpers/git-repo.ts";

async function setupRepo(dir: string): Promise<void> {
  const patterns = DEVFLOW_GITIGNORE_PATTERNS.join("\n") + "\n";
  await Deno.writeTextFile(`${dir}/.gitignore`, patterns);
  await initBoard("stories", ["unplanned", "planning", "planned"], dir);
}

Deno.test("validateCommand exits 0 for healthy repo (req §17)", async () => {
  await withTempGitRepo(async (dir) => {
    await setupRepo(dir);
    await createCard("stories", "Test card", dir);
    assertEquals(await validateCommand(dir), 0);
  });
});

Deno.test("validateCommand exits non-zero when board.json invalid", async () => {
  await withTempGitRepo(async (dir) => {
    await setupRepo(dir);
    await Deno.writeTextFile(
      `${dir}/.devflow/boards/stories/board.json`,
      "{ not json",
    );
    assertEquals(await validateCommand(dir), 1);
  });
});
