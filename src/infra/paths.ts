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

export function repoLockDir(): string {
  return `${DEVFLOW_ROOT}/.lock`;
}

export function templatesRoot(): string {
  return `${DEVFLOW_ROOT}/templates`;
}
