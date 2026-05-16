import { devflowRoot, repoLockDir } from "../infra/paths.ts";

export async function acquireRepoLock(repoRoot: string): Promise<void> {
  await Deno.mkdir(`${repoRoot}/${devflowRoot()}`, { recursive: true });

  const path = `${repoRoot}/${repoLockDir()}`;
  try {
    await Deno.mkdir(path);
  } catch (e) {
    if (e instanceof Deno.errors.AlreadyExists) {
      throw new Error(
        `repository lock held at ${repoLockDir()}; wait or run devflow lock release-repo`,
      );
    }
    throw e;
  }
}

export async function releaseRepoLock(repoRoot: string): Promise<void> {
  const path = `${repoRoot}/${repoLockDir()}`;
  try {
    await Deno.remove(path);
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return;
    throw e;
  }
}
