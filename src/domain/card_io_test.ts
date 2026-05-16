import { assertEquals } from "@std/assert";
import { initBoard } from "../commands/init-board.ts";
import {
  type CardState,
  loadCardState,
  parseCardState,
  saveCardState,
  serializeCardState,
} from "./card.ts";
import { createdEvent, utcNow } from "./history.ts";

Deno.test("serializeCardState round-trips via parseCardState", () => {
  const state: CardState = {
    id: "stories-000001",
    board: "stories",
    title: "Beneficiary Add",
    phase: "todo",
    previousPhase: null,
    createdAt: "2026-05-16T07:00:00.000Z",
    updatedAt: "2026-05-16T07:00:00.000Z",
    variables: { SESSION_ID: "abc" },
    history: [createdEvent("todo", "2026-05-16T07:00:00.000Z")],
    blocked: null,
  };
  const parsed = parseCardState(
    JSON.parse(serializeCardState(state)),
    state.id,
  );
  assertEquals(parsed, state);
});

Deno.test("loadCardState and saveCardState round-trip on disk", async () => {
  const dir = await Deno.makeTempDir();
  await initBoard("stories", ["todo", "done"], dir);

  const at = utcNow(new Date("2026-05-16T07:00:00.000Z"));
  const state: CardState = {
    id: "stories-000001",
    board: "stories",
    title: "Test card",
    phase: "todo",
    previousPhase: null,
    createdAt: at,
    updatedAt: at,
    variables: {},
    history: [createdEvent("todo", at)],
    blocked: null,
  };

  const cardDir = `${dir}/.devflow/boards/stories/cards/stories-000001`;
  await Deno.mkdir(cardDir, { recursive: true });
  await saveCardState(dir, "stories", state);

  const loaded = await loadCardState(dir, "stories", "stories-000001");
  assertEquals(loaded, state);
});
