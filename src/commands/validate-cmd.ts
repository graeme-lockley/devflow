import { listBoardNames } from "../domain/board.ts";
import { boardCardsDir } from "../infra/paths.ts";
import { validateBoardOnDisk } from "../domain/validate-board.ts";
import { validateCardOnDisk } from "../domain/validate-card.ts";
import { validateRepoOnDisk } from "../domain/validate-repo.ts";
import { logError } from "../services/console.ts";

export async function validateCommand(repoRoot: string): Promise<number> {
  const problems: string[] = [];

  for (const p of await validateRepoOnDisk(repoRoot)) {
    problems.push(`validate: repository: ${p}`);
  }

  const boards = await listBoardNames(repoRoot);
  for (const boardName of boards) {
    for (const p of await validateBoardOnDisk(repoRoot, boardName)) {
      problems.push(`validate: board ${boardName}: ${p}`);
    }

    const cardsPath = `${repoRoot}/${boardCardsDir(boardName)}`;
    try {
      for await (const entry of Deno.readDir(cardsPath)) {
        if (!entry.isDirectory || entry.name.startsWith(".")) continue;
        for (
          const p of await validateCardOnDisk(repoRoot, boardName, entry.name)
        ) {
          problems.push(`validate: card ${entry.name}: ${p}`);
        }
      }
    } catch (e) {
      if (!(e instanceof Deno.errors.NotFound)) throw e;
    }
  }

  for (const problem of problems) {
    logError(problem);
  }

  return problems.length === 0 ? 0 : 1;
}
