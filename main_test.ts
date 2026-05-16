import { assertEquals, assertRejects } from "@std/assert";
import { createBoardState } from "./src/board/state.ts";
import { initBoard } from "./src/commands/init-board.ts";
import { validatePathSegment } from "./src/identifiers.ts";
import { boardRoot, boardStateFile } from "./src/paths.ts";
import { runCli } from "./src/cli.ts";

Deno.test("createBoardState builds column definitions only", () => {
  assertEquals(createBoardState(["a", "b"]), {
    columns: [{ name: "a" }, { name: "b" }],
  });
});

Deno.test("validatePathSegment rejects empty and path separators", () => {
  assertEquals(validatePathSegment("", "column"), "column name must not be empty");
  assertEquals(
    validatePathSegment("a/b", "board"),
    'invalid board name "a/b": must not contain / or \\',
  );
  assertEquals(validatePathSegment(".", "board"), 'invalid board name "."');
  assertEquals(validatePathSegment("ok", "column"), null);
});

Deno.test("initBoard creates layout and state.json", async () => {
  const dir = await Deno.makeTempDir();
  await initBoard("stories", ["column1", "column2", "column3"], dir);

  for (const sub of ["state", "scripts", "skills"]) {
    const s = await Deno.stat(`${dir}/${boardRoot("stories")}/${sub}`);
    assertEquals(s.isDirectory, true);
  }

  const raw = await Deno.readTextFile(`${dir}/${boardStateFile("stories")}`);
  assertEquals(JSON.parse(raw), {
    columns: [
      { name: "column1" },
      { name: "column2" },
      { name: "column3" },
    ],
  });
});

Deno.test("initBoard supports arbitrary board names", async () => {
  const dir = await Deno.makeTempDir();
  await initBoard("sprint-42", ["todo"], dir);
  const raw = await Deno.readTextFile(`${dir}/${boardStateFile("sprint-42")}`);
  assertEquals(JSON.parse(raw).columns[0].name, "todo");
});

Deno.test("initBoard fails when state.json already exists", async () => {
  const dir = await Deno.makeTempDir();
  await initBoard("stories", ["a"], dir);
  await assertRejects(
    () => initBoard("stories", ["b"], dir),
    Error,
    "already exists",
  );
});

Deno.test("runCli init board", async () => {
  const dir = await Deno.makeTempDir();
  const original = Deno.cwd();
  try {
    Deno.chdir(dir);
    assertEquals(await runCli(["init", "stories", "todo", "done"]), 0);
    const raw = await Deno.readTextFile(boardStateFile("stories"));
    const state = JSON.parse(raw);
    assertEquals(state.columns.map((c: { name: string }) => c.name), [
      "todo",
      "done",
    ]);
  } finally {
    Deno.chdir(original);
  }
});
