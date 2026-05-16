/** Exit script naming per req §9.3.
 *
 * Root exit scripts match the pattern `phase-NNN-name` and live directly in
 * scripts/ (not subdirectories). They are automatically discovered and run.
 *
 * Child scripts may use hierarchical naming (e.g., `phase-NNN-NN-childname`)
 * or live in subdirectories (e.g., `phase/steps/01-name.sh`). They are
 * invoked only by parent scripts or loop orchestrator, never auto-discovered.
 */

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

/** Sequence from `phase-NNN-name` (req §9.11.3 loop entry/exit bands). */
export function exitScriptSequenceNumber(
  name: string,
  phase: string,
): number | null {
  const re = new RegExp(`^${escapeRegex(phase)}-([0-9]{3})-`);
  const m = name.match(re);
  if (!m) return null;
  return parseInt(m[1], 10);
}

/** Three-digit sequence suffix from `phase-NNN-name` (preserves leading zeros). */
export function exitScriptSequenceSuffix(
  name: string,
  phase: string,
): string | null {
  const re = new RegExp(`^${escapeRegex(phase)}-([0-9]{3})-`);
  const m = name.match(re);
  return m ? m[1] : null;
}

/** Root scripts for a phase with a loop block (req §9.11.3). */
const LOOP_ENTRY_MAX_SUFFIX = "001";
const LOOP_ORCHESTRATOR_SUFFIX = "002";
const LOOP_EXIT_MIN_SUFFIX = "003";

export function partitionLoopRootScripts(
  scriptNames: string[],
  phase: string,
): { entry: string[]; exit: string[] } {
  const entry: string[] = [];
  const exit: string[] = [];
  for (const name of scriptNames) {
    const seq = exitScriptSequenceSuffix(name, phase);
    if (seq === null) continue;
    if (seq <= LOOP_ENTRY_MAX_SUFFIX) entry.push(name);
    else if (seq === LOOP_ORCHESTRATOR_SUFFIX) continue;
    else if (seq >= LOOP_EXIT_MIN_SUFFIX) exit.push(name);
  }
  return { entry, exit };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
