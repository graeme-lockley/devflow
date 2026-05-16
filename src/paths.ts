/** Root directory for devflow project metadata (relative to cwd). */
export const DEVFLOW_ROOT = ".devflow";

export function boardRoot(boardName: string): string {
  return `${DEVFLOW_ROOT}/${boardName}`;
}

export function boardStateDir(boardName: string): string {
  return `${boardRoot(boardName)}/state`;
}

export function boardScriptsDir(boardName: string): string {
  return `${boardRoot(boardName)}/scripts`;
}

export function boardSkillsDir(boardName: string): string {
  return `${boardRoot(boardName)}/skills`;
}

export function boardStateFile(boardName: string): string {
  return `${boardRoot(boardName)}/state.json`;
}
