import { assertEquals } from "@std/assert";
import {
  parseGlobalFlags,
  resolveLogLevel,
  validateGlobalFlags,
} from "./flags.ts";

Deno.test("parseGlobalFlags strips known flags", () => {
  assertEquals(
    parseGlobalFlags(["board", "init", "stories", "--verbose"]),
    {
      remaining: ["board", "init", "stories"],
      verbose: true,
      summary: false,
      ignoreLock: false,
    },
  );
});

Deno.test("validateGlobalFlags rejects verbose and summary together", () => {
  const flags = parseGlobalFlags(["--verbose", "--summary", "board", "init"]);
  assertEquals(
    validateGlobalFlags(flags),
    "devflow: --verbose and --summary are mutually exclusive",
  );
});

Deno.test("resolveLogLevel defaults to info", () => {
  assertEquals(resolveLogLevel(parseGlobalFlags([])), "info");
  assertEquals(resolveLogLevel(parseGlobalFlags(["--verbose"])), "verbose");
  assertEquals(resolveLogLevel(parseGlobalFlags(["--summary"])), "summary");
});
