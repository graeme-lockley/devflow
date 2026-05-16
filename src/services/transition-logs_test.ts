import { assertEquals } from "@std/assert";
import { cardLogsDir } from "../infra/paths.ts";
import {
  appendScriptOutput,
  createTransitionRun,
  writeRunJson,
} from "./transition-logs.ts";

Deno.test("transition run dir and run.json (req §15)", async () => {
  const dir = await Deno.makeTempDir();
  const run = await createTransitionRun(
    dir,
    "stories",
    "stories-000001",
    "planning",
    "planned",
    "2026-05-16T07:42:18.000Z",
  );

  assertEquals(
    run.runDirRel.includes("advance-planning-planned"),
    true,
  );
  assertEquals(
    run.runDirRel.startsWith(cardLogsDir("stories", "stories-000001")),
    true,
  );

  await appendScriptOutput(run, "planning-001-x", "out\n", "err\n");
  await writeRunJson(run, "succeeded", [
    { name: "planning-001-x", exitCode: 0 },
  ], "2026-05-16T07:45:03.000Z");

  const raw = await Deno.readTextFile(`${run.runDirAbs}/run.json`);
  const meta = JSON.parse(raw);
  assertEquals(meta.status, "succeeded");
  assertEquals(meta.scripts.length, 1);
  assertEquals(meta.from, "planning");
  assertEquals(meta.to, "planned");
});
