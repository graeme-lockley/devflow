import { assertEquals } from "@std/assert";
import { countCommits, withTempGitRepo } from "../../test/helpers/git-repo.ts";
import { initBoard } from "./init-board.ts";
import { createCard } from "./create-card.ts";
import { advanceCard } from "./card-advance.ts";
import { blockCard } from "./block-card.ts";
import { unblockCard } from "./unblock-card.ts";
import { loadCardState } from "../domain/card.ts";
import { validateCommand } from "./validate-cmd.ts";

const STORY_PHASES = [
  "unplanned",
  "planning",
  "planned",
  "building",
  "built",
  "verifying",
  "verified",
  "finishing",
  "finished",
];

async function gitCommitAll(repoRoot: string, message: string): Promise<void> {
  const add = await new Deno.Command("git", {
    args: ["add", "-A"],
    cwd: repoRoot,
    stdout: "null",
    stderr: "piped",
  }).output();
  if (add.code !== 0) throw new Error("git add failed");
  const commit = await new Deno.Command("git", {
    args: ["commit", "-m", message],
    cwd: repoRoot,
    stdout: "null",
    stderr: "piped",
  }).output();
  if (commit.code !== 0) throw new Error("git commit failed");
}

Deno.test("stories workflow unplanned to planned (req §19)", async () => {
  const prevSkip = Deno.env.get("DEVFLOW_SKIP_PI");
  Deno.env.set("DEVFLOW_SKIP_PI", "1");
  try {
    await withTempGitRepo(async (dir) => {
      await initBoard("stories", STORY_PHASES, dir, { template: "stories" });
      await gitCommitAll(dir, "chore: init stories board");

      const cardId = await createCard(
        "stories",
        "Beneficiary Add validation",
        dir,
      );
      assertEquals(cardId, "stories-000001");
      await gitCommitAll(dir, "feat: create card Beneficiary Add");

      const beforeCommits = await countCommits(dir);
      const advance = await advanceCard(cardId, "planned", dir);
      assertEquals(advance.exitCode, 0);

      const state = await loadCardState(dir, "stories", cardId);
      assertEquals(state.phase, "planned");

      const hops = STORY_PHASES.indexOf("planned") -
        STORY_PHASES.indexOf("unplanned");
      assertEquals(await countCommits(dir), beforeCommits + hops);

      await blockCard(cardId, "Waiting for API contract", dir);
      const blockedState = await loadCardState(dir, "stories", cardId);
      assertEquals(blockedState.phase, "blocked");
      await unblockCard(cardId, dir);
      const unblockedState = await loadCardState(dir, "stories", cardId);
      assertEquals(unblockedState.phase, "planned");

      assertEquals(await validateCommand(dir), 0);
    });
  } finally {
    if (prevSkip === undefined) {
      Deno.env.delete("DEVFLOW_SKIP_PI");
    } else {
      Deno.env.set("DEVFLOW_SKIP_PI", prevSkip);
    }
  }
});
