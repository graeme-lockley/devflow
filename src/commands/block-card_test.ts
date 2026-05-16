import { assertEquals, assertRejects } from "@std/assert";
import { initBoard } from "./init-board.ts";
import { createCard } from "./create-card.ts";
import { blockCard } from "./block-card.ts";
import { loadBoardConfig } from "../domain/board.ts";
import { loadCardState } from "../domain/card.ts";
import { validateCardById } from "../domain/validate-card.ts";
import { acquireCardLock, releaseCardLock } from "../services/locks.ts";

Deno.test("blockCard moves card to blocked phase (req §12.1)", async () => {
  const dir = await Deno.makeTempDir();
  await initBoard("stories", ["todo", "done"], dir);
  const cardId = await createCard("stories", "Test card", dir);

  await blockCard(cardId, "Waiting for API contract", dir);

  const board = await loadBoardConfig(dir, "stories");
  const state = await loadCardState(dir, "stories", cardId);
  assertEquals(state.phase, board.blockedPhase);
  assertEquals(state.previousPhase, "todo");
  assertEquals(state.blocked?.reason, "Waiting for API contract");
  assertEquals(state.blocked?.blockedAt.endsWith("Z"), true);

  const last = state.history[state.history.length - 1];
  assertEquals(last, {
    type: "blocked",
    at: state.blocked!.blockedAt,
    from: "todo",
    reason: "Waiting for API contract",
  });

  assertEquals(await validateCardById(dir, cardId), []);
});

Deno.test("blockCard rejects empty reason", async () => {
  const dir = await Deno.makeTempDir();
  await initBoard("stories", ["todo"], dir);
  const cardId = await createCard("stories", "Test", dir);

  await assertRejects(
    () => blockCard(cardId, "   ", dir),
    Error,
    "block reason required",
  );
});

Deno.test("blockCard rejects already blocked card", async () => {
  const dir = await Deno.makeTempDir();
  await initBoard("stories", ["todo"], dir);
  const cardId = await createCard("stories", "Test", dir);
  await blockCard(cardId, "First block", dir);

  await assertRejects(
    () => blockCard(cardId, "Second block", dir),
    Error,
    "card is already blocked",
  );
});

Deno.test("blockCard fails when card lock held (req §14.4)", async () => {
  const dir = await Deno.makeTempDir();
  await initBoard("stories", ["todo"], dir);
  const cardId = await createCard("stories", "Test", dir);

  await acquireCardLock(dir, "stories", cardId);
  try {
    await assertRejects(
      () => blockCard(cardId, "Waiting", dir),
      Error,
      "card lock held",
    );
  } finally {
    await releaseCardLock(dir, "stories", cardId);
  }
});
