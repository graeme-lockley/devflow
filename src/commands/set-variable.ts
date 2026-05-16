import { loadCardState, saveCardState } from "../domain/card.ts";
import { resolveBoardForCard } from "../domain/resolve-card.ts";
import { utcNow } from "../domain/history.ts";
import { acquireCardLock, releaseCardLock } from "../services/locks.ts";

export async function setVariable(
  cardId: string,
  name: string,
  value: string,
  repoRoot: string,
  options: { ignoreLock?: boolean } = {},
): Promise<void> {
  const boardName = await resolveBoardForCard(repoRoot, cardId);

  const acquired = await acquireCardLock(repoRoot, boardName, cardId, {
    ignoreLock: options.ignoreLock,
  });
  try {
    const state = await loadCardState(repoRoot, boardName, cardId);
    state.variables[name] = value;
    state.updatedAt = utcNow();
    await saveCardState(repoRoot, boardName, state);
  } finally {
    if (acquired) {
      await releaseCardLock(repoRoot, boardName, cardId);
    }
  }
}
