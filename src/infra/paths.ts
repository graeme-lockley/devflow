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

export function cardLockDir(boardName: string, cardId: string): string {
  return `${cardDir(boardName, cardId)}/.lock`;
}

export function repoLockDir(): string {
  return `${DEVFLOW_ROOT}/.lock`;
}

export function templatesRoot(): string {
  return `${DEVFLOW_ROOT}/templates`;
}
