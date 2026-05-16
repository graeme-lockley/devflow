import { assertEquals } from "@std/assert";
import { parseAdvanceArgs } from "./advance-flags.ts";

Deno.test("parseAdvanceArgs", () => {
  assertEquals(
    parseAdvanceArgs(["test-000001", "building", "--force"]),
    { cardId: "test-000001", targetPhase: "building", force: true },
  );
  assertEquals(
    parseAdvanceArgs(["--force", "test-000001", "building"]),
    { cardId: "test-000001", targetPhase: "building", force: true },
  );
});
