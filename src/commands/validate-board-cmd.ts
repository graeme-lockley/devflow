import { validateBoardOnDisk } from "../domain/validate-board.ts";

export async function validateBoardCommand(
  boardName: string,
  repoRoot: string,
): Promise<number> {
  const problems = await validateBoardOnDisk(repoRoot, boardName);
  for (const problem of problems) {
    console.error(`board validate ${boardName}: ${problem}`);
  }
  return problems.length === 0 ? 0 : 1;
}
