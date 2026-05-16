import { assertEquals } from "@std/assert";
import {
  boardCardsDir,
  boardConfigFile,
  boardLockDir,
  boardRoot,
  boardScriptsDir,
  boardSkillsDir,
  boardsRoot,
  cardDir,
  cardFilesDir,
  cardLockDir,
  cardLogsDir,
  cardMdFile,
  cardStateFile,
  devflowRoot,
  repoLockDir,
  templatesRoot,
} from "./paths.ts";

Deno.test("path helpers match spec layout", () => {
  assertEquals(devflowRoot(), ".devflow");
  assertEquals(boardsRoot(), ".devflow/boards");
  assertEquals(boardRoot("stories"), ".devflow/boards/stories");
  assertEquals(
    boardConfigFile("stories"),
    ".devflow/boards/stories/board.json",
  );
  assertEquals(boardCardsDir("stories"), ".devflow/boards/stories/cards");
  assertEquals(boardScriptsDir("stories"), ".devflow/boards/stories/scripts");
  assertEquals(boardSkillsDir("stories"), ".devflow/boards/stories/skills");
  assertEquals(boardLockDir("stories"), ".devflow/boards/stories/.lock");
  assertEquals(repoLockDir(), ".devflow/.lock");
  assertEquals(templatesRoot(), ".devflow/templates");
});

Deno.test("card path helpers match spec layout (req §6.3)", () => {
  assertEquals(
    cardDir("stories", "stories-000042"),
    ".devflow/boards/stories/cards/stories-000042",
  );
  assertEquals(
    cardStateFile("stories", "stories-000042"),
    ".devflow/boards/stories/cards/stories-000042/state.json",
  );
  assertEquals(
    cardMdFile("stories", "stories-000042"),
    ".devflow/boards/stories/cards/stories-000042/card.md",
  );
  assertEquals(
    cardFilesDir("stories", "stories-000042"),
    ".devflow/boards/stories/cards/stories-000042/files",
  );
  assertEquals(
    cardLogsDir("stories", "stories-000042"),
    ".devflow/boards/stories/cards/stories-000042/logs",
  );
  assertEquals(
    cardLockDir("stories", "stories-000042"),
    ".devflow/boards/stories/cards/stories-000042/.lock",
  );
});
