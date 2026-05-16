import { createBoardState } from "../board/state.ts";
import { validatePathSegment } from "../identifiers.ts";
import {
  boardScriptsDir,
  boardSkillsDir,
  boardStateDir,
  boardStateFile,
} from "../paths.ts";

export async function initBoard(
  boardName: string,
  columnNames: string[],
  cwd = Deno.cwd(),
): Promise<void> {
  const boardErr = validatePathSegment(boardName, "board");
  if (boardErr) throw new Error(boardErr);

  if (columnNames.length === 0) {
    throw new Error("init requires at least one column name");
  }

  for (const name of columnNames) {
    const err = validatePathSegment(name, "column");
    if (err) throw new Error(err);
  }

  const stateRel = boardStateFile(boardName);
  const statePath = `${cwd}/${stateRel}`;
  try {
    await Deno.stat(statePath);
    throw new Error(
      `board "${boardName}" already exists at ${stateRel}; remove it before re-initializing`,
    );
  } catch (e) {
    if (!(e instanceof Deno.errors.NotFound)) throw e;
  }

  const dirs = [
    `${cwd}/${boardStateDir(boardName)}`,
    `${cwd}/${boardScriptsDir(boardName)}`,
    `${cwd}/${boardSkillsDir(boardName)}`,
  ];

  for (const dir of dirs) {
    await Deno.mkdir(dir, { recursive: true });
  }

  const state = createBoardState(columnNames);
  await Deno.writeTextFile(
    statePath,
    JSON.stringify(state, null, 2) + "\n",
  );
}
