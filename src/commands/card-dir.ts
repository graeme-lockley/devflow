import { resolveBoardForCard } from "../domain/resolve-card.ts";
import { cardDir } from "../infra/paths.ts";

export async function cardDirPath(
  cardId: string,
  repoRoot: string,
): Promise<string> {
  const boardName = await resolveBoardForCard(repoRoot, cardId);
  return `${repoRoot}/${cardDir(boardName, cardId)}`;
}
