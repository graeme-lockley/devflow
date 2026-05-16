import { assertEquals } from "@std/assert";
import { initBoard } from "../commands/init-board.ts";
import { createCard } from "../commands/create-card.ts";
import { advanceCard } from "../commands/card-advance.ts";
import { boardScriptsDir } from "../infra/paths.ts";
import { withTempGitRepo } from "../../test/helpers/git-repo.ts";
import { resetLogLevel, setLogLevel } from "./console.ts";

async function writeScript(
  repoRoot: string,
  boardName: string,
  name: string,
  body: string,
): Promise<void> {
  const path = `${repoRoot}/${boardScriptsDir(boardName)}/${name}`;
  await Deno.writeTextFile(path, body);
  await Deno.chmod(path, 0o755);
}

Deno.test("appendScriptOutput streams in info mode, silent in summary (req §16.2)", async () => {
  await withTempGitRepo(async (dir) => {
    await initBoard("test", ["a", "b"], dir);
    const cardId = await createCard("test", "Card", dir);
    await writeScript(
      dir,
      "test",
      "a-001-echo",
      "#!/usr/bin/env bash\nset -euo pipefail\necho SCRIPT_STDOUT_MARKER\n",
    );

    resetLogLevel();
    setLogLevel("summary");
    const stderrChunks: string[] = [];
    const origErr = console.error;
    console.error = (...args: unknown[]) => {
      stderrChunks.push(args.map(String).join(" "));
    };
    try {
      const result = await advanceCard(cardId, "b", dir);
      assertEquals(result.exitCode, 0);
      assertEquals(
        stderrChunks.join("\n").includes("SCRIPT_STDOUT_MARKER"),
        false,
      );
    } finally {
      console.error = origErr;
    }

    resetLogLevel();
    setLogLevel("info");
    const stderrWrites: string[] = [];
    const infoLines: string[] = [];
    const origWrite = Deno.stderr.writeSync.bind(Deno.stderr);
    Deno.stderr.writeSync = (buf: Uint8Array) => {
      stderrWrites.push(new TextDecoder().decode(buf));
      return origWrite(buf);
    };
    console.error = (...args: unknown[]) => {
      infoLines.push(args.map(String).join(" "));
    };
    await initBoard("test2", ["a", "b"], dir);
    const cardId2 = await createCard("test2", "Card 2", dir);
    await writeScript(
      dir,
      "test2",
      "a-001-echo",
      "#!/usr/bin/env bash\nset -euo pipefail\necho SCRIPT_STDOUT_MARKER\n",
    );
    try {
      const result = await advanceCard(cardId2, "b", dir);
      assertEquals(result.exitCode, 0);
      assertEquals(
        infoLines.join("\n").includes("running a-001-echo"),
        true,
      );
      assertEquals(
        stderrWrites.join("").includes("SCRIPT_STDOUT_MARKER"),
        true,
      );
    } finally {
      Deno.stderr.writeSync = origWrite;
      console.error = origErr;
      resetLogLevel();
    }
  });
});
