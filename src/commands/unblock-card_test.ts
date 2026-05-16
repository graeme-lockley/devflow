import { assertEquals, assertRejects } from "@std/assert";
import { initBoard } from "./init-board.ts";
import { createCard } from "./create-card.ts";
import { blockCard } from "./block-card.ts";
import { unblockCard } from "./unblock-card.ts";
import { loadCardState } from "../domain/card.ts";
import { validateCardById } from "../domain/validate-card.ts";

Deno.test("unblockCard restores previous phase (req §12.2)", async () => {
  const dir = await Deno.makeTempDir();
  await initBoard("stories", ["todo", "done"], dir);
  const cardId = await createCard("stories", "Test card", dir);

  await blockCard(cardId, "Waiting", dir);
  await unblockCard(cardId, dir);

  const state = await loadCardState(dir, "stories", cardId);
  assertEquals(state.phase, "todo");
  assertEquals(state.previousPhase, null);
  assertEquals(state.blocked, null);

  const last = state.history[state.history.length - 1];
  assertEquals(last.type, "unblocked");
  assertEquals((last as { to: string }).to, "todo");

  assertEquals(await validateCardById(dir, cardId), []);
});

Deno.test("unblockCard rejects non-blocked card", async () => {
  const dir = await Deno.makeTempDir();
  await initBoard("stories", ["todo"], dir);
  const cardId = await createCard("stories", "Test", dir);

  await assertRejects(
    () => unblockCard(cardId, dir),
    Error,
    "card is not blocked",
  );
});
