import { assertEquals } from "@std/assert";
import { withTempGitRepo } from "../../test/helpers/git-repo.ts";
import { initBoard } from "../commands/init-board.ts";
import { createCard } from "../commands/create-card.ts";
import { loadBoardConfig } from "../domain/board.ts";
import { loadCardState } from "../domain/card.ts";
import { fallbackCommitMessage } from "./scripts.ts";
import { boardScriptsDir } from "../infra/paths.ts";
import { runAdvance } from "./transition.ts";

async function writeScript(
  scriptsDir: string,
  name: string,
  body: string,
): Promise<void> {
  const path = `${scriptsDir}/${name}`;
  await Deno.writeTextFile(path, body);
  await Deno.chmod(path, 0o755);
}

Deno.test("runAdvance single-hop success (req §11.4)", async () => {
  await withTempGitRepo(async (dir) => {
    await initBoard("test", ["a", "b", "c"], dir);
    const cardId = await createCard("test", "Card", dir);
    const board = await loadBoardConfig(dir, "test");

    const scriptsDir = `${dir}/${boardScriptsDir("test")}`;
    await writeScript(
      scriptsDir,
      "a-001-pass",
      "#!/usr/bin/env bash\nexit 0\n",
    );

    let state = await loadCardState(dir, "test", cardId);
    const result = await runAdvance({
      repoRoot: dir,
      board,
      state,
      targetPhase: "b",
    });

    assertEquals(result.ok, true);
    if (result.ok) {
      state = result.state;
      assertEquals(state.phase, "b");
      assertEquals(result.hops, 1);
      const phaseEvents = state.history.filter((e) =>
        typeof e === "object" && e !== null && "type" in e &&
        e.type === "phaseChanged"
      );
      assertEquals(phaseEvents.length, 1);
    }
  });
});

Deno.test("runAdvance stops on script failure (req §11.5)", async () => {
  await withTempGitRepo(async (dir) => {
    await initBoard("test", ["a", "b", "c"], dir);
    const cardId = await createCard("test", "Card", dir);
    const board = await loadBoardConfig(dir, "test");

    const scriptsDir = `${dir}/${boardScriptsDir("test")}`;
    await writeScript(
      scriptsDir,
      "a-001-pass",
      "#!/usr/bin/env bash\nexit 0\n",
    );
    await writeScript(
      scriptsDir,
      "a-002-fail",
      "#!/usr/bin/env bash\nexit 1\n",
    );

    const state = await loadCardState(dir, "test", cardId);
    const result = await runAdvance({
      repoRoot: dir,
      board,
      state,
      targetPhase: "c",
    });

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.state.phase, "a");
      assertEquals(result.failure.kind, "script");
      if (result.failure.kind === "script") {
        assertEquals(result.failure.script, "a-002-fail");
      }
      const failed = result.state.history.filter((e) =>
        typeof e === "object" && e !== null && "type" in e &&
        e.type === "transitionFailed"
      );
      assertEquals(failed.length, 1);
    }
  });
});

Deno.test("runAdvance multi-hop partial failure (req §11.3)", async () => {
  await withTempGitRepo(async (dir) => {
    await initBoard("test", ["a", "b", "c"], dir);
    const cardId = await createCard("test", "Card", dir);
    const board = await loadBoardConfig(dir, "test");

    const scriptsDir = `${dir}/${boardScriptsDir("test")}`;
    await writeScript(
      scriptsDir,
      "a-001-pass",
      "#!/usr/bin/env bash\nexit 0\n",
    );
    await writeScript(
      scriptsDir,
      "b-001-fail",
      "#!/usr/bin/env bash\nexit 1\n",
    );

    const state = await loadCardState(dir, "test", cardId);
    const result = await runAdvance({
      repoRoot: dir,
      board,
      state,
      targetPhase: "c",
    });

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.state.phase, "b");
      assertEquals(result.failure.kind, "script");
      if (result.failure.kind === "script") {
        assertEquals(result.failure.script, "b-001-fail");
      }
    }
  });
});

Deno.test("runAdvance commit-message failure leaves phase unchanged (req §13.4)", async () => {
  await withTempGitRepo(async (dir) => {
    await initBoard("test", ["a", "b"], dir);
    const cardId = await createCard("test", "Card", dir);
    const board = await loadBoardConfig(dir, "test");

    const scriptsDir = `${dir}/${boardScriptsDir("test")}`;
    await writeScript(
      scriptsDir,
      "a-001-pass",
      "#!/usr/bin/env bash\nexit 0\n",
    );
    await writeScript(
      scriptsDir,
      "a.commit-message",
      "#!/usr/bin/env bash\nexit 1\n",
    );

    const state = await loadCardState(dir, "test", cardId);
    const result = await runAdvance({
      repoRoot: dir,
      board,
      state,
      targetPhase: "b",
    });

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.state.phase, "a");
      assertEquals(result.failure.kind, "script");
      if (result.failure.kind === "script") {
        assertEquals(result.failure.script, "a.commit-message");
      }
    }
  });
});

Deno.test("runAdvance writes fallback commit-message.txt (req §13.4)", async () => {
  await withTempGitRepo(async (dir) => {
    await initBoard("test", ["a", "b"], dir);
    const cardId = await createCard("test", "Card", dir);
    const board = await loadBoardConfig(dir, "test");

    const scriptsDir = `${dir}/${boardScriptsDir("test")}`;
    await writeScript(
      scriptsDir,
      "a-001-pass",
      "#!/usr/bin/env bash\nexit 0\n",
    );

    const state = await loadCardState(dir, "test", cardId);
    await runAdvance({
      repoRoot: dir,
      board,
      state,
      targetPhase: "b",
    });

    const logsDir = `${dir}/.devflow/boards/test/cards/${cardId}/logs`;
    for await (const entry of Deno.readDir(logsDir)) {
      if (!entry.isDirectory || !entry.name.includes("-advance-a-b")) {
        continue;
      }
      const msg = await Deno.readTextFile(
        `${logsDir}/${entry.name}/commit-message.txt`,
      );
      assertEquals(
        msg,
        fallbackCommitMessage(cardId, "a", "b"),
      );
    }
  });
});
