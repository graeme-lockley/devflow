/** Git preconditions for advance (req §13.8). Commits deferred to M6. */

const GIT_STATE_MARKERS = [
  "MERGE_HEAD",
  "REBASE_HEAD",
  "CHERRY_PICK_HEAD",
  "REVERT_HEAD",
] as const;

export async function assertGitAdvanceAllowed(repoRoot: string): Promise<void> {
  const gitDir = `${repoRoot}/.git`;

  for (const marker of GIT_STATE_MARKERS) {
    const path = `${gitDir}/${marker}`;
    try {
      await Deno.stat(path);
      throw new Error(
        `repository is in an unresolved ${
          marker.replace("_HEAD", "").toLowerCase()
        } state; resolve before advancing`,
      );
    } catch (e) {
      if (e instanceof Deno.errors.NotFound) continue;
      if (e instanceof Error && e.message.includes("unresolved")) throw e;
      throw e;
    }
  }
}
