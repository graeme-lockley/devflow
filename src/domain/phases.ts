import type { BoardConfig } from "./board.ts";

export interface PhaseHop {
  from: string;
  to: string;
}

export function assertNormalPhase(board: BoardConfig, phase: string): void {
  if (phase === board.blockedPhase) {
    throw new Error(
      `cannot use blocked phase "${phase}" in forward transition`,
    );
  }
  if (!board.phases.includes(phase)) {
    throw new Error(`unknown phase "${phase}"`);
  }
}

export function phaseIndex(board: BoardConfig, phase: string): number {
  assertNormalPhase(board, phase);
  return board.phases.indexOf(phase);
}

export function nextPhase(
  board: BoardConfig,
  phase: string,
): string | null {
  const i = phaseIndex(board, phase);
  if (i === board.phases.length - 1) return null;
  return board.phases[i + 1];
}

export function isAtTarget(current: string, target: string): boolean {
  return current === target;
}

/**
 * Lists single-phase hops from fromPhase (inclusive exit) to toPhase (inclusive arrival).
 * req §11.3 multi-phase advance.
 */
export function enumerateHops(
  board: BoardConfig,
  fromPhase: string,
  toPhase: string,
): PhaseHop[] {
  assertNormalPhase(board, fromPhase);
  assertNormalPhase(board, toPhase);

  const fromIdx = phaseIndex(board, fromPhase);
  const toIdx = phaseIndex(board, toPhase);

  if (fromIdx > toIdx) {
    throw new Error(
      `target phase "${toPhase}" is behind current phase "${fromPhase}"`,
    );
  }

  const hops: PhaseHop[] = [];
  for (let i = fromIdx; i < toIdx; i++) {
    hops.push({ from: board.phases[i], to: board.phases[i + 1] });
  }
  return hops;
}

/**
 * Validates target is a known normal phase and not behind current. req §11.7.
 */
export function assertForwardTarget(
  board: BoardConfig,
  currentPhase: string,
  targetPhase: string,
): void {
  assertNormalPhase(board, currentPhase);
  assertNormalPhase(board, targetPhase);

  const currentIdx = phaseIndex(board, currentPhase);
  const targetIdx = phaseIndex(board, targetPhase);

  if (targetIdx < currentIdx) {
    throw new Error(
      `target phase "${targetPhase}" is behind current phase "${currentPhase}"`,
    );
  }
}
