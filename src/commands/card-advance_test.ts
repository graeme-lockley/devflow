import { assertEquals } from "@std/assert";
import {
  countCommits,
  latestCommitSubject,
  withTempGitRepo,
} from "../../test/helpers/git-repo.ts";
import { initBoard } from "./init-board.ts";
import { createCard } from "./create-card.ts";
import { advanceCard } from "./card-advance.ts";
import { blockCard } from "./block-card.ts";
import { loadCardState } from "../domain/card.ts";
import { fallbackCommitMessage } from "../services/scripts.ts";
import { boardScriptsDir } from "../infra/paths.ts";
import { runCli } from "../cli/dispatch.ts";

async function setupBoard(
  repoRoot: string,
  phases: string[],
): Promise<string> {
  await initBoard("test", phases, repoRoot);
  return await createCard("test", "Test card", repoRoot);
}

async function writeScript(
  repoRoot: string,
  boardName: string,
  name: string,
  body: string,
): Promise<void> {
  const scriptsDir = `${repoRoot}/${boardScriptsDir(boardName)}`;
  const path = `${scriptsDir}/${name}`;
  await Deno.writeTextFile(path, body);
  await Deno.chmod(path, 0o755);
}

Deno.test("advanceCard single-hop updates phase (req §11.4)", async () => {
  await withTempGitRepo(async (dir) => {
    const cardId = await setupBoard(dir, ["a", "b", "c"]);
    await writeScript(
      dir,
      "test",
      "a-001-pass",
      "#!/usr/bin/env bash\nexit 0\n",
    );

    const result = await advanceCard(cardId, "b", dir);
    assertEquals(result.exitCode, 0);

    const state = await loadCardState(dir, "test", cardId);
    assertEquals(state.phase, "b");
    const changed = state.history.filter((e) =>
      typeof e === "object" && e !== null && "type" in e &&
      e.type === "phaseChanged"
    );
    assertEquals(changed.length, 1);
  });
});

Deno.test("advanceCard creates one git commit per hop (req §13.5)", async () => {
  await withTempGitRepo(async (dir) => {
    const cardId = await setupBoard(dir, ["a", "b"]);
    await writeScript(
      dir,
      "test",
      "a-001-pass",
      "#!/usr/bin/env bash\nexit 0\n",
    );

    const before = await countCommits(dir);
    const result = await advanceCard(cardId, "b", dir);
    assertEquals(result.exitCode, 0);
    assertEquals(await countCommits(dir), before + 1);
    assertEquals(
      await latestCommitSubject(dir),
      fallbackCommitMessage(cardId, "a", "b"),
    );
  });
});

Deno.test("advanceCard multi-hop creates run dirs (req §11.3)", async () => {
  await withTempGitRepo(async (dir) => {
    const cardId = await setupBoard(dir, ["a", "b", "c"]);
    for (const phase of ["a", "b"]) {
      await writeScript(
        dir,
        "test",
        `${phase}-001-pass`,
        "#!/usr/bin/env bash\nexit 0\n",
      );
    }

    const result = await advanceCard(cardId, "c", dir);
    assertEquals(result.exitCode, 0);

    const state = await loadCardState(dir, "test", cardId);
    assertEquals(state.phase, "c");

    const logsDir = `${dir}/.devflow/boards/test/cards/${cardId}/logs`;
    let runCount = 0;
    for await (const entry of Deno.readDir(logsDir)) {
      if (entry.isDirectory && entry.name.includes("-advance-")) runCount++;
    }
    assertEquals(runCount, 2);
  });
});

Deno.test("advanceCard script failure (req §11.5)", async () => {
  await withTempGitRepo(async (dir) => {
    const cardId = await setupBoard(dir, ["a", "b"]);
    await writeScript(
      dir,
      "test",
      "a-001-fail",
      "#!/usr/bin/env bash\nexit 1\n",
    );

    const result = await advanceCard(cardId, "b", dir);
    assertEquals(result.exitCode, 1);
    assertEquals(result.failureOutput?.includes("a-001-fail"), true);

    const state = await loadCardState(dir, "test", cardId);
    assertEquals(state.phase, "a");
    const failed = state.history.filter((e) =>
      typeof e === "object" && e !== null && "type" in e &&
      e.type === "transitionFailed"
    );
    assertEquals(failed.length, 1);
  });
});

Deno.test("advanceCard rejects backward target (req §11.7)", async () => {
  await withTempGitRepo(async (dir) => {
    const cardId = await setupBoard(dir, ["a", "b", "c"]);
    await writeScript(
      dir,
      "test",
      "a-001-pass",
      "#!/usr/bin/env bash\nexit 0\n",
    );
    await advanceCard(cardId, "b", dir);

    let threw = false;
    try {
      await advanceCard(cardId, "a", dir);
    } catch (e) {
      threw = true;
      const msg = e instanceof Error ? e.message : String(e);
      assertEquals(msg.includes("behind"), true);
    }
    assertEquals(threw, true);
  });
});

Deno.test("advanceCard force moves backward without commit (req §11.8)", async () => {
  await withTempGitRepo(async (dir) => {
    const cardId = await setupBoard(dir, ["a", "b", "c"]);
    await writeScript(
      dir,
      "test",
      "a-001-pass",
      "#!/usr/bin/env bash\nexit 0\n",
    );
    await advanceCard(cardId, "b", dir);
    const before = await countCommits(dir);

    const result = await advanceCard(cardId, "a", dir, { force: true });
    assertEquals(result.exitCode, 0);
    assertEquals(await countCommits(dir), before);

    const state = await loadCardState(dir, "test", cardId);
    assertEquals(state.phase, "a");
    const forced = state.history.filter((e) =>
      typeof e === "object" && e !== null && "type" in e &&
      e.type === "phaseChanged" && "mode" in e && e.mode === "force"
    );
    assertEquals(forced.length, 1);
  });
});

Deno.test("advanceCard blocked card (req §12.3)", async () => {
  await withTempGitRepo(async (dir) => {
    const cardId = await setupBoard(dir, ["a", "b"]);
    await blockCard(cardId, "waiting", dir);

    let threw = false;
    try {
      await advanceCard(cardId, "b", dir);
    } catch (e) {
      threw = true;
      const msg = e instanceof Error ? e.message : String(e);
      assertEquals(msg.includes("blocked"), true);
    }
    assertEquals(threw, true);
  });
});

Deno.test("advanceCard already at target (req §11.6)", async () => {
  await withTempGitRepo(async (dir) => {
    const cardId = await setupBoard(dir, ["a", "b"]);
    const result = await advanceCard(cardId, "a", dir);
    assertEquals(result.exitCode, 0);
    assertEquals(result.message?.includes("already"), true);
  });
});

Deno.test("runCli card advance (req §16)", async () => {
  await withTempGitRepo(async (dir) => {
    const original = Deno.cwd();
    try {
      Deno.chdir(dir);
      assertEquals(
        await runCli(["board", "init", "test", "a", "b"]),
        0,
      );
      const createOut = await runCli(["card", "create", "test", "Title"]);
      assertEquals(createOut, 0);

      await writeScript(
        dir,
        "test",
        "a-001-pass",
        "#!/usr/bin/env bash\nexit 0\n",
      );

      assertEquals(await runCli(["card", "advance", "test-000001", "b"]), 0);
    } finally {
      Deno.chdir(original);
    }
  });
});

Deno.test("runCli card advance --force (req §11.8)", async () => {
  await withTempGitRepo(async (dir) => {
    const original = Deno.cwd();
    try {
      Deno.chdir(dir);
      await runCli(["board", "init", "test", "a", "b", "c"]);
      await runCli(["card", "create", "test", "Title"]);
      await writeScript(
        dir,
        "test",
        "a-001-pass",
        "#!/usr/bin/env bash\nexit 0\n",
      );
      await runCli(["card", "advance", "test-000001", "b"]);
      assertEquals(
        await runCli(["card", "advance", "test-000001", "a", "--force"]),
        0,
      );
      const state = await loadCardState(dir, "test", "test-000001");
      assertEquals(state.phase, "a");
    } finally {
      Deno.chdir(original);
    }
  });
});
