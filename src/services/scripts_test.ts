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

Deno.test("invokeScript streams output before exit when streamOutput is true", async () => {
  const dir = await Deno.makeTempDir();
  const scriptsDir = `${dir}/${boardScriptsDir("stories")}`;
  await Deno.mkdir(scriptsDir, { recursive: true });
  await writeScript(
    scriptsDir,
    "slow-echo",
    "#!/usr/bin/env bash\nset -euo pipefail\npython3 -c \"import sys,time; sys.stderr.write('EARLY_MARKER'); sys.stderr.flush(); time.sleep(0.2); sys.stderr.write('LATE_MARKER\\n'); sys.stderr.flush()\"\n",
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

  const writes: string[] = [];
  const origWrite = Deno.stderr.writeSync.bind(Deno.stderr);
  Deno.stderr.writeSync = (buf: Uint8Array) => {
    writes.push(new TextDecoder().decode(buf));
    return origWrite(buf);
  };

  const invokePromise = invokeScript(
    `${scriptsDir}/slow-echo`,
    "stories",
    "stories-000001",
    env,
    dir,
    { streamOutput: true },
  );

  let sawEarly = false;
  const deadline = Date.now() + 500;
  while (Date.now() < deadline) {
    if (writes.join("").includes("EARLY_MARKER")) {
      sawEarly = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 10));
  }
  assertEquals(sawEarly, true);

  const result = await invokePromise;
  Deno.stderr.writeSync = origWrite;
  assertEquals(result.exitCode, 0);
  assertEquals(result.stderr.includes("LATE_MARKER"), true);
});

Deno.test("isExecutable", async () => {
  const dir = await Deno.makeTempDir();
  const path = `${dir}/script`;
  await Deno.writeTextFile(path, "");
  assertEquals(await isExecutable(path), false);
  await Deno.chmod(path, 0o755);
  assertEquals(await isExecutable(path), true);
});

Deno.test("listExitScripts ignores subdirectories (root scripts only)", async () => {
  const dir = await Deno.makeTempDir();
  const scriptsDir = `${dir}/${boardScriptsDir("stories")}`;
  await Deno.mkdir(scriptsDir, { recursive: true });

  // Root script directly in scripts/
  await writeScript(
    scriptsDir,
    "building-001-root",
    "#!/usr/bin/env bash\nexit 0\n",
  );

  // Child script in subdirectory
  const buildingDir = `${scriptsDir}/building`;
  await Deno.mkdir(buildingDir, { recursive: true });
  await writeScript(
    buildingDir,
    "01-child.sh",
    "#!/usr/bin/env bash\nexit 0\n",
  );

  const listed = await listExitScripts(dir, "stories", "building");
  // Only root script; subdirectory script not included
  assertEquals(listed, ["building-001-root"]);
});

Deno.test("invokeChildScript adds loop env vars (req §9.11, §18)", async () => {
  const dir = await Deno.makeTempDir();
  const scriptsDir = `${dir}/${boardScriptsDir("stories")}`;
  await Deno.mkdir(scriptsDir, { recursive: true });
  await writeScript(
    scriptsDir,
    "echo-loop-vars",
    '#!/usr/bin/env bash\necho -n "${DEVFLOW_SCRIPT_PARENT}:${DEVFLOW_SCRIPT_ROUND}:${DEVFLOW_LOOP_MAX}"\n',
  );

  const { buildScriptEnv, invokeChildScript } = await import("./scripts.ts");
  const runDir = `${dir}/run`;
  await Deno.mkdir(runDir, { recursive: true });
  const env = buildScriptEnv({
    repoRoot: dir,
    boardName: "stories",
    cardId: "stories-000001",
    fromPhase: "building",
    toPhase: "verifying",
    runDirAbs: runDir,
  });

  const result = await invokeChildScript(
    `${scriptsDir}/echo-loop-vars`,
    "stories",
    "stories-000001",
    env,
    dir,
    {
      parentScript: "building-002-build-loop",
      round: 3,
      maxRounds: 5,
    },
  );
  assertEquals(result.exitCode, 0);
  assertEquals(result.stdout, "building-002-build-loop:3:5");
});
