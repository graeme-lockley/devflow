import { assertEquals } from "@std/assert";
import { withTempGitRepo } from "../../test/helpers/git-repo.ts";
import { initBoard } from "../commands/init-board.ts";
import { createCard } from "../commands/create-card.ts";
import {
  createBoardConfig,
  loadBoardConfig,
  saveBoardConfig,
} from "../domain/board.ts";
import { loadCardState, saveCardState } from "../domain/card.ts";
import { fallbackCommitMessage } from "./scripts.ts";
import { advanceRunDir, boardScriptsDir, boardsRoot } from "../infra/paths.ts";
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
      assertEquals(failed.length, 0);
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

Deno.test("runAdvance with --skip skips one named root script (req stories-000005)", async () => {
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
      "a-002-skip-me",
      "#!/usr/bin/env bash\nexit 1\n", // Would fail if run
    );
    await writeScript(
      scriptsDir,
      "a-003-pass",
      "#!/usr/bin/env bash\nexit 0\n",
    );

    const state = await loadCardState(dir, "test", cardId);
    const result = await runAdvance({
      repoRoot: dir,
      board,
      state,
      targetPhase: "b",
      skip: ["a-002"],
    });

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.state.phase, "b");
      // Check for actionSkipped event
      const skipped = result.state.history.filter((e) =>
        typeof e === "object" && e !== null && "type" in e &&
        e.type === "actionSkipped"
      );
      assertEquals(skipped.length, 1);
      if (
        skipped[0] && typeof skipped[0] === "object" && "script" in skipped[0]
      ) {
        assertEquals(skipped[0].script, "a-002-skip-me");
      }
    }
  });
});

Deno.test("runAdvance with --skip for multiple scripts (req stories-000005)", async () => {
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
      "a-002-skip-me",
      "#!/usr/bin/env bash\nexit 1\n",
    );
    await writeScript(
      scriptsDir,
      "a-003-skip-too",
      "#!/usr/bin/env bash\nexit 1\n",
    );
    await writeScript(
      scriptsDir,
      "a-004-pass",
      "#!/usr/bin/env bash\nexit 0\n",
    );

    const state = await loadCardState(dir, "test", cardId);
    const result = await runAdvance({
      repoRoot: dir,
      board,
      state,
      targetPhase: "b",
      skip: ["a-002", "a-003"],
    });

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.state.phase, "b");
      const skipped = result.state.history.filter((e) =>
        typeof e === "object" && e !== null && "type" in e &&
        e.type === "actionSkipped"
      );
      assertEquals(skipped.length, 2);
    }
  });
});

Deno.test("runAdvance with --skip in multi-phase advance (req stories-000005)", async () => {
  await withTempGitRepo(async (dir) => {
    await initBoard("test", ["a", "b", "c"], dir);
    const cardId = await createCard("test", "Card", dir);
    const board = await loadBoardConfig(dir, "test");

    const scriptsDir = `${dir}/${boardScriptsDir("test")}`;
    await writeScript(
      scriptsDir,
      "a-001-skip-me",
      "#!/usr/bin/env bash\nexit 1\n",
    );
    await writeScript(
      scriptsDir,
      "b-001-pass",
      "#!/usr/bin/env bash\nexit 0\n",
    );

    const state = await loadCardState(dir, "test", cardId);
    const result = await runAdvance({
      repoRoot: dir,
      board,
      state,
      targetPhase: "c",
      skip: ["a-001"], // Only applies to phase a
    });

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.state.phase, "c");
      const skipped = result.state.history.filter((e) =>
        typeof e === "object" && e !== null && "type" in e &&
        e.type === "actionSkipped"
      );
      assertEquals(skipped.length, 1); // Only a-001 skipped
    }
  });
});

Deno.test("runAdvance with --skip for unknown action fails early (req stories-000005)", async () => {
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
    let threw = false;
    try {
      await runAdvance({
        repoRoot: dir,
        board,
        state,
        targetPhase: "b",
        skip: ["a-999"], // No such script
      });
    } catch (e) {
      threw = true;
      assertEquals(
        e instanceof Error && e.message.includes("does not match any script"),
        true,
      );
    }
    assertEquals(threw, true);
  });
});

Deno.test("runAdvance with --skip for unmatched phase token fails (req stories-000005)", async () => {
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
    let threw = false;
    try {
      await runAdvance({
        repoRoot: dir,
        board,
        state,
        targetPhase: "b",
        skip: ["c-001"], // Phase c not in this advance
      });
    } catch (e) {
      threw = true;
      assertEquals(
        e instanceof Error && e.message.includes("does not match any script"),
        true,
      );
    }
    assertEquals(threw, true);
  });
});

Deno.test("runAdvance actionSkipped events appear before phaseChanged (req stories-000005)", async () => {
  await withTempGitRepo(async (dir) => {
    await initBoard("test", ["a", "b"], dir);
    const cardId = await createCard("test", "Card", dir);
    const board = await loadBoardConfig(dir, "test");

    const scriptsDir = `${dir}/${boardScriptsDir("test")}`;
    await writeScript(
      scriptsDir,
      "a-001-skip",
      "#!/usr/bin/env bash\nexit 1\n",
    );

    const state = await loadCardState(dir, "test", cardId);
    const result = await runAdvance({
      repoRoot: dir,
      board,
      state,
      targetPhase: "b",
      skip: ["a-001"],
    });

    assertEquals(result.ok, true);
    if (result.ok) {
      const history = result.state.history;
      const lastSkippedIdx = history.findLastIndex((e) =>
        typeof e === "object" && e !== null && "type" in e &&
        e.type === "actionSkipped"
      );
      const firstPhaseChangedIdx = history.findIndex((e) =>
        typeof e === "object" && e !== null && "type" in e &&
        e.type === "phaseChanged" && e.from === "a"
      );
      // actionSkipped should come before phaseChanged
      assertEquals(lastSkippedIdx < firstPhaseChangedIdx, true);
    }
  });
});

Deno.test("runAdvance script flow: linear progression (scenario #2)", async () => {
  await withTempGitRepo(async (dir) => {
    await initBoard("test", ["a", "b"], dir);
    const cardId = await createCard("test", "Card", dir);
    const board = await loadBoardConfig(dir, "test");

    const scriptsDir = `${dir}/${boardScriptsDir("test")}`;
    await writeScript(scriptsDir, "a-001-one", "#!/usr/bin/env bash\nexit 0\n");
    await writeScript(scriptsDir, "a-002-two", "#!/usr/bin/env bash\nexit 0\n");
    await writeScript(
      scriptsDir,
      "a-003-three",
      "#!/usr/bin/env bash\nexit 0\n",
    );

    const state = await loadCardState(dir, "test", cardId);
    const result = await runAdvance({
      repoRoot: dir,
      board,
      state,
      targetPhase: "b",
    });

    assertEquals(result.ok, true);
    if (result.ok) {
      // Read run.json to verify execution order
      const runDir = `${dir}/${
        advanceRunDir(
          "test",
          cardId,
          "a",
          "b",
          new Date(result.state.updatedAt),
        )
      }`;
      const runJson = JSON.parse(
        await Deno.readTextFile(`${runDir}/run.json`),
      );
      assertEquals(runJson.scripts.length, 3);
      assertEquals(runJson.scripts[0].name, "a-001-one");
      assertEquals(runJson.scripts[1].name, "a-002-two");
      assertEquals(runJson.scripts[2].name, "a-003-three");
    }
  });
});

Deno.test("runAdvance script flow: backward jump (scenario #3)", async () => {
  await withTempGitRepo(async (dir) => {
    await initBoard("test", ["a", "b"], dir);
    const cardId = await createCard("test", "Card", dir);
    const board = await loadBoardConfig(dir, "test");

    const scriptsDir = `${dir}/${boardScriptsDir("test")}`;
    // a-001 sets NEXT_SCRIPT=a-003 on second run
    await writeScript(
      scriptsDir,
      "a-001-one",
      `#!/usr/bin/env bash
marker_file="${dir}/.devflow/boards/test/cards/$2/a001-ran"
if [ -f "$marker_file" ]; then
  # Second run: jump to a-003
  state_file="${dir}/.devflow/boards/test/cards/$2/state.json"
  tmp="$state_file.tmp"
  jq '.variables.NEXT_SCRIPT = "a-003"' "$state_file" > "$tmp" && mv "$tmp" "$state_file"
fi
touch "$marker_file"
exit 0
`,
    );
    // a-002 sets NEXT_SCRIPT=a-001 first time only
    await writeScript(
      scriptsDir,
      "a-002-two",
      `#!/usr/bin/env bash
marker_file="${dir}/.devflow/boards/test/cards/$2/jump-marker"
state_file="${dir}/.devflow/boards/test/cards/$2/state.json"
tmp="$state_file.tmp"
if [ ! -f "$marker_file" ]; then
  # First time: jump back to a-001
  touch "$marker_file"
  jq '.variables.NEXT_SCRIPT = "a-001"' "$state_file" > "$tmp" && mv "$tmp" "$state_file"
fi
exit 0
`,
    );
    await writeScript(
      scriptsDir,
      "a-003-three",
      "#!/usr/bin/env bash\nexit 0\n",
    );

    const state = await loadCardState(dir, "test", cardId);
    const result = await runAdvance({
      repoRoot: dir,
      board,
      state,
      targetPhase: "b",
    });

    assertEquals(result.ok, true);
    if (result.ok) {
      // Read run.json to verify jump
      const runDir = `${dir}/${
        advanceRunDir(
          "test",
          cardId,
          "a",
          "b",
          new Date(result.state.updatedAt),
        )
      }`;
      const runJson = JSON.parse(
        await Deno.readTextFile(`${runDir}/run.json`),
      );
      // Should see: a-001 → a-002 (with nextScript) → a-001 → a-003
      assertEquals(runJson.scripts.length, 4);
      assertEquals(runJson.scripts[0].name, "a-001-one");
      assertEquals(runJson.scripts[1].name, "a-002-two");
      assertEquals(runJson.scripts[1].nextScript, "a-001");
      assertEquals(runJson.scripts[2].name, "a-001-one");
      assertEquals(runJson.scripts[3].name, "a-003-three");
    }
  });
});

Deno.test("runAdvance script flow: exit 1 with NEXT_SCRIPT set (scenario #4)", async () => {
  await withTempGitRepo(async (dir) => {
    await initBoard("test", ["a", "b"], dir);
    const cardId = await createCard("test", "Card", dir);
    const board = await loadBoardConfig(dir, "test");

    const scriptsDir = `${dir}/${boardScriptsDir("test")}`;
    // a-001 sets NEXT_SCRIPT then exits 1
    await writeScript(
      scriptsDir,
      "a-001-fail",
      `#!/usr/bin/env bash
state_file="${dir}/.devflow/boards/test/cards/$2/state.json"
tmp="$state_file.tmp"
jq '.variables.NEXT_SCRIPT = "a-002"' "$state_file" > "$tmp" && mv "$tmp" "$state_file"
exit 1
`,
    );
    await writeScript(scriptsDir, "a-002-two", "#!/usr/bin/env bash\nexit 0\n");

    const state = await loadCardState(dir, "test", cardId);
    const result = await runAdvance({
      repoRoot: dir,
      board,
      state,
      targetPhase: "b",
    });

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.failure.kind, "script");
      if (result.failure.kind === "script") {
        assertEquals(result.failure.script, "a-001-fail");
      }
      // NEXT_SCRIPT should still be set (not cleared)
      const finalState = await loadCardState(dir, "test", cardId);
      assertEquals(finalState.variables.NEXT_SCRIPT, "a-002");
    }
  });
});

Deno.test("runAdvance script flow: invalid prefix (scenario #5)", async () => {
  await withTempGitRepo(async (dir) => {
    await initBoard("test", ["a", "b"], dir);
    const cardId = await createCard("test", "Card", dir);
    const board = await loadBoardConfig(dir, "test");

    const scriptsDir = `${dir}/${boardScriptsDir("test")}`;
    // a-001 sets invalid NEXT_SCRIPT
    await writeScript(
      scriptsDir,
      "a-001-test",
      `#!/usr/bin/env bash
state_file="${dir}/.devflow/boards/test/cards/$2/state.json"
tmp="$state_file.tmp"
jq '.variables.NEXT_SCRIPT = "a-999"' "$state_file" > "$tmp" && mv "$tmp" "$state_file"
exit 0
`,
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
      assertEquals(result.failure.kind, "script");
      // NEXT_SCRIPT should still be set (not cleared)
      const finalState = await loadCardState(dir, "test", cardId);
      assertEquals(finalState.variables.NEXT_SCRIPT, "a-999");
    }
  });
});

Deno.test("runAdvance script flow: hop entry with NEXT_SCRIPT preset (scenario #7)", async () => {
  await withTempGitRepo(async (dir) => {
    await initBoard("test", ["a", "b"], dir);
    const cardId = await createCard("test", "Card", dir);
    const board = await loadBoardConfig(dir, "test");

    const scriptsDir = `${dir}/${boardScriptsDir("test")}`;
    await writeScript(scriptsDir, "a-001-one", "#!/usr/bin/env bash\nexit 0\n");
    await writeScript(scriptsDir, "a-002-two", "#!/usr/bin/env bash\nexit 0\n");

    // Preset NEXT_SCRIPT before advance
    let state = await loadCardState(dir, "test", cardId);
    state = { ...state, variables: { NEXT_SCRIPT: "a-002" } };
    await saveCardState(dir, "test", state);

    const result = await runAdvance({
      repoRoot: dir,
      board,
      state,
      targetPhase: "b",
    });

    assertEquals(result.ok, true);
    if (result.ok) {
      // Should start at a-002, not a-001
      const runDir = `${dir}/${
        advanceRunDir(
          "test",
          cardId,
          "a",
          "b",
          new Date(result.state.updatedAt),
        )
      }`;
      const runJson = JSON.parse(
        await Deno.readTextFile(`${runDir}/run.json`),
      );
      assertEquals(runJson.scripts.length, 1);
      assertEquals(runJson.scripts[0].name, "a-002-two");
    }
  });
});

Deno.test("runAdvance script flow: execution cap (scenario #8)", async () => {
  await withTempGitRepo(async (dir) => {
    // Create board with low execution cap
    const board = createBoardConfig("test", ["a", "b"]);
    const boardWithCap = { ...board, maxScriptExecutionsPerHop: 3 };
    await Deno.mkdir(`${dir}/${boardsRoot()}/test`, { recursive: true });
    await saveBoardConfig(dir, boardWithCap);
    await Deno.mkdir(`${dir}/${boardScriptsDir("test")}`, { recursive: true });
    await Deno.mkdir(`${dir}/${boardsRoot()}/test/cards`, { recursive: true });
    await Deno.mkdir(`${dir}/${boardsRoot()}/test/skills`, { recursive: true });

    const cardId = await createCard("test", "Card", dir);

    const scriptsDir = `${dir}/${boardScriptsDir("test")}`;
    // a-001 jumps to itself (infinite loop)
    await writeScript(
      scriptsDir,
      "a-001-loop",
      `#!/usr/bin/env bash
state_file="${dir}/.devflow/boards/test/cards/$2/state.json"
tmp="$state_file.tmp"
jq '.variables.NEXT_SCRIPT = "a-001"' "$state_file" > "$tmp" && mv "$tmp" "$state_file"
exit 0
`,
    );

    const state = await loadCardState(dir, "test", cardId);
    const result = await runAdvance({
      repoRoot: dir,
      board: boardWithCap,
      state,
      targetPhase: "b",
    });

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.failure.kind, "script");
      if (result.failure.kind === "script") {
        // Should fail with cap message
        assertEquals(
          result.failure.script.includes("maxScriptExecutionsPerHop"),
          true,
        );
      }
    }
  });
});

Deno.test("runAdvance script flow: skip with NEXT_SCRIPT (scenario #9)", async () => {
  await withTempGitRepo(async (dir) => {
    await initBoard("test", ["a", "b"], dir);
    const cardId = await createCard("test", "Card", dir);
    const board = await loadBoardConfig(dir, "test");

    const scriptsDir = `${dir}/${boardScriptsDir("test")}`;
    // a-001 jumps to a-002
    await writeScript(
      scriptsDir,
      "a-001-one",
      `#!/usr/bin/env bash
state_file="${dir}/.devflow/boards/test/cards/$2/state.json"
tmp="$state_file.tmp"
jq '.variables.NEXT_SCRIPT = "a-002"' "$state_file" > "$tmp" && mv "$tmp" "$state_file"
exit 0
`,
    );
    await writeScript(scriptsDir, "a-002-two", "#!/usr/bin/env bash\nexit 1\n"); // would fail
    await writeScript(
      scriptsDir,
      "a-003-three",
      "#!/usr/bin/env bash\nexit 0\n",
    );

    const state = await loadCardState(dir, "test", cardId);
    const result = await runAdvance({
      repoRoot: dir,
      board,
      state,
      targetPhase: "b",
      skip: ["a-002"],
    });

    assertEquals(result.ok, true);
    if (result.ok) {
      // Should skip a-002 and continue to a-003
      const runDir = `${dir}/${
        advanceRunDir(
          "test",
          cardId,
          "a",
          "b",
          new Date(result.state.updatedAt),
        )
      }`;
      const runJson = JSON.parse(
        await Deno.readTextFile(`${runDir}/run.json`),
      );
      assertEquals(runJson.scripts.length, 3);
      assertEquals(runJson.scripts[0].name, "a-001-one");
      assertEquals(runJson.scripts[1].name, "a-002-two");
      assertEquals(runJson.scripts[1].skipped, true);
      assertEquals(runJson.scripts[2].name, "a-003-three");
    }
  });
});

Deno.test("runAdvance script flow: preflight validation (scenario #12)", async () => {
  await withTempGitRepo(async (dir) => {
    await initBoard("test", ["a", "b"], dir);
    const cardId = await createCard("test", "Card", dir);
    const board = await loadBoardConfig(dir, "test");

    const scriptsDir = `${dir}/${boardScriptsDir("test")}`;
    await writeScript(scriptsDir, "a-001-one", "#!/usr/bin/env bash\nexit 0\n");

    // Preset invalid NEXT_SCRIPT before advance
    let state = await loadCardState(dir, "test", cardId);
    state = { ...state, variables: { NEXT_SCRIPT: "a-999" } };
    await saveCardState(dir, "test", state);

    try {
      await runAdvance({
        repoRoot: dir,
        board,
        state,
        targetPhase: "b",
      });
      assertEquals(true, false, "Should have thrown");
    } catch (e) {
      assertEquals(e instanceof Error, true);
      if (e instanceof Error) {
        assertEquals(e.message.includes("NEXT_SCRIPT preflight"), true);
      }
      // NEXT_SCRIPT should still be set
      const finalState = await loadCardState(dir, "test", cardId);
      assertEquals(finalState.variables.NEXT_SCRIPT, "a-999");
    }
  });
});
