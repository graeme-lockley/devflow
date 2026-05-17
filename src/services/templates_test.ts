import { assertEquals } from "@std/assert";
import { initBoard } from "../commands/init-board.ts";
import { loadBoardConfig } from "../domain/board.ts";
import { devflowPackageRoot } from "../infra/package-root.ts";
import {
  boardScriptsDir,
  boardSkillsDir,
  templatesRoot,
} from "../infra/paths.ts";
import { resolveTemplateDir } from "./templates.ts";

Deno.test("resolveTemplateDir finds built-in stories template", async () => {
  const dir = await Deno.makeTempDir();
  const resolved = await resolveTemplateDir("stories", dir);
  assertEquals(resolved, `${devflowPackageRoot()}/templates/stories`);
});

Deno.test("resolveTemplateDir prefers repository-local template", async () => {
  const dir = await Deno.makeTempDir();
  const local = `${dir}/${templatesRoot()}/stories`;
  await Deno.mkdir(`${local}/scripts`, { recursive: true });
  await Deno.mkdir(`${local}/skills`, { recursive: true });
  await Deno.writeTextFile(`${local}/scripts/local-marker`, "");

  const resolved = await resolveTemplateDir("stories", dir);
  assertEquals(resolved, local);
});

Deno.test("initBoard with template copies scripts and skills", async () => {
  const dir = await Deno.makeTempDir();
  await initBoard("stories", ["todo"], dir, { template: "stories" });

  const scriptPath = `${dir}/${
    boardScriptsDir("stories")
  }/planning-001-check-git-empty-status`;
  const skillPath = `${dir}/${boardSkillsDir("stories")}/plan-story/SKILL.md`;
  await Deno.stat(scriptPath);
  await Deno.stat(skillPath);
});

Deno.test("initBoard with template applies building loop config", async () => {
  const dir = await Deno.makeTempDir();
  await initBoard(
    "stories",
    ["planning", "building", "done"],
    dir,
    { template: "stories" },
  );

  const board = await loadBoardConfig(dir, "stories");
  assertEquals(board.phaseScripts?.building?.loop?.maxRounds, 5);
  assertEquals(
    board.phaseScripts?.building?.loop?.steps,
    [
      "building/steps/01-pi.sh",
      "building/steps/02-fmt.sh",
      "building/steps/03-gate-ci.sh",
      "building/steps/04-gate-scenarios.sh",
    ],
  );

  await Deno.stat(
    `${dir}/${boardScriptsDir("stories")}/building-001-check-entry`,
  );
  await Deno.stat(
    `${dir}/${boardScriptsDir("stories")}/building/steps/01-pi.sh`,
  );
  await Deno.stat(`${dir}/${boardSkillsDir("stories")}/build-story/SKILL.md`);
});

Deno.test("copyTemplateScriptsAndSkills copies assets when present", async () => {
  const { copyTemplateScriptsAndSkills } = await import("./templates.ts");

  const tempRoot = await Deno.makeTempDir();
  const templateDir = `${tempRoot}/test-template`;
  await Deno.mkdir(`${templateDir}/scripts`, { recursive: true });
  await Deno.mkdir(`${templateDir}/skills`, { recursive: true });
  await Deno.mkdir(`${templateDir}/assets`, { recursive: true });
  await Deno.writeTextFile(`${templateDir}/assets/test.template.md`, "# Test");

  const repoRoot = await Deno.makeTempDir();
  await copyTemplateScriptsAndSkills(templateDir, repoRoot, "test-board");

  // Verify assets were copied
  const assetPath =
    `${repoRoot}/.devflow/boards/test-board/assets/test.template.md`;
  const content = await Deno.readTextFile(assetPath);
  assertEquals(content, "# Test");
});
