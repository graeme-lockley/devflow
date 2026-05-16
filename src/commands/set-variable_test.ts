import { assertEquals } from "@std/assert";
import { initBoard } from "./init-board.ts";
import { createCard } from "./create-card.ts";
import { setVariable } from "./set-variable.ts";
import { acquireCardLock, releaseCardLock } from "../services/locks.ts";
import { loadCardState } from "../domain/card.ts";

Deno.test("setVariable with ignoreLock while card lock held (req §16.1)", async () => {
  const dir = await Deno.makeTempDir();
  await initBoard("stories", ["todo"], dir);
  const cardId = await createCard("stories", "Test", dir);

  await acquireCardLock(dir, "stories", cardId);
  try {
    await setVariable(cardId, "SESSION_ID", "abc123", dir, {
      ignoreLock: true,
    });
    const state = await loadCardState(dir, "stories", cardId);
    assertEquals(state.variables.SESSION_ID, "abc123");
  } finally {
    await releaseCardLock(dir, "stories", cardId);
  }
});
