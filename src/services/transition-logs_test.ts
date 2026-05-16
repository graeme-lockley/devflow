import { assertEquals } from "@std/assert";
import {
  createTransitionRun,
  writeCommitMessageTxt,
} from "./transition-logs.ts";

Deno.test("writeCommitMessageTxt (req §15.2)", async () => {
  const dir = await Deno.makeTempDir();
  const run = await createTransitionRun(
    dir,
    "test",
    "test-000001",
    "a",
    "b",
    "2026-05-16T10:00:00.000Z",
  );

  await writeCommitMessageTxt(run, "Advance test-000001 from a to b");

  const content = await Deno.readTextFile(
    `${run.runDirAbs}/commit-message.txt`,
  );
  assertEquals(content, "Advance test-000001 from a to b");
});
