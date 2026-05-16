import { assertEquals, assertRejects } from "@std/assert";
import { createBoardConfig } from "./src/domain/board.ts";
import { validateIdentifier } from "./src/domain/identifiers.ts";
import { initBoard } from "./src/commands/init-board.ts";
import { boardConfigFile, boardRoot } from "./src/infra/paths.ts";
import { runCli } from "./src/cli/dispatch.ts";
import { withTempGitRepo } from "./test/helpers/git-repo.ts";

Deno.test("createBoardConfig builds spec board.json shape", () => {
  const fixed = new Date("2026-05-16T07:00:00.000Z");
  assertEquals(createBoardConfig("stories", ["todo", "done"], { now: fixed }), {
    name: "stories",
    idPrefix: "stories",
    nextSequence: 1,
    sequenceWidth: 6,
    phases: ["todo", "done"],
    blockedPhase: "blocked",
    createdAt: "2026-05-16T07:00:00.000Z",
    updatedAt: "2026-05-16T07:00:00.000Z",
  });
});

Deno.test("validateIdentifier rejects invalid and reserved names", () => {
  assertEquals(validateIdentifier("", "phase"), "phase name must not be empty");
  assertEquals(
    validateIdentifier("Sprint-42", "board"),
    'invalid board name "Sprint-42": must match ^[a-z][a-z0-9_]*$',
  );
  assertEquals(
    validateIdentifier("blocked", "phase"),
    'phase name "blocked" is reserved',
  );
  assertEquals(validateIdentifier("todo", "phase"), null);
});

Deno.test("initBoard creates spec layout and board.json", async () => {
  const dir = await Deno.makeTempDir();
  await initBoard("stories", ["todo", "done"], dir);

  for (const sub of ["cards", "scripts", "skills"]) {
    const s = await Deno.stat(`${dir}/${boardRoot("stories")}/${sub}`);
    assertEquals(s.isDirectory, true);
  }

  const raw = await Deno.readTextFile(`${dir}/${boardConfigFile("stories")}`);
  const config = JSON.parse(raw);
  assertEquals(config.name, "stories");
  assertEquals(config.phases, ["todo", "done"]);
  assertEquals(config.blockedPhase, "blocked");
  assertEquals(config.sequenceWidth, 6);
});

Deno.test("initBoard rejects invalid board name", async () => {
  const dir = await Deno.makeTempDir();
  await assertRejects(
    () => initBoard("Sprint-42", ["todo"], dir),
    Error,
    "must match",
  );
});

Deno.test("initBoard fails when board.json already exists", async () => {
  const dir = await Deno.makeTempDir();
  await initBoard("stories", ["a"], dir);
  await assertRejects(
    () => initBoard("stories", ["b"], dir),
    Error,
    "already exists",
  );
});

Deno.test("initBoard ensures gitignore lock entries", async () => {
  const dir = await Deno.makeTempDir();
  await initBoard("stories", ["todo"], dir);
  const gitignore = await Deno.readTextFile(`${dir}/.gitignore`);
  assertEquals(gitignore.includes(".devflow/.lock/"), true);
  assertEquals(gitignore.includes(".devflow/**/.lock/"), true);
});

Deno.test("runCli board init in git repo", async () => {
  await withTempGitRepo(async (dir) => {
    const original = Deno.cwd();
    try {
      Deno.chdir(dir);
      assertEquals(
        await runCli(["board", "init", "stories", "todo", "done"]),
        0,
      );
      const raw = await Deno.readTextFile(boardConfigFile("stories"));
      const config = JSON.parse(raw);
      assertEquals(config.phases, ["todo", "done"]);
    } finally {
      Deno.chdir(original);
    }
  });
});

Deno.test("runCli init-board synonym", async () => {
  await withTempGitRepo(async (dir) => {
    const original = Deno.cwd();
    try {
      Deno.chdir(dir);
      assertEquals(
        await runCli(["init-board", "stories", "todo", "done"]),
        0,
      );
      const raw = await Deno.readTextFile(boardConfigFile("stories"));
      assertEquals(JSON.parse(raw).phases, ["todo", "done"]);
    } finally {
      Deno.chdir(original);
    }
  });
});

Deno.test("runCli fails outside git repository", async () => {
  const dir = await Deno.makeTempDir();
  const original = Deno.cwd();
  try {
    Deno.chdir(dir);
    assertEquals(await runCli(["board", "init", "stories", "todo"]), 1);
  } finally {
    Deno.chdir(original);
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("runCli rejects verbose and summary together", async () => {
  await withTempGitRepo(async (dir) => {
    const original = Deno.cwd();
    try {
      Deno.chdir(dir);
      assertEquals(
        await runCli([
          "--verbose",
          "--summary",
          "board",
          "init",
          "stories",
          "todo",
        ]),
        1,
      );
    } finally {
      Deno.chdir(original);
    }
  });
});

Deno.test("runCli unknown command", async () => {
  await withTempGitRepo(async (dir) => {
    const original = Deno.cwd();
    try {
      Deno.chdir(dir);
      assertEquals(await runCli(["card", "create", "stories", "x"]), 1);
    } finally {
      Deno.chdir(original);
    }
  });
});

Deno.test("initBoard respects --sequence-width via initBoardFromArgs", async () => {
  const dir = await Deno.makeTempDir();
  const { initBoardFromArgs } = await import("./src/commands/init-board.ts");
  await initBoardFromArgs("stories", ["todo", "--sequence-width", "4"], dir);
  const raw = await Deno.readTextFile(`${dir}/${boardConfigFile("stories")}`);
  assertEquals(JSON.parse(raw).sequenceWidth, 4);
});

Deno.test("runCli block and unblock card (req §12.1, §12.2)", async () => {
  await withTempGitRepo(async (dir) => {
    const original = Deno.cwd();
    try {
      Deno.chdir(dir);
      assertEquals(
        await runCli(["board", "init", "stories", "todo", "done"]),
        0,
      );
      assertEquals(
        await runCli(["card", "create", "stories", "Blocked workflow test"]),
        0,
      );

      const { loadCardState } = await import("./src/domain/card.ts");
      const state = await loadCardState(dir, "stories", "stories-000001");
      assertEquals(state.phase, "todo");

      assertEquals(
        await runCli([
          "card",
          "block",
          "stories-000001",
          "Waiting for API contract",
        ]),
        0,
      );
      const blocked = await loadCardState(dir, "stories", "stories-000001");
      assertEquals(blocked.phase, "blocked");
      assertEquals(blocked.previousPhase, "todo");

      assertEquals(
        await runCli(["card", "list", "stories", "--phase", "blocked"]),
        0,
      );

      assertEquals(await runCli(["card", "unblock", "stories-000001"]), 0);
      const restored = await loadCardState(dir, "stories", "stories-000001");
      assertEquals(restored.phase, "todo");
      assertEquals(await runCli(["card", "validate", "stories-000001"]), 0);

      assertEquals(
        await runCli(["block-card", "stories-000001", "Again"]),
        0,
      );
      assertEquals(await runCli(["unblock-card", "stories-000001"]), 0);
    } finally {
      Deno.chdir(original);
    }
  });
});

Deno.test("runCli M1 e2e: init template, validate, list, show", async () => {
  await withTempGitRepo(async (dir) => {
    const original = Deno.cwd();
    try {
      Deno.chdir(dir);
      const phases = ["unplanned", "planning", "planned"];
      assertEquals(
        await runCli([
          "board",
          "init",
          "stories",
          ...phases,
          "--template",
          "stories",
        ]),
        0,
      );
      assertEquals(await runCli(["board", "validate", "stories"]), 0);
      assertEquals(await runCli(["board", "list"]), 0);
      assertEquals(await runCli(["board", "show", "stories"]), 0);

      const script = `${dir}/${boardRoot("stories")}/scripts/planning-001-stub`;
      const stat = await Deno.stat(script);
      assertEquals(stat.isFile, true);
    } finally {
      Deno.chdir(original);
    }
  });
});

Deno.test("runCli --ignore-lock on variable set with held lock (req §16.1)", async () => {
  await withTempGitRepo(async (dir) => {
    const original = Deno.cwd();
    try {
      Deno.chdir(dir);
      assertEquals(
        await runCli(["board", "init", "stories", "todo", "done"]),
        0,
      );
      assertEquals(
        await runCli(["card", "create", "stories", "Lock test"]),
        0,
      );
      const { acquireCardLock } = await import("./src/services/locks.ts");
      await acquireCardLock(dir, "stories", "stories-000001");
      assertEquals(
        await runCli([
          "variable",
          "set",
          "stories-000001",
          "K",
          "v",
          "--ignore-lock",
        ]),
        0,
      );
      const { releaseCardLock } = await import("./src/services/locks.ts");
      await releaseCardLock(dir, "stories", "stories-000001");
    } finally {
      Deno.chdir(original);
    }
  });
});

Deno.test("runCli rejects --ignore-lock on unsupported commands", async () => {
  await withTempGitRepo(async (dir) => {
    const original = Deno.cwd();
    try {
      Deno.chdir(dir);
      assertEquals(
        await runCli([
          "board",
          "init",
          "stories",
          "todo",
          "--ignore-lock",
        ]),
        1,
      );
    } finally {
      Deno.chdir(original);
    }
  });
});
