import { assertEquals } from "@std/assert";
import { parseCommand } from "./parser.ts";

Deno.test("parseCommand canonical board init", () => {
  assertEquals(parseCommand(["board", "init", "stories", "todo"]), {
    object: "board",
    verb: "init",
    positional: ["stories", "todo"],
  });
});

Deno.test("parseCommand init-board synonym", () => {
  assertEquals(parseCommand(["init-board", "stories", "todo"]), {
    object: "board",
    verb: "init",
    positional: ["stories", "todo"],
  });
});
