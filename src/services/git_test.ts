import { assertRejects } from "@std/assert";
import { withTempGitRepo } from "../../test/helpers/git-repo.ts";
import { assertGitAdvanceAllowed } from "./git.ts";

Deno.test("assertGitAdvanceAllowed passes on clean repo (req §13.8)", async () => {
  await withTempGitRepo(async (dir) => {
    await assertGitAdvanceAllowed(dir);
  });
});

Deno.test("assertGitAdvanceAllowed rejects merge state (req §13.8)", async () => {
  await withTempGitRepo(async (dir) => {
    await Deno.mkdir(`${dir}/.git`, { recursive: true });
    await Deno.writeTextFile(`${dir}/.git/MERGE_HEAD`, "deadbeef\n");
    await assertRejects(
      () => assertGitAdvanceAllowed(dir),
      Error,
      "unresolved merge",
    );
  });
});
