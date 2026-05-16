import { loadBoardConfig } from "../domain/board.ts";
import { loadCardState } from "../domain/card.ts";
import { boardCardsDir } from "../infra/paths.ts";

export async function listCards(
  boardName: string,
  repoRoot: string,
  phaseFilter?: string,
): Promise<string[]> {
  await loadBoardConfig(repoRoot, boardName);

  const cardsPath = `${repoRoot}/${boardCardsDir(boardName)}`;
  const ids: string[] = [];

  try {
    for await (const entry of Deno.readDir(cardsPath)) {
      if (!entry.isDirectory || entry.name.startsWith(".")) continue;
      if (phaseFilter) {
        const state = await loadCardState(repoRoot, boardName, entry.name);
        if (state.phase !== phaseFilter) continue;
      }
      ids.push(entry.name);
    }
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      return [];
    }
    throw e;
  }

  ids.sort();
  return ids;
}

export function formatCardList(cardIds: string[]): string {
  if (cardIds.length === 0) return "";
  return cardIds.join("\n") + "\n";
}
