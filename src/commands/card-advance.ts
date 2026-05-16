import { assertAdvanceAllowed } from "../domain/advance-preconditions.ts";
import { loadBoardConfig } from "../domain/board.ts";
import { loadCardState } from "../domain/card.ts";
import {
  assertForwardTarget,
  assertNormalPhase,
  isAtTarget,
} from "../domain/phases.ts";
import { resolveBoardForCard } from "../domain/resolve-card.ts";
import { assertGitAdvanceAllowed } from "../services/git.ts";
import {
  acquireCardLock,
  acquireRepoLock,
  getLastRepoRoot,
  releaseAllHeldLocks,
} from "../services/locks.ts";
import { setInterruptHandler } from "../services/signals.ts";
import {
  recordInterruptFailure,
  runAdvance,
  runForceAdvance,
} from "../services/transition.ts";
import type { AdvanceFailure } from "../services/transition.ts";

export interface AdvanceCardOptions {
  force?: boolean;
}

export interface AdvanceCardNotice {
  kind: "already-in-phase";
  cardId: string;
  phase: string;
}

export interface AdvanceCardResult {
  exitCode: number;
  notice?: AdvanceCardNotice;
  failure?: AdvanceFailure;
  /** Card id for displaying {@link AdvanceCardResult.failure}. */
  cardId?: string;
}

const defaultInterruptHandler = async (_signal: Deno.Signal) => {
  const root = getLastRepoRoot();
  if (root) await releaseAllHeldLocks(root);
};

export async function advanceCard(
  cardId: string,
  targetPhase: string,
  repoRoot: string,
  options: AdvanceCardOptions = {},
): Promise<AdvanceCardResult> {
  const { force = false } = options;
  const boardName = await resolveBoardForCard(repoRoot, cardId);
  const board = await loadBoardConfig(repoRoot, boardName);
  const state = await loadCardState(repoRoot, boardName, cardId);

  assertAdvanceAllowed(state, board, targetPhase, { force });
  assertNormalPhase(board, targetPhase);

  if (isAtTarget(state.phase, targetPhase)) {
    return {
      exitCode: 0,
      notice: {
        kind: "already-in-phase",
        cardId,
        phase: targetPhase,
      },
    };
  }

  if (!force) {
    assertForwardTarget(board, state.phase, targetPhase);
  }
  await assertGitAdvanceAllowed(repoRoot);

  setInterruptHandler(async (signal) => {
    await recordInterruptFailure(signal);
    await defaultInterruptHandler(signal);
  });

  await acquireRepoLock(repoRoot);
  await acquireCardLock(repoRoot, boardName, cardId);

  try {
    const result = force
      ? await runForceAdvance({
        repoRoot,
        board,
        state,
        targetPhase,
      })
      : await runAdvance({
        repoRoot,
        board,
        state,
        targetPhase,
      });

    if (result.ok) {
      return { exitCode: 0 };
    }

    return {
      exitCode: 1,
      cardId,
      failure: result.failure,
    };
  } finally {
    setInterruptHandler(defaultInterruptHandler);
    await releaseAllHeldLocks(repoRoot);
  }
}
