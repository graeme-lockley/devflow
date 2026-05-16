import { assertEquals } from "@std/assert";
import { withTempGitRepo } from "../../test/helpers/git-repo.ts";

const ANSI_RE = new RegExp(String.fromCharCode(27) + "\\[");
const projectRoot = new URL("../..", import.meta.url).pathname;
const mainTs = `${projectRoot}/main.ts`;

const denoArgs = [
  "run",
  "--allow-read",
  "--allow-write",
  "--allow-run",
  "--allow-env",
  mainTs,
];

async function runCliStdout(
  dir: string,
  cliArgs: string[],
): Promise<string> {
  const { code, stdout } = await new Deno.Command(Deno.execPath(), {
    args: [...denoArgs, ...cliArgs],
    cwd: dir,
    stdout: "piped",
    stderr: "piped",
  }).output();
  assertEquals(code, 0);
  return new TextDecoder().decode(stdout);
}

Deno.test("machine stdout has no ANSI: card create (req §16.4)", async () => {
  await withTempGitRepo(async (dir) => {
    await runCliStdout(dir, ["board", "init", "stories", "todo", "done"]);
    const out = await runCliStdout(dir, [
      "card",
      "create",
      "stories",
      "My card",
    ]);
    assertEquals(ANSI_RE.test(out), false);
    assertEquals(out.trim(), "stories-000001");
  });
});

Deno.test("machine stdout has no ANSI: card dir (req §16.4)", async () => {
  await withTempGitRepo(async (dir) => {
    await runCliStdout(dir, ["board", "init", "stories", "todo", "done"]);
    await runCliStdout(dir, ["card", "create", "stories", "My card"]);
    const out = await runCliStdout(dir, ["card", "dir", "stories-000001"]);
    assertEquals(ANSI_RE.test(out), false);
    assertEquals(out.endsWith("\n"), true);
    assertEquals(out.includes("stories-000001"), true);
  });
});

Deno.test("machine stdout has no ANSI: variable get (req §16.4)", async () => {
  await withTempGitRepo(async (dir) => {
    await runCliStdout(dir, ["board", "init", "stories", "todo", "done"]);
    await runCliStdout(dir, ["card", "create", "stories", "My card"]);
    await runCliStdout(dir, [
      "variable",
      "set",
      "stories-000001",
      "FOO",
      "bar",
    ]);
    const out = await runCliStdout(dir, [
      "variable",
      "get",
      "stories-000001",
      "FOO",
    ]);
    assertEquals(ANSI_RE.test(out), false);
    assertEquals(out, "bar");
  });
});

Deno.test("machine stdout has no ANSI: board list (req §16.4)", async () => {
  await withTempGitRepo(async (dir) => {
    await runCliStdout(dir, ["board", "init", "stories", "todo", "done"]);
    const out = await runCliStdout(dir, ["board", "list"]);
    assertEquals(ANSI_RE.test(out), false);
    assertEquals(out.trim(), "stories");
  });
});

Deno.test("machine stdout has no ANSI: card list (req §16.4)", async () => {
  await withTempGitRepo(async (dir) => {
    await runCliStdout(dir, ["board", "init", "stories", "todo", "done"]);
    await runCliStdout(dir, ["card", "create", "stories", "My card"]);
    const out = await runCliStdout(dir, ["card", "list", "stories"]);
    assertEquals(ANSI_RE.test(out), false);
    assertEquals(out.trim(), "stories-000001");
  });
});
