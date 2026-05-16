import { assertEquals } from "@std/assert";
import { DEVFLOW_GITIGNORE_PATTERNS } from "../infra/gitignore.ts";
import { validateRepoOnDisk } from "./validate-repo.ts";
import { withTempGitRepo } from "../../test/helpers/git-repo.ts";

Deno.test("validateRepoOnDisk passes with devflow and gitignore (req §17.3)", async () => {
  await withTempGitRepo(async (dir) => {
    await Deno.mkdir(`${dir}/.devflow/boards`, { recursive: true });
    const patterns = DEVFLOW_GITIGNORE_PATTERNS.join("\n") + "\n";
    await Deno.writeTextFile(`${dir}/.gitignore`, patterns);
    assertEquals(await validateRepoOnDisk(dir), []);
  });
});

Deno.test("validateRepoOnDisk reports missing gitignore patterns", async () => {
  await withTempGitRepo(async (dir) => {
    await Deno.mkdir(`${dir}/.devflow`, { recursive: true });
    await Deno.writeTextFile(`${dir}/.gitignore`, "# empty\n");
    const problems = await validateRepoOnDisk(dir);
    assertEquals(problems.length >= 2, true);
    assertEquals(
      problems.some((p) => p.includes(".devflow/.lock/")),
      true,
    );
  });
});

Deno.test("validateRepoOnDisk reports missing .devflow", async () => {
  await withTempGitRepo(async (dir) => {
    const patterns = DEVFLOW_GITIGNORE_PATTERNS.join("\n") + "\n";
    await Deno.writeTextFile(`${dir}/.gitignore`, patterns);
    const problems = await validateRepoOnDisk(dir);
    assertEquals(
      problems.some((p) => p.includes(".devflow")),
      true,
    );
  });
});
