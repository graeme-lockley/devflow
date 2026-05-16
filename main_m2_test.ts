import { assertEquals } from "@std/assert";
import { runCli } from "./src/cli/dispatch.ts";
import { withTempGitRepo } from "./test/helpers/git-repo.ts";

const projectRoot = new URL(".", import.meta.url).pathname;

async function runDevflow(
  cwd: string,
  args: string[],
): Promise<{ code: number; stdout: string; stderr: string }> {
  const { code, stdout, stderr } = await new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-run",
      "--allow-env",
      `${projectRoot}main.ts`,
      ...args,
    ],
    cwd,
    stdout: "piped",
    stderr: "piped",
  }).output();
  return {
    code,
    stdout: new TextDecoder().decode(stdout),
    stderr: new TextDecoder().decode(stderr),
  };
}

Deno.test("M2 e2e: create → show → set variable → add-file → validate (req §17.2)", async () => {
  await withTempGitRepo(async (dir) => {
    const original = Deno.cwd();
    try {
      Deno.chdir(dir);
      assertEquals(
        await runCli(["board", "init", "stories", "todo", "done"]),
        0,
      );

      const create = await runDevflow(dir, [
        "card",
        "create",
        "stories",
        "Beneficiary Add",
      ]);
      assertEquals(create.code, 0);
      assertEquals(create.stdout.includes("\x1b"), false);
      const cardId = create.stdout.trim();
      assertEquals(cardId, "stories-000001");

      assertEquals(await runCli(["card", "show", cardId]), 0);

      assertEquals(
        await runCli(["variable", "set", cardId, "SESSION_ID", "abc123"]),
        0,
      );

      const attachSrc = `${dir}/contract.pdf`;
      await Deno.writeTextFile(attachSrc, "pdf-bytes");
      assertEquals(
        await runCli(["card", "add-file", cardId, attachSrc]),
        0,
      );

      assertEquals(await runCli(["card", "validate", cardId]), 0);

      const getVar = await runDevflow(dir, [
        "variable",
        "get",
        cardId,
        "SESSION_ID",
      ]);
      assertEquals(getVar.code, 0);
      assertEquals(getVar.stdout.includes("\x1b"), false);
      assertEquals(getVar.stdout, "abc123");

      const cardDirOut = await runDevflow(dir, ["card", "dir", cardId]);
      assertEquals(cardDirOut.code, 0);
      assertEquals(cardDirOut.stdout.includes("\x1b"), false);
      assertEquals(
        cardDirOut.stdout.trim().endsWith(`/cards/${cardId}`),
        true,
      );
    } finally {
      Deno.chdir(original);
    }
  });
});
