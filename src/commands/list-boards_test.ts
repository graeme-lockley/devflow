import { assertEquals } from "@std/assert";
import { initBoard } from "./init-board.ts";
import { formatBoardList, listBoards } from "./list-boards.ts";

Deno.test("listBoards returns boards with board.json sorted", async () => {
  const dir = await Deno.makeTempDir();
  await initBoard("beta", ["a"], dir);
  await initBoard("alpha", ["b"], dir);

  assertEquals(await listBoards(dir), ["alpha", "beta"]);
  assertEquals(formatBoardList(["alpha", "beta"]), "alpha\nbeta\n");
});

Deno.test("formatBoardList empty", () => {
  assertEquals(formatBoardList([]), "");
});
