import {
  boardLockDir,
  cardLockDir,
  devflowRoot,
  repoLockDir,
} from "../infra/paths.ts";
import { logVerbose } from "./console.ts";
import { setInterruptHandler } from "./signals.ts";

export interface AcquireCardLockOptions {
  ignoreLock?: boolean;
}

export interface ForceReleaseResult {
  released: boolean;
  message: string;
}

type HeldLock =
  | { kind: "repo" }
  | { kind: "board"; boardName: string }
  | { kind: "card"; boardName: string; cardId: string };

const heldLocks: HeldLock[] = [];
let lastRepoRoot: string | null = null;

function trackAcquire(repoRoot: string, lock: HeldLock): void {
  lastRepoRoot = repoRoot;
  heldLocks.push(lock);
}

function untrackRelease(lock: HeldLock): void {
  const i = heldLocks.lastIndexOf(lock);
  if (i !== -1) heldLocks.splice(i, 1);
}

function lockKey(lock: HeldLock): string {
  switch (lock.kind) {
    case "repo":
      return "repo";
    case "board":
      return `board:${lock.boardName}`;
    case "card":
      return `card:${lock.boardName}:${lock.cardId}`;
  }
}

function findHeldLock(lock: HeldLock): HeldLock | undefined {
  const key = lockKey(lock);
  for (let i = heldLocks.length - 1; i >= 0; i--) {
    if (lockKey(heldLocks[i]) === key) return heldLocks[i];
  }
  return undefined;
}

async function releaseAllHeldLocksInternal(repoRoot: string): Promise<void> {
  while (heldLocks.length > 0) {
    const lock = heldLocks.pop()!;
    switch (lock.kind) {
      case "repo":
        await releaseRepoLock(repoRoot, { untrack: false });
        break;
      case "board":
        await releaseBoardLock(repoRoot, lock.boardName, { untrack: false });
        break;
      case "card":
        await releaseCardLock(repoRoot, lock.boardName, lock.cardId, {
          untrack: false,
        });
        break;
    }
  }
}

export async function releaseAllHeldLocks(repoRoot: string): Promise<void> {
  await releaseAllHeldLocksInternal(repoRoot);
}

export function getLastRepoRoot(): string | null {
  return lastRepoRoot;
}

export async function acquireRepoLock(repoRoot: string): Promise<void> {
  lastRepoRoot = repoRoot;

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
  trackAcquire(repoRoot, { kind: "repo" });
  logVerbose(`acquired repository lock at ${repoLockDir()}`);
}

export async function releaseRepoLock(
  repoRoot: string,
  options: { untrack?: boolean } = {},
): Promise<void> {
  const untrack = options.untrack !== false;
  const lock: HeldLock = { kind: "repo" };
  const path = `${repoRoot}/${repoLockDir()}`;
  try {
    await Deno.remove(path);
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      if (untrack) untrackRelease(lock);
      return;
    }
    throw e;
  }
  if (untrack) untrackRelease(lock);
  logVerbose(`released repository lock at ${repoLockDir()}`);
}

export async function acquireBoardLock(
  repoRoot: string,
  boardName: string,
): Promise<void> {
  lastRepoRoot = repoRoot;

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
  trackAcquire(repoRoot, { kind: "board", boardName });
  logVerbose(
    `acquired board lock for "${boardName}" at ${boardLockDir(boardName)}`,
  );
}

export async function releaseBoardLock(
  repoRoot: string,
  boardName: string,
  options: { untrack?: boolean } = {},
): Promise<void> {
  const untrack = options.untrack !== false;
  const lock: HeldLock = { kind: "board", boardName };
  const path = `${repoRoot}/${boardLockDir(boardName)}`;
  try {
    await Deno.remove(path);
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      if (untrack) untrackRelease(lock);
      return;
    }
    throw e;
  }
  if (untrack) untrackRelease(lock);
  logVerbose(`released board lock for "${boardName}"`);
}

/** Returns true if this process acquired the card lock (false when ignoreLock). */
export async function acquireCardLock(
  repoRoot: string,
  boardName: string,
  cardId: string,
  options: AcquireCardLockOptions = {},
): Promise<boolean> {
  if (options.ignoreLock) {
    return false;
  }

  lastRepoRoot = repoRoot;

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
  trackAcquire(repoRoot, { kind: "card", boardName, cardId });
  logVerbose(
    `acquired card lock for "${cardId}" at ${cardLockDir(boardName, cardId)}`,
  );
  return true;
}

export async function releaseCardLock(
  repoRoot: string,
  boardName: string,
  cardId: string,
  options: { untrack?: boolean } = {},
): Promise<void> {
  const untrack = options.untrack !== false;
  const lock: HeldLock = { kind: "card", boardName, cardId };
  const path = `${repoRoot}/${cardLockDir(boardName, cardId)}`;
  try {
    await Deno.remove(path);
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      if (untrack) untrackRelease(lock);
      return;
    }
    throw e;
  }
  if (untrack) untrackRelease(lock);
  logVerbose(`released card lock for "${cardId}"`);
}

async function lockExists(path: string): Promise<boolean> {
  try {
    const stat = await Deno.stat(path);
    return stat.isDirectory;
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return false;
    throw e;
  }
}

export async function forceReleaseRepoLock(
  repoRoot: string,
  force: boolean,
): Promise<ForceReleaseResult> {
  const path = `${repoRoot}/${repoLockDir()}`;
  const exists = await lockExists(path);
  if (!exists) {
    return {
      released: false,
      message: `no repository lock at ${repoLockDir()}`,
    };
  }
  if (!force) {
    throw new Error(
      `repository lock exists at ${repoLockDir()}; pass --force to release (may corrupt workflow state)`,
    );
  }
  await Deno.remove(path);
  const held = findHeldLock({ kind: "repo" });
  if (held) untrackRelease(held);
  return {
    released: true,
    message:
      `warning: released repository lock at ${repoLockDir()} (may corrupt workflow state if still active)`,
  };
}

export async function forceReleaseBoardLock(
  repoRoot: string,
  boardName: string,
  force: boolean,
): Promise<ForceReleaseResult> {
  const rel = boardLockDir(boardName);
  const path = `${repoRoot}/${rel}`;
  const exists = await lockExists(path);
  if (!exists) {
    return {
      released: false,
      message: `no board lock for "${boardName}" at ${rel}`,
    };
  }
  if (!force) {
    throw new Error(
      `board lock exists for "${boardName}" at ${rel}; pass --force to release (may corrupt workflow state)`,
    );
  }
  await Deno.remove(path);
  const held = findHeldLock({ kind: "board", boardName });
  if (held) untrackRelease(held);
  return {
    released: true,
    message:
      `warning: released board lock for "${boardName}" at ${rel} (may corrupt workflow state if still active)`,
  };
}

export async function forceReleaseCardLock(
  repoRoot: string,
  boardName: string,
  cardId: string,
  force: boolean,
): Promise<ForceReleaseResult> {
  const rel = cardLockDir(boardName, cardId);
  const path = `${repoRoot}/${rel}`;
  const exists = await lockExists(path);
  if (!exists) {
    return {
      released: false,
      message: `no card lock for "${cardId}" at ${rel}`,
    };
  }
  if (!force) {
    throw new Error(
      `card lock exists for "${cardId}" at ${rel}; pass --force to release (may corrupt workflow state)`,
    );
  }
  await Deno.remove(path);
  const held = findHeldLock({ kind: "card", boardName, cardId });
  if (held) untrackRelease(held);
  return {
    released: true,
    message:
      `warning: released card lock for "${cardId}" at ${rel} (may corrupt workflow state if still active)`,
  };
}

setInterruptHandler(async () => {
  if (lastRepoRoot) {
    await releaseAllHeldLocksInternal(lastRepoRoot);
  }
});
