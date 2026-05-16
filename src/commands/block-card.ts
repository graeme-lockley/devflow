import { loadBoardConfig } from "../domain/board.ts";
import { loadCardState, saveCardState } from "../domain/card.ts";
import { appendHistory, blockedEvent, utcNow } from "../domain/history.ts";
import { resolveBoardForCard } from "../domain/resolve-card.ts";
import { acquireCardLock, releaseCardLock } from "../services/locks.ts";

export async function blockCard(
  cardId: string,
  reason: string,
  repoRoot: string,
): Promise<void> {
  if (!reason.trim()) {
    throw new Error("block reason required");
  }

  const boardName = await resolveBoardForCard(repoRoot, cardId);
  const board = await loadBoardConfig(repoRoot, boardName);

  await acquireCardLock(repoRoot, boardName, cardId);
  try {
    const state = await loadCardState(repoRoot, boardName, cardId);

    if (state.phase === board.blockedPhase) {
      throw new Error("card is already blocked");
    }

    const from = state.phase;
    const at = utcNow();
    const next = appendHistory(
      {
        ...state,
        previousPhase: from,
        phase: board.blockedPhase,
        blocked: { reason, blockedAt: at },
        updatedAt: at,
      },
      blockedEvent(from, reason, at),
    );
    await saveCardState(repoRoot, boardName, next);
  } finally {
    await releaseCardLock(repoRoot, boardName, cardId);
  }
}
