import { assertEquals } from "@std/assert";
import { initBoard } from "./init-board.ts";
import { createCard } from "./create-card.ts";
import { loadBoardConfig } from "../domain/board.ts";
import { loadCardState } from "../domain/card.ts";
import { cardFilesDir, cardLogsDir, cardMdFile } from "../infra/paths.ts";
import { withTempGitRepo } from "../../test/helpers/git-repo.ts";
import { runCli } from "../cli/dispatch.ts";

Deno.test("createCard allocates ID and layout (req §6.2, §6.3)", async () => {
  const dir = await Deno.makeTempDir();
  await initBoard("stories", ["todo", "done"], dir);

  const cardId = await createCard("stories", "Add beneficiary validation", dir);
  assertEquals(cardId, "stories-000001");

  const config = await loadBoardConfig(dir, "stories");
  assertEquals(config.nextSequence, 2);

  const state = await loadCardState(dir, "stories", cardId);
  assertEquals(state.title, "Add beneficiary validation");
  assertEquals(state.phase, "todo");

  const md = await Deno.readTextFile(`${dir}/${cardMdFile("stories", cardId)}`);
  assertEquals(md, "# Add beneficiary validation\n");

  for (const sub of [cardFilesDir, cardLogsDir]) {
    const s = await Deno.stat(`${dir}/${sub("stories", cardId)}`);
    assertEquals(s.isDirectory, true);
  }
});

Deno.test("createCard fails when sequence exhausted (req §5.7)", async () => {
  const dir = await Deno.makeTempDir();
  await initBoard("stories", ["todo"], dir, { sequenceWidth: 1 });
  const config = await loadBoardConfig(dir, "stories");
  config.nextSequence = 10;
  const { saveBoardConfig } = await import("../domain/board.ts");
  await saveBoardConfig(dir, config);

  let threw = false;
  try {
    await createCard("stories", "Too many", dir);
  } catch (e) {
    threw = true;
    const msg = e instanceof Error ? e.message : String(e);
    assertEquals(msg.includes("sequence exhausted"), true);
  }
  assertEquals(threw, true);
});

Deno.test("runCli card create outputs ID without ANSI (req §16.4)", async () => {
  const projectRoot = new URL("../..", import.meta.url).pathname;
  const mainTs = `${projectRoot}/main.ts`;

  await withTempGitRepo(async (dir) => {
    const original = Deno.cwd();
    try {
      Deno.chdir(dir);
      assertEquals(
        await runCli(["board", "init", "stories", "todo", "done"]),
        0,
      );

      const { code, stdout } = await new Deno.Command(Deno.execPath(), {
        args: [
          "run",
          "--allow-read",
          "--allow-write",
          "--allow-run",
          "--allow-env",
          mainTs,
          "card",
          "create",
          "stories",
          "My card",
        ],
        cwd: dir,
        stdout: "piped",
        stderr: "piped",
      }).output();
      assertEquals(code, 0);
      const out = new TextDecoder().decode(stdout);
      assertEquals(out.includes("\x1b"), false);
      assertEquals(out.trim(), "stories-000001");
    } finally {
      Deno.chdir(original);
    }
  });
});
