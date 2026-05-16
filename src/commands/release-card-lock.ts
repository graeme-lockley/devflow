import { resolveBoardForCard } from "../domain/resolve-card.ts";
import { forceReleaseCardLock } from "../services/locks.ts";

export async function releaseCardLockCommand(
  cardId: string,
  repoRoot: string,
  force: boolean,
): Promise<string> {
  const boardName = await resolveBoardForCard(repoRoot, cardId);
  const result = await forceReleaseCardLock(
    repoRoot,
    boardName,
    cardId,
    force,
  );
  return result.message;
}
