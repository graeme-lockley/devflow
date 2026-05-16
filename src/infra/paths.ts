/** Root directory for devflow project metadata (relative to repo root). */
export const DEVFLOW_ROOT = ".devflow";

export function devflowRoot(): string {
  return DEVFLOW_ROOT;
}

export function boardsRoot(): string {
  return `${DEVFLOW_ROOT}/boards`;
}

export function boardRoot(boardName: string): string {
  return `${boardsRoot()}/${boardName}`;
}

export function boardConfigFile(boardName: string): string {
  return `${boardRoot(boardName)}/board.json`;
}

export function boardCardsDir(boardName: string): string {
  return `${boardRoot(boardName)}/cards`;
}

export function boardScriptsDir(boardName: string): string {
  return `${boardRoot(boardName)}/scripts`;
}

export function boardSkillsDir(boardName: string): string {
  return `${boardRoot(boardName)}/skills`;
}

export function boardLockDir(boardName: string): string {
  return `${boardRoot(boardName)}/.lock`;
}

export function cardDir(boardName: string, cardId: string): string {
  return `${boardCardsDir(boardName)}/${cardId}`;
}

export function cardStateFile(boardName: string, cardId: string): string {
  return `${cardDir(boardName, cardId)}/state.json`;
}

export function cardMdFile(boardName: string, cardId: string): string {
  return `${cardDir(boardName, cardId)}/card.md`;
}

export function cardFilesDir(boardName: string, cardId: string): string {
  return `${cardDir(boardName, cardId)}/files`;
}

export function cardLogsDir(boardName: string, cardId: string): string {
  return `${cardDir(boardName, cardId)}/logs`;
}

/** UTC timestamp for advance run dir name (req §15.2). */
export function formatAdvanceTimestamp(date: Date): string {
  return date.toISOString().replace(/:/g, "-").replace(/\.\d{3}/, "");
}

export function advanceRunDirName(
  fromPhase: string,
  toPhase: string,
  date: Date = new Date(),
): string {
  const ts = formatAdvanceTimestamp(date);
  return `${ts}-advance-${fromPhase}-${toPhase}`;
}

export function advanceRunDir(
  boardName: string,
  cardId: string,
  fromPhase: string,
  toPhase: string,
  date: Date = new Date(),
): string {
  return `${cardLogsDir(boardName, cardId)}/${
    advanceRunDirName(fromPhase, toPhase, date)
  }`;
}

export function cardLockDir(boardName: string, cardId: string): string {
  return `${cardDir(boardName, cardId)}/.lock`;
}

export function repoLockDir(): string {
  return `${DEVFLOW_ROOT}/.lock`;
}

export function templatesRoot(): string {
  return `${DEVFLOW_ROOT}/templates`;
}
