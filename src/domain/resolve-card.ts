import { listBoardNames, loadBoardConfig } from "./board.ts";
import { parseCardId } from "./card.ts";

/**
 * Resolves board name for a card ID by matching idPrefix across boards.
 */
export async function resolveBoardForCard(
  repoRoot: string,
  cardId: string,
): Promise<string> {
  const boardNames = await listBoardNames(repoRoot);
  for (const boardName of boardNames) {
    const config = await loadBoardConfig(repoRoot, boardName);
    if (parseCardId(cardId, config.idPrefix) !== null) {
      return boardName;
    }
  }
  throw new Error(`card "${cardId}" not found on any board`);
}
