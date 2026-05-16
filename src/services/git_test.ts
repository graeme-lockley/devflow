import { assertEquals, assertRejects } from "@std/assert";
import { withTempGitRepo } from "../../test/helpers/git-repo.ts";
import {
  assertGitAdvanceAllowed,
  commit,
  defaultCommitMessage,
  stageAll,
} from "./git.ts";

Deno.test("assertGitAdvanceAllowed passes on clean repo (req §13.8)", async () => {
  await withTempGitRepo(async (dir) => {
    await assertGitAdvanceAllowed(dir);
  });
});

async function assertRejectsGitState(
  marker: string,
  expected: string,
): Promise<void> {
  await withTempGitRepo(async (dir) => {
    await Deno.writeTextFile(`${dir}/.git/${marker}`, "deadbeef\n");
    await assertRejects(
      () => assertGitAdvanceAllowed(dir),
      Error,
      expected,
    );
  });
}

Deno.test("assertGitAdvanceAllowed rejects merge state (req §13.8)", () =>
  assertRejectsGitState("MERGE_HEAD", "unresolved merge"));

Deno.test("assertGitAdvanceAllowed rejects rebase state (req §13.8)", () =>
  assertRejectsGitState("REBASE_HEAD", "unresolved rebase"));

Deno.test("assertGitAdvanceAllowed rejects cherry-pick state (req §13.8)", () =>
  assertRejectsGitState("CHERRY_PICK_HEAD", "unresolved cherry_pick"));

Deno.test("assertGitAdvanceAllowed rejects revert state (req §13.8)", () =>
  assertRejectsGitState("REVERT_HEAD", "unresolved revert"));

Deno.test("defaultCommitMessage (req §13.4)", () => {
  assertEquals(
    defaultCommitMessage("stories-000001", "planning", "planned"),
    "Advance stories-000001 from planning to planned",
  );
});

Deno.test("stageAll and commit create a commit (req §13.5)", async () => {
  await withTempGitRepo(async (dir) => {
    await Deno.writeTextFile(`${dir}/tracked.txt`, "hello\n");
    await stageAll(dir);
    const countBefore = await new Deno.Command("git", {
      args: ["rev-list", "--count", "HEAD"],
      cwd: dir,
      stdout: "piped",
    }).output();
    const before = Number(
      new TextDecoder().decode(countBefore.stdout).trim(),
    );

    const msg = "test commit message";
    await commit(dir, msg);

    const log = await new Deno.Command("git", {
      args: ["log", "-1", "--format=%s"],
      cwd: dir,
      stdout: "piped",
    }).output();
    assertEquals(new TextDecoder().decode(log.stdout).trim(), msg);

    const count = await new Deno.Command("git", {
      args: ["rev-list", "--count", "HEAD"],
      cwd: dir,
      stdout: "piped",
    }).output();
    const after = Number(new TextDecoder().decode(count.stdout).trim());
    assertEquals(after, before + 1);
  });
});
