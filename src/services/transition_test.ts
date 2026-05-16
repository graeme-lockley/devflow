import { assertEquals } from "@std/assert";
import { withTempGitRepo } from "../../test/helpers/git-repo.ts";
import { initBoard } from "../commands/init-board.ts";
import { createCard } from "../commands/create-card.ts";
import { loadBoardConfig, saveBoardConfig } from "../domain/board.ts";
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

Deno.test("runAdvance loop runs entry then steps then exit (req §9.11.3)", async () => {
  await withTempGitRepo(async (dir) => {
    await initBoard("test", ["a", "b"], dir);
    const cardId = await createCard("test", "Card", dir);
    let board = await loadBoardConfig(dir, "test");

    board = {
      ...board,
      phaseScripts: {
        a: {
          loop: {
            steps: ["a/steps/01-loop.sh"],
            maxRounds: 1,
          },
        },
      },
    };
    await saveBoardConfig(dir, board);

    const scriptsDir = `${dir}/${boardScriptsDir("test")}`;
    const stepsDir = `${scriptsDir}/a/steps`;
    await Deno.mkdir(stepsDir, { recursive: true });

    const orderFile = `${dir}/script-order.txt`;
    await Deno.writeTextFile(orderFile, "");

    await writeScript(
      scriptsDir,
      "a-001-entry",
      `#!/usr/bin/env bash
echo entry >> "${orderFile}"
exit 0
`,
    );
    await writeScript(
      scriptsDir,
      "a-200-exit",
      `#!/usr/bin/env bash
echo exit >> "${orderFile}"
exit 0
`,
    );
    await writeScript(
      stepsDir,
      "01-loop.sh",
      `#!/usr/bin/env bash
echo loop >> "${orderFile}"
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

    assertEquals(result.ok, true);
    const order = (await Deno.readTextFile(orderFile)).trim().split("\n");
    assertEquals(order, ["entry", "loop", "exit"]);
  });
});

Deno.test("runAdvance loop block retries on failure (req §9.11, ADR-0014)", async () => {
  await withTempGitRepo(async (dir) => {
    await initBoard("test", ["a", "b"], dir);
    const cardId = await createCard("test", "Card", dir);
    let board = await loadBoardConfig(dir, "test");

    // Add loop configuration
    board = {
      ...board,
      phaseScripts: {
        a: {
          loop: {
            steps: ["a/steps/01-flaky.sh", "a/steps/02-pass.sh"],
            maxRounds: 3,
          },
        },
      },
    };
    await saveBoardConfig(dir, board);

    // Create loop step scripts
    const stepsDir = `${dir}/${boardScriptsDir("test")}/a/steps`;
    await Deno.mkdir(stepsDir, { recursive: true });

    // Flaky script: fails first 2 times, passes on 3rd
    const flakyPath = `${stepsDir}/01-flaky.sh`;
    await Deno.writeTextFile(
      flakyPath,
      `#!/usr/bin/env bash
set -euo pipefail
count_file="${dir}/flaky-count.txt"
if [ ! -f "$count_file" ]; then echo 0 > "$count_file"; fi
count=$(cat "$count_file")
count=$((count + 1))
echo $count > "$count_file"
if [ $count -lt 3 ]; then exit 1; fi
echo "ROUND: \${DEVFLOW_SCRIPT_ROUND}" >&2
exit 0
`,
    );
    await Deno.chmod(flakyPath, 0o755);

    await writeScript(
      stepsDir,
      "02-pass.sh",
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
      assertEquals(result.state.phase, "b");
    }

    // Verify flaky script ran 3 times
    const count = parseInt(
      await Deno.readTextFile(`${dir}/flaky-count.txt`),
      10,
    );
    assertEquals(count, 3);
  });
});

Deno.test("runAdvance loop block fails after maxRounds exhausted (req §9.11)", async () => {
  await withTempGitRepo(async (dir) => {
    await initBoard("test", ["a", "b"], dir);
    const cardId = await createCard("test", "Card", dir);
    let board = await loadBoardConfig(dir, "test");

    // Add loop configuration with maxRounds=2
    board = {
      ...board,
      phaseScripts: {
        a: {
          loop: {
            steps: ["a/steps/01-always-fail.sh"],
            maxRounds: 2,
          },
        },
      },
    };
    await saveBoardConfig(dir, board);

    const stepsDir = `${dir}/${boardScriptsDir("test")}/a/steps`;
    await Deno.mkdir(stepsDir, { recursive: true });
    await writeScript(
      stepsDir,
      "01-always-fail.sh",
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
      assertEquals(result.failure.kind, "script");
      if (result.failure.kind === "script") {
        assertEquals(
          result.failure.script.includes("loop exhausted"),
          true,
        );
      }
      assertEquals(result.state.phase, "a"); // Phase unchanged
    }
  });
});
