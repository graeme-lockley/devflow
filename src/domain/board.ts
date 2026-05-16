export interface BoardConfig {
  name: string;
  idPrefix: string;
  nextSequence: number;
  sequenceWidth: number;
  phases: string[];
  blockedPhase: string;
  createdAt: string;
  updatedAt: string;
}

export function createBoardConfig(
  boardName: string,
  phaseNames: string[],
  now = new Date(),
): BoardConfig {
  const iso = now.toISOString();
  return {
    name: boardName,
    idPrefix: boardName,
    nextSequence: 1,
    sequenceWidth: 6,
    phases: phaseNames,
    blockedPhase: "blocked",
    createdAt: iso,
    updatedAt: iso,
  };
}
