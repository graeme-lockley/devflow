import { createBoardConfig } from "../domain/board.ts";
import { validateIdentifier } from "../domain/identifiers.ts";
import { ensureDevflowGitignoreEntries } from "../infra/gitignore.ts";
import {
  boardCardsDir,
  boardConfigFile,
  boardScriptsDir,
  boardSkillsDir,
  boardsRoot,
  devflowRoot,
} from "../infra/paths.ts";

async function assertDirectory(path: string, label: string): Promise<void> {
  try {
    const stat = await Deno.stat(path);
    if (!stat.isDirectory) {
      throw new Error(`${label} exists but is not a directory`);
    }
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return;
    throw e;
  }
}

export async function initBoard(
  boardName: string,
  phaseNames: string[],
  repoRoot = Deno.cwd(),
): Promise<void> {
  const boardErr = validateIdentifier(boardName, "board");
  if (boardErr) throw new Error(boardErr);

  if (phaseNames.length === 0) {
    throw new Error("board init requires at least one phase name");
  }

  for (const name of phaseNames) {
    const err = validateIdentifier(name, "phase");
    if (err) throw new Error(err);
  }

  const devflowPath = `${repoRoot}/${devflowRoot()}`;
  const boardsPath = `${repoRoot}/${boardsRoot()}`;
  await assertDirectory(devflowPath, devflowRoot());
  await assertDirectory(boardsPath, boardsRoot());

  const configRel = boardConfigFile(boardName);
  const configPath = `${repoRoot}/${configRel}`;
  try {
    await Deno.stat(configPath);
    throw new Error(
      `board "${boardName}" already exists at ${configRel}; remove it before re-initializing`,
    );
  } catch (e) {
    if (!(e instanceof Deno.errors.NotFound)) throw e;
  }

  const dirs = [
    `${repoRoot}/${boardsRoot()}`,
    `${repoRoot}/${boardCardsDir(boardName)}`,
    `${repoRoot}/${boardScriptsDir(boardName)}`,
    `${repoRoot}/${boardSkillsDir(boardName)}`,
  ];

  for (const dir of dirs) {
    await Deno.mkdir(dir, { recursive: true });
  }

  const config = createBoardConfig(boardName, phaseNames);
  await Deno.writeTextFile(
    configPath,
    JSON.stringify(config, null, 2) + "\n",
  );

  await ensureDevflowGitignoreEntries(repoRoot);
}
