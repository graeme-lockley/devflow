import {
  boardLockDir,
  cardLockDir,
  devflowRoot,
  repoLockDir,
} from "../infra/paths.ts";

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

export async function acquireBoardLock(
  repoRoot: string,
  boardName: string,
): Promise<void> {
  const boardDir = `${repoRoot}/.devflow/boards/${boardName}`;
  await Deno.mkdir(boardDir, { recursive: true });

  const path = `${repoRoot}/${boardLockDir(boardName)}`;
  try {
    await Deno.mkdir(path);
  } catch (e) {
    if (e instanceof Deno.errors.AlreadyExists) {
      throw new Error(
        `board lock held for "${boardName}" at ${
          boardLockDir(boardName)
        }; wait or run devflow lock release-board`,
      );
    }
    throw e;
  }
}

export async function releaseBoardLock(
  repoRoot: string,
  boardName: string,
): Promise<void> {
  const path = `${repoRoot}/${boardLockDir(boardName)}`;
  try {
    await Deno.remove(path);
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return;
    throw e;
  }
}

export async function acquireCardLock(
  repoRoot: string,
  boardName: string,
  cardId: string,
): Promise<void> {
  const cardDirPath =
    `${repoRoot}/.devflow/boards/${boardName}/cards/${cardId}`;
  await Deno.mkdir(cardDirPath, { recursive: true });

  const path = `${repoRoot}/${cardLockDir(boardName, cardId)}`;
  try {
    await Deno.mkdir(path);
  } catch (e) {
    if (e instanceof Deno.errors.AlreadyExists) {
      throw new Error(
        `card lock held for "${cardId}" at ${
          cardLockDir(boardName, cardId)
        }; wait or run devflow lock release`,
      );
    }
    throw e;
  }
}

export async function releaseCardLock(
  repoRoot: string,
  boardName: string,
  cardId: string,
): Promise<void> {
  const path = `${repoRoot}/${cardLockDir(boardName, cardId)}`;
  try {
    await Deno.remove(path);
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return;
    throw e;
  }
}
