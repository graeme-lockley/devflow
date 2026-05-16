import { assertEquals, assertRejects } from "@std/assert";
import { initBoard } from "../commands/init-board.ts";
import {
  acquireBoardLock,
  acquireCardLock,
  acquireRepoLock,
  releaseAllHeldLocks,
  releaseBoardLock,
  releaseCardLock,
  releaseRepoLock,
} from "./locks.ts";
import { repoLockDir } from "../infra/paths.ts";

Deno.test("acquireRepoLock fails when lock already held", async () => {
  const dir = await Deno.makeTempDir();
  await acquireRepoLock(dir);
  try {
    await assertRejects(
      () => acquireRepoLock(dir),
      Error,
      "repository lock held",
    );
  } finally {
    await releaseRepoLock(dir);
  }
});

Deno.test("acquireBoardLock fails when lock already held (req §14.4)", async () => {
  const dir = await Deno.makeTempDir();
  await initBoard("stories", ["todo"], dir);
  await acquireBoardLock(dir, "stories");
  try {
    await assertRejects(
      () => acquireBoardLock(dir, "stories"),
      Error,
      "board lock held",
    );
  } finally {
    await releaseBoardLock(dir, "stories");
  }
});

Deno.test("acquireCardLock fails when lock already held (req §14.4)", async () => {
  const dir = await Deno.makeTempDir();
  await initBoard("stories", ["todo"], dir);
  const cardId = "stories-000001";
  const cardDir = `${dir}/.devflow/boards/stories/cards/${cardId}`;
  await Deno.mkdir(cardDir, { recursive: true });
  await acquireCardLock(dir, "stories", cardId);
  try {
    await assertRejects(
      () => acquireCardLock(dir, "stories", cardId),
      Error,
      "card lock held",
    );
  } finally {
    await releaseCardLock(dir, "stories", cardId);
  }
});

Deno.test("acquireCardLock with ignoreLock skips acquire (req §16.1)", async () => {
  const dir = await Deno.makeTempDir();
  await initBoard("stories", ["todo"], dir);
  const cardId = "stories-000001";
  const cardDir = `${dir}/.devflow/boards/stories/cards/${cardId}`;
  await Deno.mkdir(cardDir, { recursive: true });
  await acquireCardLock(dir, "stories", cardId);
  const acquired = await acquireCardLock(dir, "stories", cardId, {
    ignoreLock: true,
  });
  assertEquals(acquired, false);
  await releaseCardLock(dir, "stories", cardId);
});

Deno.test("releaseAllHeldLocks releases repo and card locks", async () => {
  const dir = await Deno.makeTempDir();
  await initBoard("stories", ["todo"], dir);
  const cardId = "stories-000001";
  const cardDir = `${dir}/.devflow/boards/stories/cards/${cardId}`;
  await Deno.mkdir(cardDir, { recursive: true });
  await acquireRepoLock(dir);
  await acquireCardLock(dir, "stories", cardId);
  await releaseAllHeldLocks(dir);
  for (
    const path of [
      `${dir}/${repoLockDir()}`,
      `${dir}/.devflow/boards/stories/cards/${cardId}/.lock`,
    ]
  ) {
    let found = false;
    try {
      await Deno.stat(path);
      found = true;
    } catch (e) {
      if (!(e instanceof Deno.errors.NotFound)) throw e;
    }
    if (found) throw new Error(`lock still present: ${path}`);
  }
});

Deno.test("initBoard releases repo lock after success", async () => {
  const dir = await Deno.makeTempDir();
  await initBoard("stories", ["todo"], dir);
  const lockPath = `${dir}/${repoLockDir()}`;
  let found = true;
  try {
    await Deno.stat(lockPath);
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) found = false;
    else throw e;
  }
  if (found) {
    throw new Error("repo lock was not released after initBoard");
  }
});
