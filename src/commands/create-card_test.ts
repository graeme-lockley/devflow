import { assertEquals, assertRejects } from "@std/assert";
import { initBoard } from "./init-board.ts";
import { createCard } from "./create-card.ts";
import { acquireBoardLock, releaseBoardLock } from "../services/locks.ts";
import { loadBoardConfig } from "../domain/board.ts";
import { loadCardState } from "../domain/card.ts";
import {
  boardCardsDir,
  cardFilesDir,
  cardLogsDir,
  cardMdFile,
} from "../infra/paths.ts";
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

Deno.test("createCard fails when board lock held (req §14.4)", async () => {
  const dir = await Deno.makeTempDir();
  await initBoard("stories", ["todo"], dir);
  await acquireBoardLock(dir, "stories");
  try {
    await assertRejects(
      () => createCard("stories", "Second card", dir),
      Error,
      "board lock held",
    );
  } finally {
    await releaseBoardLock(dir, "stories");
  }
});

Deno.test("createCard writes description inline body (req §6.2)", async () => {
  const dir = await Deno.makeTempDir();
  await initBoard("stories", ["todo", "done"], dir);

  const cardId = await createCard(
    "stories",
    "T",
    dir,
    "hello world",
  );
  const md = await Deno.readTextFile(`${dir}/${cardMdFile("stories", cardId)}`);
  assertEquals(md, "# T\n\nhello world\n");
});

Deno.test("createCard normalises trailing newlines on description (req §6.2)", async () => {
  const dir = await Deno.makeTempDir();
  await initBoard("stories", ["todo", "done"], dir);

  const cardId = await createCard(
    "stories",
    "T",
    dir,
    "line1\nline2\n\n",
  );
  const md = await Deno.readTextFile(`${dir}/${cardMdFile("stories", cardId)}`);
  assertEquals(md, "# T\n\nline1\nline2\n");
});

async function listBoardCards(dir: string, board: string): Promise<string[]> {
  const out: string[] = [];
  for await (const e of Deno.readDir(`${dir}/${boardCardsDir(board)}`)) {
    out.push(e.name);
  }
  return out.sort();
}

Deno.test("runCli card create: --description-file writes body (req §6.2, §16.4)", async () => {
  await withTempGitRepo(async (dir) => {
    const original = Deno.cwd();
    try {
      Deno.chdir(dir);
      assertEquals(
        await runCli(["board", "init", "stories", "todo", "done"]),
        0,
      );
      const file = `${dir}/desc.txt`;
      await Deno.writeTextFile(file, "line1\nline2\n\n");

      assertEquals(
        await runCli([
          "card",
          "create",
          "stories",
          "T",
          "--description-file",
          file,
        ]),
        0,
      );
      const md = await Deno.readTextFile(
        `${dir}/${cardMdFile("stories", "stories-000001")}`,
      );
      assertEquals(md, "# T\n\nline1\nline2\n");

      const config = await loadBoardConfig(dir, "stories");
      assertEquals(config.nextSequence, 2);
    } finally {
      Deno.chdir(original);
    }
  });
});

Deno.test("runCli card create: mutual exclusion fails atomically (req §6.2)", async () => {
  await withTempGitRepo(async (dir) => {
    const original = Deno.cwd();
    try {
      Deno.chdir(dir);
      assertEquals(
        await runCli(["board", "init", "stories", "todo"]),
        0,
      );

      assertEquals(
        await runCli([
          "card",
          "create",
          "stories",
          "T",
          "--description",
          "a",
          "--description-file",
          "/tmp/whatever",
        ]),
        1,
      );

      const config = await loadBoardConfig(dir, "stories");
      assertEquals(config.nextSequence, 1);
      assertEquals(await listBoardCards(dir, "stories"), []);
    } finally {
      Deno.chdir(original);
    }
  });
});

Deno.test("runCli card create: missing --description-file path is atomic", async () => {
  await withTempGitRepo(async (dir) => {
    const original = Deno.cwd();
    try {
      Deno.chdir(dir);
      assertEquals(
        await runCli(["board", "init", "stories", "todo"]),
        0,
      );

      assertEquals(
        await runCli([
          "card",
          "create",
          "stories",
          "T",
          "--description-file",
          `${dir}/missing.txt`,
        ]),
        1,
      );

      const config = await loadBoardConfig(dir, "stories");
      assertEquals(config.nextSequence, 1);
      assertEquals(await listBoardCards(dir, "stories"), []);
    } finally {
      Deno.chdir(original);
    }
  });
});

Deno.test("runCli card create: empty description is atomic", async () => {
  await withTempGitRepo(async (dir) => {
    const original = Deno.cwd();
    try {
      Deno.chdir(dir);
      assertEquals(
        await runCli(["board", "init", "stories", "todo"]),
        0,
      );
      const file = `${dir}/empty.txt`;
      await Deno.writeTextFile(file, "");

      assertEquals(
        await runCli([
          "card",
          "create",
          "stories",
          "T",
          "--description-file",
          file,
        ]),
        1,
      );
      assertEquals(
        await runCli([
          "card",
          "create",
          "stories",
          "T",
          "--description",
          "",
        ]),
        1,
      );

      const config = await loadBoardConfig(dir, "stories");
      assertEquals(config.nextSequence, 1);
      assertEquals(await listBoardCards(dir, "stories"), []);
    } finally {
      Deno.chdir(original);
    }
  });
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
