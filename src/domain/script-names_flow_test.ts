import { assertEquals } from "@std/assert";
import { resolveExitScriptPrefix } from "./script-names.ts";

Deno.test("resolveExitScriptPrefix: one match", () => {
  const scripts = ["building-001-foo", "building-002-bar", "building-003-baz"];
  const result = resolveExitScriptPrefix("building-002", scripts);
  assertEquals(result, { ok: true, name: "building-002-bar" });
});

Deno.test("resolveExitScriptPrefix: zero matches", () => {
  const scripts = ["building-001-foo", "building-002-bar"];
  const result = resolveExitScriptPrefix("building-999", scripts);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(
      result.error,
      'NEXT_SCRIPT prefix "building-999" does not match any exit script',
    );
  }
});

Deno.test("resolveExitScriptPrefix: multiple matches", () => {
  const scripts = [
    "building-001-foo",
    "building-001-bar",
    "building-002-baz",
  ];
  const result = resolveExitScriptPrefix("building-001", scripts);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(
      result.error,
      'NEXT_SCRIPT prefix "building-001" matches multiple scripts: building-001-foo, building-001-bar',
    );
  }
});

Deno.test("resolveExitScriptPrefix: invalid form (no sequence)", () => {
  const scripts = ["building-001-foo"];
  const result = resolveExitScriptPrefix("building", scripts);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(
      result.error,
      'NEXT_SCRIPT prefix "building" does not match <phase>-<sequence> form',
    );
  }
});

Deno.test("resolveExitScriptPrefix: invalid form (sequence not 3 digits)", () => {
  const scripts = ["building-001-foo"];
  const result = resolveExitScriptPrefix("building-1", scripts);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(
      result.error,
      'NEXT_SCRIPT prefix "building-1" does not match <phase>-<sequence> form',
    );
  }
});

Deno.test("resolveExitScriptPrefix: invalid form (uppercase phase)", () => {
  const scripts = ["building-001-foo"];
  const result = resolveExitScriptPrefix("Building-001", scripts);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(
      result.error,
      'NEXT_SCRIPT prefix "Building-001" does not match <phase>-<sequence> form',
    );
  }
});
