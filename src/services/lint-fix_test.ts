import { assertEquals } from "@std/assert";
import {
  removeNamedImportBinding,
  removeWholeImportLine,
} from "../../templates/stories/scripts/lib/lint-fix.ts";

Deno.test("removeNamedImportBinding removes trailing binding", () => {
  const line = 'import { assertEquals, assertExists } from "@std/assert";';
  assertEquals(
    removeNamedImportBinding(line, "assertExists"),
    'import { assertEquals } from "@std/assert";',
  );
});

Deno.test("removeNamedImportBinding removes leading binding", () => {
  const line = 'import { assertExists, assertEquals } from "@std/assert";';
  assertEquals(
    removeNamedImportBinding(line, "assertExists"),
    'import { assertEquals } from "@std/assert";',
  );
});

Deno.test("removeNamedImportBinding returns null for sole binding", () => {
  const line = 'import { assertExists } from "@std/assert";';
  assertEquals(removeNamedImportBinding(line, "assertExists"), null);
});

Deno.test("removeWholeImportLine detects default import", () => {
  const line = 'import foo from "./foo.ts";';
  const range = { start: { line: 0, col: 0 }, end: { line: 0, col: 3 } };
  assertEquals(removeWholeImportLine(line, "foo", range), true);
});

Deno.test("lint-fix.ts removes unused import in repo", async () => {
  const file = "src/services/.lint-fix-temp_test.ts";
  await Deno.writeTextFile(
    file,
    'import { assertEquals, assertExists } from "@std/assert";\nassertEquals(1, 1);\n',
  );
  try {
    const cmd = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "--allow-read",
        "--allow-write",
        "--allow-run",
        "./templates/stories/scripts/lib/lint-fix.ts",
      ],
      stdout: "piped",
      stderr: "piped",
    });
    const { code, stdout } = await cmd.output();
    assertEquals(code, 0);
    const out = new TextDecoder().decode(stdout);
    assertEquals(out.includes("assertExists"), true, "should report a fix");
    const text = await Deno.readTextFile(file);
    assertEquals(text.includes("assertExists"), false);
  } finally {
    await Deno.remove(file);
  }
});
