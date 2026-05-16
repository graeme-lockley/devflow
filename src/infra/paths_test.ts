import { assertEquals } from "@std/assert";
import {
  boardCardsDir,
  boardConfigFile,
  boardLockDir,
  boardRoot,
  boardScriptsDir,
  boardSkillsDir,
  boardsRoot,
  devflowRoot,
  repoLockDir,
  templatesRoot,
} from "./paths.ts";

Deno.test("path helpers match spec layout", () => {
  assertEquals(devflowRoot(), ".devflow");
  assertEquals(boardsRoot(), ".devflow/boards");
  assertEquals(boardRoot("stories"), ".devflow/boards/stories");
  assertEquals(boardConfigFile("stories"), ".devflow/boards/stories/board.json");
  assertEquals(boardCardsDir("stories"), ".devflow/boards/stories/cards");
  assertEquals(boardScriptsDir("stories"), ".devflow/boards/stories/scripts");
  assertEquals(boardSkillsDir("stories"), ".devflow/boards/stories/skills");
  assertEquals(boardLockDir("stories"), ".devflow/boards/stories/.lock");
  assertEquals(repoLockDir(), ".devflow/.lock");
  assertEquals(templatesRoot(), ".devflow/templates");
});
