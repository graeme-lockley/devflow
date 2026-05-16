/** Exit script naming per req §9.3. */

export function exitScriptPattern(phase: string): RegExp {
  return new RegExp(`^${escapeRegex(phase)}-[0-9]{3}-[a-z0-9][a-z0-9-]*$`);
}

export function commitMessageScriptPattern(phase: string): RegExp {
  return new RegExp(`^${escapeRegex(phase)}\\.commit-message$`);
}

export function matchesExitScript(name: string, phase: string): boolean {
  return exitScriptPattern(phase).test(name);
}

export function isCommitMessageScript(name: string, phase: string): boolean {
  return commitMessageScriptPattern(phase).test(name);
}

export function sortExitScriptNames(names: string[]): string[] {
  return [...names].sort((a, b) => a.localeCompare(b));
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
