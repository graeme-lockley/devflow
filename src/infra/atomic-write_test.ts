import { assertEquals } from "@std/assert";
import { writeTextFileAtomic } from "./atomic-write.ts";

Deno.test("writeTextFileAtomic writes and replaces content", async () => {
  const dir = await Deno.makeTempDir();
  const path = `${dir}/board.json`;

  await writeTextFileAtomic(path, '{"v":1}\n');
  assertEquals(await Deno.readTextFile(path), '{"v":1}\n');

  await writeTextFileAtomic(path, '{"v":2}\n');
  assertEquals(await Deno.readTextFile(path), '{"v":2}\n');
});

Deno.test("writeTextFileAtomic creates parent directory", async () => {
  const dir = await Deno.makeTempDir();
  const path = `${dir}/nested/board.json`;

  await writeTextFileAtomic(path, "{}");
  assertEquals(await Deno.readTextFile(path), "{}");
});
