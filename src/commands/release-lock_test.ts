import { assertEquals, assertRejects } from "@std/assert";
import { initBoard } from "./init-board.ts";
import { createCard } from "./create-card.ts";
import { releaseCardLockCommand } from "./release-card-lock.ts";
import { releaseBoardLockCommand } from "./release-board-lock.ts";
import { releaseRepoLockCommand } from "./release-repo-lock.ts";
import {
  acquireBoardLock,
  acquireCardLock,
  acquireRepoLock,
  releaseCardLock,
} from "../services/locks.ts";
import { boardLockDir, cardLockDir, repoLockDir } from "../infra/paths.ts";

Deno.test("releaseCardLockCommand idempotent when no lock (req §14.6)", async () => {
  const dir = await Deno.makeTempDir();
  await initBoard("stories", ["todo"], dir);
  const cardId = await createCard("stories", "Test", dir);
  const msg = await releaseCardLockCommand(cardId, dir, false);
  assertEquals(msg.includes("no card lock"), true);
});

Deno.test("releaseCardLockCommand requires --force when lock present", async () => {
  const dir = await Deno.makeTempDir();
  await initBoard("stories", ["todo"], dir);
  const cardId = await createCard("stories", "Test", dir);
  await acquireCardLock(dir, "stories", cardId);
  try {
    await assertRejects(
      () => releaseCardLockCommand(cardId, dir, false),
      Error,
      "pass --force",
    );
  } finally {
    await releaseCardLock(dir, "stories", cardId);
  }
});

Deno.test("releaseCardLockCommand with --force removes lock", async () => {
  const dir = await Deno.makeTempDir();
  await initBoard("stories", ["todo"], dir);
  const cardId = await createCard("stories", "Test", dir);
  await acquireCardLock(dir, "stories", cardId);
  const msg = await releaseCardLockCommand(cardId, dir, true);
  assertEquals(msg.includes("warning:"), true);
  let exists = true;
  try {
    await Deno.stat(`${dir}/${cardLockDir("stories", cardId)}`);
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) exists = false;
    else throw e;
  }
  assertEquals(exists, false);
});

Deno.test("releaseBoardLockCommand with --force (req §14.6)", async () => {
  const dir = await Deno.makeTempDir();
  await initBoard("stories", ["todo"], dir);
  await acquireBoardLock(dir, "stories");
  const msg = await releaseBoardLockCommand("stories", dir, true);
  assertEquals(msg.includes("warning:"), true);
  let exists = true;
  try {
    await Deno.stat(`${dir}/${boardLockDir("stories")}`);
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) exists = false;
    else throw e;
  }
  assertEquals(exists, false);
});

Deno.test("releaseRepoLockCommand with --force (req §14.6)", async () => {
  const dir = await Deno.makeTempDir();
  await acquireRepoLock(dir);
  const msg = await releaseRepoLockCommand(dir, true);
  assertEquals(msg.includes("warning:"), true);
  let exists = true;
  try {
    await Deno.stat(`${dir}/${repoLockDir()}`);
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) exists = false;
    else throw e;
  }
  assertEquals(exists, false);
});
