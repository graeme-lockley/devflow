import { assertEquals, assertRejects } from "@std/assert";
import { parseCreateCardArgs } from "./create-card-flags.ts";

Deno.test("parseCreateCardArgs: title only", async () => {
  const parsed = await parseCreateCardArgs(["stories", "My title"]);
  assertEquals(parsed.boardName, "stories");
  assertEquals(parsed.title, "My title");
  assertEquals(parsed.description, undefined);
});

Deno.test("parseCreateCardArgs: --description inline", async () => {
  const parsed = await parseCreateCardArgs([
    "stories",
    "T",
    "--description",
    "hello world",
  ]);
  assertEquals(parsed.description, "hello world");
});

Deno.test("parseCreateCardArgs: --description-file reads contents", async () => {
  const file = await Deno.makeTempFile();
  try {
    await Deno.writeTextFile(file, "line1\nline2\n");
    const parsed = await parseCreateCardArgs([
      "stories",
      "T",
      "--description-file",
      file,
    ]);
    assertEquals(parsed.description, "line1\nline2\n");
  } finally {
    await Deno.remove(file);
  }
});

Deno.test("parseCreateCardArgs: mutual exclusion", async () => {
  await assertRejects(
    () =>
      parseCreateCardArgs([
        "stories",
        "T",
        "--description",
        "hi",
        "--description-file",
        "/tmp/x",
      ]),
    Error,
    "mutually exclusive",
  );
});

Deno.test("parseCreateCardArgs: --description-file missing path errors", async () => {
  await assertRejects(
    () =>
      parseCreateCardArgs([
        "stories",
        "T",
        "--description-file",
        "/does/not/exist/devflow-create-card-test",
      ]),
    Error,
    "cannot read",
  );
});

Deno.test("parseCreateCardArgs: empty --description rejected", async () => {
  await assertRejects(
    () => parseCreateCardArgs(["stories", "T", "--description", ""]),
    Error,
    "empty",
  );
});

Deno.test("parseCreateCardArgs: empty --description-file rejected", async () => {
  const file = await Deno.makeTempFile();
  try {
    await Deno.writeTextFile(file, "");
    await assertRejects(
      () => parseCreateCardArgs(["stories", "T", "--description-file", file]),
      Error,
      "empty",
    );
  } finally {
    await Deno.remove(file);
  }
});

Deno.test("parseCreateCardArgs: --description-file with only newlines rejected", async () => {
  const file = await Deno.makeTempFile();
  try {
    await Deno.writeTextFile(file, "\n\n");
    await assertRejects(
      () => parseCreateCardArgs(["stories", "T", "--description-file", file]),
      Error,
      "empty",
    );
  } finally {
    await Deno.remove(file);
  }
});

Deno.test("parseCreateCardArgs: requires board and title", async () => {
  await assertRejects(
    () => parseCreateCardArgs(["stories"]),
    Error,
    "board name and title required",
  );
});

Deno.test("parseCreateCardArgs: rejects unexpected positional", async () => {
  await assertRejects(
    () => parseCreateCardArgs(["stories", "T", "extra"]),
    Error,
    "unexpected argument",
  );
});

Deno.test("parseCreateCardArgs: --description requires a value", async () => {
  await assertRejects(
    () => parseCreateCardArgs(["stories", "T", "--description"]),
    Error,
    "requires a value",
  );
});
