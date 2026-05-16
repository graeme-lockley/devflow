import { assertEquals } from "@std/assert";
import { boardScriptsDir } from "../infra/paths.ts";
import { isExecutable, listExitScripts } from "./scripts.ts";

async function writeScript(
  dir: string,
  name: string,
  body: string,
  executable = true,
): Promise<void> {
  const path = `${dir}/${name}`;
  await Deno.writeTextFile(path, body);
  if (executable) {
    await Deno.chmod(path, 0o755);
  }
}

Deno.test("listExitScripts filters and sorts (req §9.3)", async () => {
  const dir = await Deno.makeTempDir();
  const scriptsDir = `${dir}/${boardScriptsDir("stories")}`;
  await Deno.mkdir(scriptsDir, { recursive: true });

  await writeScript(
    scriptsDir,
    "planning-002-b",
    "#!/usr/bin/env bash\nexit 0\n",
  );
  await writeScript(
    scriptsDir,
    "planning-001-a",
    "#!/usr/bin/env bash\nexit 0\n",
  );
  await writeScript(
    scriptsDir,
    "planning.commit-message",
    "#!/usr/bin/env bash\nexit 0\n",
  );
  await writeScript(scriptsDir, "planning-backup-001-foo", "#!/bin/bash\n");
  await writeScript(scriptsDir, "README", "# not a script\n");
  await writeScript(
    scriptsDir,
    "planning-003-not-exec",
    "#!/usr/bin/env bash\n",
    false,
  );

  const listed = await listExitScripts(dir, "stories", "planning");
  assertEquals(listed, ["planning-001-a", "planning-002-b"]);
});

Deno.test("invokeScript honours env and cwd (req §9.9, §18)", async () => {
  const dir = await Deno.makeTempDir();
  const scriptsDir = `${dir}/${boardScriptsDir("stories")}`;
  await Deno.mkdir(scriptsDir, { recursive: true });
  await writeScript(
    scriptsDir,
    "echo-card",
    '#!/usr/bin/env bash\necho -n "$DEVFLOW_CARD_ID:$DEVFLOW_FROM_PHASE"\n',
  );

  const { buildScriptEnv, invokeScript } = await import("./scripts.ts");
  const runDir = `${dir}/run`;
  await Deno.mkdir(runDir, { recursive: true });
  const env = buildScriptEnv({
    repoRoot: dir,
    boardName: "stories",
    cardId: "stories-000001",
    fromPhase: "planning",
    toPhase: "planned",
    runDirAbs: runDir,
  });

  const result = await invokeScript(
    `${scriptsDir}/echo-card`,
    "stories",
    "stories-000001",
    env,
    dir,
  );
  assertEquals(result.exitCode, 0);
  assertEquals(result.stdout, "stories-000001:planning");
});

Deno.test("isExecutable", async () => {
  const dir = await Deno.makeTempDir();
  const path = `${dir}/script`;
  await Deno.writeTextFile(path, "");
  assertEquals(await isExecutable(path), false);
  await Deno.chmod(path, 0o755);
  assertEquals(await isExecutable(path), true);
});
