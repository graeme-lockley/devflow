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
import { recordInterruptFailure, runAdvance } from "../services/transition.ts";

export interface AdvanceCardResult {
  exitCode: number;
  message?: string;
  failureOutput?: string;
}

function formatFailureOutput(
  cardId: string,
  phase: string,
  targetPhase: string,
  script: string,
  exitCode: number,
  logPath: string,
): string {
  return [
    "ERROR: transition failed",
    "",
    `card: ${cardId}`,
    `phase: ${phase}`,
    `target: ${targetPhase}`,
    `script: ${script}`,
    `exit: ${exitCode}`,
    `log: ${logPath}`,
  ].join("\n");
}

const defaultInterruptHandler = async (_signal: Deno.Signal) => {
  const root = getLastRepoRoot();
  if (root) await releaseAllHeldLocks(root);
};

export async function advanceCard(
  cardId: string,
  targetPhase: string,
  repoRoot: string,
): Promise<AdvanceCardResult> {
  const boardName = await resolveBoardForCard(repoRoot, cardId);
  const board = await loadBoardConfig(repoRoot, boardName);
  const state = await loadCardState(repoRoot, boardName, cardId);

  assertAdvanceAllowed(state, board, targetPhase);
  assertNormalPhase(board, targetPhase);

  if (isAtTarget(state.phase, targetPhase)) {
    return {
      exitCode: 0,
      message: `card ${cardId} is already in phase "${targetPhase}"`,
    };
  }

  assertForwardTarget(board, state.phase, targetPhase);
  await assertGitAdvanceAllowed(repoRoot);

  setInterruptHandler(async (signal) => {
    await recordInterruptFailure(signal);
    await defaultInterruptHandler(signal);
  });

  await acquireRepoLock(repoRoot);
  await acquireCardLock(repoRoot, boardName, cardId);

  try {
    const result = await runAdvance({
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
      failureOutput: formatFailureOutput(
        cardId,
        result.state.phase,
        targetPhase,
        result.failure.script,
        result.failure.exitCode,
        result.failure.logPath,
      ),
    };
  } finally {
    setInterruptHandler(defaultInterruptHandler);
    await releaseAllHeldLocks(repoRoot);
  }
}
