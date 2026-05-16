import { assertEquals } from "@std/assert";
import { initBoard } from "../commands/init-board.ts";
import { acquireCardLock, releaseAllHeldLocks } from "./locks.ts";
import {
  registerSignalHandlersOnce,
  runInterruptCleanupForTest,
  setInterruptHandler,
  unregisterSignalHandlers,
} from "./signals.ts";

Deno.test("runInterruptCleanupForTest releases held locks (req §14.5)", async () => {
  const dir = await Deno.makeTempDir();
  try {
    await initBoard("stories", ["todo"], dir);
    const cardId = "stories-000001";
    await Deno.mkdir(
      `${dir}/.devflow/boards/stories/cards/${cardId}`,
      { recursive: true },
    );

    registerSignalHandlersOnce();
    setInterruptHandler(async () => {
      await releaseAllHeldLocks(dir);
    });

    await acquireCardLock(dir, "stories", cardId);
    await runInterruptCleanupForTest("SIGINT");

    let found = false;
    try {
      await Deno.stat(
        `${dir}/.devflow/boards/stories/cards/${cardId}/.lock`,
      );
      found = true;
    } catch (e) {
      if (!(e instanceof Deno.errors.NotFound)) throw e;
    }
    assertEquals(found, false);
  } finally {
    unregisterSignalHandlers();
  }
});
