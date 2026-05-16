import { loadBoardConfig } from "../domain/board.ts";
import { loadCardState, saveCardState } from "../domain/card.ts";
import { appendHistory, unblockedEvent, utcNow } from "../domain/history.ts";
import { resolveBoardForCard } from "../domain/resolve-card.ts";
import { acquireCardLock, releaseCardLock } from "../services/locks.ts";

export async function unblockCard(
  cardId: string,
  repoRoot: string,
): Promise<void> {
  const boardName = await resolveBoardForCard(repoRoot, cardId);
  const board = await loadBoardConfig(repoRoot, boardName);

  await acquireCardLock(repoRoot, boardName, cardId);
  try {
    const state = await loadCardState(repoRoot, boardName, cardId);

    if (state.phase !== board.blockedPhase) {
      throw new Error("card is not blocked");
    }

    if (state.previousPhase === null) {
      throw new Error("blocked card has no previousPhase");
    }

    const to = state.previousPhase;
    const at = utcNow();
    const next = appendHistory(
      {
        ...state,
        phase: to,
        previousPhase: null,
        blocked: null,
        updatedAt: at,
      },
      unblockedEvent(to, at),
    );
    await saveCardState(repoRoot, boardName, next);
  } finally {
    await releaseCardLock(repoRoot, boardName, cardId);
  }
}
