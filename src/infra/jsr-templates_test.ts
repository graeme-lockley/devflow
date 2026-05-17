import { assertEquals } from "@std/assert";
import { ensureJsrBuiltinTemplateDir } from "./jsr-templates.ts";

Deno.test("ensureJsrBuiltinTemplateDir downloads stories from JSR", async () => {
  const dir = await ensureJsrBuiltinTemplateDir(
    "stories",
    "https://jsr.io/@kestrel/devflow/0.1.2/src/services/templates.ts",
  );
  assertEquals(
    (await Deno.stat(`${dir}/scripts/preparing-002-do-create-story`)).isFile,
    true,
  );
  assertEquals(
    (await Deno.stat(`${dir}/skills/plan-story/SKILL.md`)).isFile,
    true,
  );
  const prep = await Deno.stat(`${dir}/scripts/preparing-001-check-git-clean`);
  assertEquals(prep.isFile, true);
  assertEquals((prep.mode ?? 0) & 0o111, 0o111);
});
