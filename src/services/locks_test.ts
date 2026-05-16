import { assertRejects } from "@std/assert";
import { initBoard } from "../commands/init-board.ts";
import { acquireRepoLock, releaseRepoLock } from "./locks.ts";
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
