import { assertEquals } from "@std/assert";
import {
  countCommits,
  latestCommitSubject,
  withTempGitRepo,
} from "../../test/helpers/git-repo.ts";
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

async function setupAdvanceBoard(
  dir: string,
  phases: string[],
): Promise<{ cardId: string; scriptsDir: string }> {
  await initBoard("test", phases, dir);
  const cardId = await createCard("test", "Card", dir);
  const scriptsDir = `${dir}/${boardScriptsDir("test")}`;
  return { cardId, scriptsDir };
}

Deno.test("runAdvance single-hop creates one git commit (req §13.5)", async () => {
  await withTempGitRepo(async (dir) => {
    const { cardId, scriptsDir } = await setupAdvanceBoard(dir, ["a", "b"]);
    await writeScript(
      scriptsDir,
      "a-001-pass",
      "#!/usr/bin/env bash\nexit 0\n",
    );

    const board = await loadBoardConfig(dir, "test");
    const state = await loadCardState(dir, "test", cardId);
    const before = await countCommits(dir);

    const result = await runAdvance({
      repoRoot: dir,
      board,
      state,
      targetPhase: "b",
    });

    assertEquals(result.ok, true);
    assertEquals(await countCommits(dir), before + 1);
    assertEquals(
      await latestCommitSubject(dir),
      fallbackCommitMessage(cardId, "a", "b"),
    );
  });
});

Deno.test("runAdvance uses commit-message script (req §13.4)", async () => {
  await withTempGitRepo(async (dir) => {
    const { cardId, scriptsDir } = await setupAdvanceBoard(dir, ["a", "b"]);
    await writeScript(
      scriptsDir,
      "a-001-pass",
      "#!/usr/bin/env bash\nexit 0\n",
    );
    await writeScript(
      scriptsDir,
      "a.commit-message",
      '#!/usr/bin/env bash\necho -n "Custom hop message"\n',
    );

    const board = await loadBoardConfig(dir, "test");
    const state = await loadCardState(dir, "test", cardId);
    await runAdvance({
      repoRoot: dir,
      board,
      state,
      targetPhase: "b",
    });

    assertEquals(await latestCommitSubject(dir), "Custom hop message");
  });
});

Deno.test("runAdvance multi-hop creates one commit per hop (req §11.3)", async () => {
  await withTempGitRepo(async (dir) => {
    const { cardId, scriptsDir } = await setupAdvanceBoard(dir, [
      "a",
      "b",
      "c",
    ]);
    for (const phase of ["a", "b"]) {
      await writeScript(
        scriptsDir,
        `${phase}-001-pass`,
        "#!/usr/bin/env bash\nexit 0\n",
      );
    }

    const board = await loadBoardConfig(dir, "test");
    const state = await loadCardState(dir, "test", cardId);
    const before = await countCommits(dir);

    await runAdvance({
      repoRoot: dir,
      board,
      state,
      targetPhase: "c",
    });

    assertEquals(await countCommits(dir), before + 2);
  });
});

Deno.test("runAdvance partial multi-hop keeps earlier commits (req §11.3)", async () => {
  await withTempGitRepo(async (dir) => {
    const { cardId, scriptsDir } = await setupAdvanceBoard(dir, [
      "a",
      "b",
      "c",
    ]);
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

    const board = await loadBoardConfig(dir, "test");
    const state = await loadCardState(dir, "test", cardId);
    const before = await countCommits(dir);

    const result = await runAdvance({
      repoRoot: dir,
      board,
      state,
      targetPhase: "c",
    });

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.state.phase, "b");
    }
    assertEquals(await countCommits(dir), before + 1);
  });
});

Deno.test("runAdvance git failure after state update (req §13.7)", async () => {
  await withTempGitRepo(async (dir) => {
    const { cardId, scriptsDir } = await setupAdvanceBoard(dir, ["a", "b"]);
    await writeScript(
      scriptsDir,
      "a-001-pass",
      "#!/usr/bin/env bash\nexit 0\n",
    );

    const hookPath = `${dir}/.git/hooks/pre-commit`;
    await Deno.writeTextFile(
      hookPath,
      "#!/bin/sh\nexit 1\n",
    );
    await Deno.chmod(hookPath, 0o755);

    const board = await loadBoardConfig(dir, "test");
    const state = await loadCardState(dir, "test", cardId);

    const result = await runAdvance({
      repoRoot: dir,
      board,
      state,
      targetPhase: "b",
    });

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.failure.kind, "git");
      assertEquals(result.state.phase, "b");
      const failed = result.state.history.filter((e) =>
        typeof e === "object" && e !== null && "type" in e &&
        e.type === "transitionFailed"
      );
      assertEquals(failed.length, 0);
      const changed = result.state.history.filter((e) =>
        typeof e === "object" && e !== null && "type" in e &&
        e.type === "phaseChanged"
      );
      assertEquals(changed.length, 1);
    }
  });
});
