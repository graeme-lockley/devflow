import type { BoardConfig } from "../domain/board.ts";
import { loadBoardConfig } from "../domain/board.ts";

export function formatBoardShow(config: BoardConfig): string {
  const lines = [
    `name: ${config.name}`,
    `idPrefix: ${config.idPrefix}`,
    `phases: ${config.phases.join(", ")}`,
    `blockedPhase: ${config.blockedPhase}`,
    `nextSequence: ${config.nextSequence}`,
    `sequenceWidth: ${config.sequenceWidth}`,
    `createdAt: ${config.createdAt}`,
    `updatedAt: ${config.updatedAt}`,
  ];
  return lines.join("\n") + "\n";
}

export async function showBoard(
  boardName: string,
  repoRoot: string,
): Promise<string> {
  const config = await loadBoardConfig(repoRoot, boardName);
  return formatBoardShow(config);
}
