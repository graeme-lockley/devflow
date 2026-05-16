import { assertEquals } from "@std/assert";
import { boardScriptsDir } from "../infra/paths.ts";
import {
  fallbackCommitMessage,
  resolveCommitMessage,
  resolveCommitMessageScript,
} from "./scripts.ts";

async function writeScript(
  scriptsDir: string,
  name: string,
  body: string,
): Promise<void> {
  const path = `${scriptsDir}/${name}`;
  await Deno.writeTextFile(path, body);
  await Deno.chmod(path, 0o755);
}

Deno.test("resolveCommitMessage uses fallback when script absent (req §13.4)", async () => {
  const dir = await Deno.makeTempDir();
  const scriptsDir = `${dir}/${boardScriptsDir("test")}`;
  await Deno.mkdir(scriptsDir, { recursive: true });

  const hopCtx = {
    repoRoot: dir,
    boardName: "test",
    cardId: "test-000001",
    fromPhase: "a",
    toPhase: "b",
    runDirAbs: `${dir}/run`,
  };
  await Deno.mkdir(hopCtx.runDirAbs, { recursive: true });

  const result = await resolveCommitMessage(
    dir,
    "test",
    "test-000001",
    { from: "a", to: "b" },
    hopCtx,
  );

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.scriptName, null);
    assertEquals(
      result.message,
      fallbackCommitMessage("test-000001", "a", "b"),
    );
  }
});

Deno.test("resolveCommitMessage uses script stdout (req §13.4)", async () => {
  const dir = await Deno.makeTempDir();
  const scriptsDir = `${dir}/${boardScriptsDir("test")}`;
  await Deno.mkdir(scriptsDir, { recursive: true });
  await writeScript(
    scriptsDir,
    "a.commit-message",
    '#!/usr/bin/env bash\necho -n "Custom message"\n',
  );

  const hopCtx = {
    repoRoot: dir,
    boardName: "test",
    cardId: "test-000001",
    fromPhase: "a",
    toPhase: "b",
    runDirAbs: `${dir}/run`,
  };
  await Deno.mkdir(hopCtx.runDirAbs, { recursive: true });

  const result = await resolveCommitMessage(
    dir,
    "test",
    "test-000001",
    { from: "a", to: "b" },
    hopCtx,
  );

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.scriptName, "a.commit-message");
    assertEquals(result.message, "Custom message");
  }
});

Deno.test("resolveCommitMessage fails on empty stdout (req §13.4)", async () => {
  const dir = await Deno.makeTempDir();
  const scriptsDir = `${dir}/${boardScriptsDir("test")}`;
  await Deno.mkdir(scriptsDir, { recursive: true });
  await writeScript(
    scriptsDir,
    "a.commit-message",
    "#!/usr/bin/env bash\nexit 0\n",
  );

  const hopCtx = {
    repoRoot: dir,
    boardName: "test",
    cardId: "test-000001",
    fromPhase: "a",
    toPhase: "b",
    runDirAbs: `${dir}/run`,
  };

  const result = await resolveCommitMessage(
    dir,
    "test",
    "test-000001",
    { from: "a", to: "b" },
    hopCtx,
  );

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.scriptName, "a.commit-message");
    assertEquals(result.exitCode, 0);
  }
});

Deno.test("resolveCommitMessageScript finds executable script", async () => {
  const dir = await Deno.makeTempDir();
  const scriptsDir = `${dir}/${boardScriptsDir("test")}`;
  await Deno.mkdir(scriptsDir, { recursive: true });
  await writeScript(
    scriptsDir,
    "planning.commit-message",
    "#!/usr/bin/env bash\nexit 0\n",
  );

  const path = await resolveCommitMessageScript(dir, "test", "planning");
  assertEquals(path?.endsWith("planning.commit-message"), true);
});
