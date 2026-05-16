import { assertEquals } from "@std/assert";
import { initBoard } from "../commands/init-board.ts";
import { validateBoardOnDisk } from "./validate-board.ts";

Deno.test("validateBoardOnDisk passes for initialized board", async () => {
  const dir = await Deno.makeTempDir();
  await initBoard("stories", ["todo", "done"], dir);
  assertEquals(await validateBoardOnDisk(dir, "stories"), []);
});

Deno.test("validateBoardOnDisk reports missing skills directory", async () => {
  const dir = await Deno.makeTempDir();
  await initBoard("stories", ["todo"], dir);
  await Deno.remove(`${dir}/.devflow/boards/stories/skills`, {
    recursive: true,
  });

  const problems = await validateBoardOnDisk(dir, "stories");
  assertEquals(
    problems.some((p) => p.includes("skills")),
    true,
  );
});
