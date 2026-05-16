import { forceReleaseBoardLock } from "../services/locks.ts";

export async function releaseBoardLockCommand(
  boardName: string,
  repoRoot: string,
  force: boolean,
): Promise<string> {
  const result = await forceReleaseBoardLock(repoRoot, boardName, force);
  return result.message;
}
