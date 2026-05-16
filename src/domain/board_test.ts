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

Deno.test("parseBoardConfig accepts phaseScripts with loop config", async () => {
  const dir = await Deno.makeTempDir();
  const fixed = new Date("2026-05-16T07:00:00.000Z");
  const config = createBoardConfig("stories", ["building", "done"], {
    now: fixed,
  });
  config.phaseScripts = {
    building: {
      loop: {
        steps: ["building/steps/01-pi.sh", "building/steps/02-gate-ci.sh"],
        maxRounds: 5,
      },
    },
  };

  await saveBoardConfig(dir, config);
  const loaded = await loadBoardConfig(dir, "stories");
  assertEquals(loaded.phaseScripts?.building?.loop?.steps, [
    "building/steps/01-pi.sh",
    "building/steps/02-gate-ci.sh",
  ]);
  assertEquals(loaded.phaseScripts?.building?.loop?.maxRounds, 5);
});

Deno.test("parseBoardConfig rejects invalid loop.maxRounds", async () => {
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
          maxRounds: 0,
        },
      },
    },
  };
  await Deno.writeTextFile(path, JSON.stringify(raw, null, 2));

  await assertRejects(
    () => loadBoardConfig(dir, "stories"),
    Error,
    "maxRounds must be an integer >= 1",
  );
});

Deno.test("parseBoardConfig rejects loop.steps not an array", async () => {
  const dir = await Deno.makeTempDir();
  const path = `${dir}/${boardConfigFile("stories")}`;
  await Deno.mkdir(`${dir}/.devflow/boards/stories`, { recursive: true });
  const config = createBoardConfig("stories", ["building", "done"]);
  const raw = {
    ...config,
    phaseScripts: {
      building: {
        loop: {
          steps: "not-an-array",
          maxRounds: 3,
        },
      },
    },
  };
  await Deno.writeTextFile(path, JSON.stringify(raw, null, 2));

  await assertRejects(
    () => loadBoardConfig(dir, "stories"),
    Error,
    "loop.steps must be an array of strings",
  );
});
