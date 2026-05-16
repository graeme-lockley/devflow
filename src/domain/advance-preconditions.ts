import type { BoardConfig } from "./board.ts";
import type { CardState } from "./card.ts";

export interface AssertAdvanceAllowedOptions {
  force?: boolean;
}

/**
 * Blocking-related preconditions for card advance (req §12.3).
 * M5 transition runner calls this before acquiring locks and running scripts.
 */
export function assertAdvanceAllowed(
  state: CardState,
  board: BoardConfig,
  targetPhase: string,
  options: AssertAdvanceAllowedOptions = {},
): void {
  const isBlocked = state.phase === board.blockedPhase;

  if (isBlocked) {
    if (options.force) {
      throw new Error("cannot force-advance a blocked card");
    }
    throw new Error("card is blocked; unblock before advancing");
  }

  if (targetPhase === board.blockedPhase) {
    throw new Error(
      "cannot advance to blocked phase; use devflow card block",
    );
  }
}
