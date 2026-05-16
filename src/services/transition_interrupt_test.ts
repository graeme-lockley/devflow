import { assertEquals } from "@std/assert";
import { initBoard } from "../commands/init-board.ts";
import { createCard } from "../commands/create-card.ts";
import { loadBoardConfig } from "../domain/board.ts";
import { loadCardState } from "../domain/card.ts";
import { createTransitionRun } from "./transition-logs.ts";
import { runInterruptCleanupForTest } from "./signals.ts";
import {
  clearInFlightHop,
  recordInterruptFailure,
  setInFlightHopForTest,
} from "./transition.ts";

Deno.test("recordInterruptFailure appends history (req §14.5)", async () => {
  const dir = await Deno.makeTempDir();
  await initBoard("test", ["a", "b"], dir);
  const cardId = await createCard("test", "Card", dir);
  const board = await loadBoardConfig(dir, "test");
  const state = await loadCardState(dir, "test", cardId);

  const run = await createTransitionRun(dir, "test", cardId, "a", "b");

  setInFlightHopForTest({
    repoRoot: dir,
    board,
    state,
    hop: { from: "a", to: "b" },
    run,
    script: "a-001-sleep",
  });

  await recordInterruptFailure("SIGTERM");
  clearInFlightHop();

  const updated = await loadCardState(dir, "test", cardId);
  const failed = updated.history.filter((e) =>
    typeof e === "object" && e !== null && "type" in e &&
    e.type === "transitionFailed"
  );
  assertEquals(failed.length, 1);
  assertEquals(updated.phase, "a");
});

Deno.test("runInterruptCleanupForTest completes without throw", async () => {
  await runInterruptCleanupForTest("SIGINT");
});
