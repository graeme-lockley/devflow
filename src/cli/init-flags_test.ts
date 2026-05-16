import { assertEquals, assertThrows } from "@std/assert";
import { parseInitArgs } from "./init-flags.ts";

Deno.test("parseInitArgs strips flags and keeps phases", () => {
  assertEquals(
    parseInitArgs([
      "unplanned",
      "--sequence-width",
      "4",
      "planning",
      "--template",
      "stories",
    ]),
    {
      phaseNames: ["unplanned", "planning"],
      options: { sequenceWidth: 4, template: "stories" },
    },
  );
});

Deno.test("parseInitArgs rejects unknown flag", () => {
  assertThrows(
    () => parseInitArgs(["--foo"]),
    Error,
    "unknown flag",
  );
});
