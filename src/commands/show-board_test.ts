import { assertEquals } from "@std/assert";
import { initBoard } from "./init-board.ts";
import { formatBoardShow, showBoard } from "./show-board.ts";
import { createBoardConfig } from "../domain/board.ts";

Deno.test("formatBoardShow stable output", () => {
  const config = createBoardConfig("stories", ["todo", "done"], {
    now: new Date("2026-05-16T07:00:00.000Z"),
    sequenceWidth: 4,
  });
  const out = formatBoardShow(config);
  assertEquals(out.includes("name: stories"), true);
  assertEquals(out.includes("phases: todo, done"), true);
  assertEquals(out.includes("sequenceWidth: 4"), true);
});

Deno.test("showBoard loads board from disk", async () => {
  const dir = await Deno.makeTempDir();
  await initBoard("stories", ["todo"], dir);
  const out = await showBoard("stories", dir);
  assertEquals(out.includes("name: stories"), true);
});
