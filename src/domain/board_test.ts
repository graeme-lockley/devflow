import { assertEquals, assertRejects } from "@std/assert";
import {
  createBoardConfig,
  loadBoardConfig,
  saveBoardConfig,
} from "./board.ts";
import { boardConfigFile } from "../infra/paths.ts";

Deno.test("loadBoardConfig and saveBoardConfig round-trip", async () => {
  const dir = await Deno.makeTempDir();
  const fixed = new Date("2026-05-16T07:00:00.000Z");
  const config = createBoardConfig("stories", ["todo", "done"], {
    now: fixed,
    sequenceWidth: 4,
  });

  await saveBoardConfig(dir, config);
  const loaded = await loadBoardConfig(dir, "stories");
  assertEquals(loaded, config);
});

Deno.test("loadBoardConfig rejects invalid JSON", async () => {
  const dir = await Deno.makeTempDir();
  const path = `${dir}/${boardConfigFile("stories")}`;
  await Deno.mkdir(`${dir}/.devflow/boards/stories`, { recursive: true });
  await Deno.writeTextFile(path, "not json");

  await assertRejects(
    () => loadBoardConfig(dir, "stories"),
    Error,
    "not valid JSON",
  );
});

Deno.test("parseBoardConfig rejects phaseScripts (deprecated)", async () => {
  const dir = await Deno.makeTempDir();
  const path = `${dir}/${boardConfigFile("stories")}`;
  await Deno.mkdir(`${dir}/.devflow/boards/stories`, { recursive: true });
  const config = createBoardConfig("stories", ["building", "done"]);
  const raw = {
    ...config,
    phaseScripts: {
      building: {
        loop: {
          steps: ["building/steps/01-pi.sh"],
          maxRounds: 5,
        },
      },
    },
  };
  await Deno.writeTextFile(path, JSON.stringify(raw, null, 2));

  await assertRejects(
    () => loadBoardConfig(dir, "stories"),
    Error,
    '"phaseScripts" is no longer supported',
  );
});
