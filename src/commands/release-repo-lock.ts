import { forceReleaseRepoLock } from "../services/locks.ts";

export async function releaseRepoLockCommand(
  repoRoot: string,
  force: boolean,
): Promise<string> {
  const result = await forceReleaseRepoLock(repoRoot, force);
  return result.message;
}
