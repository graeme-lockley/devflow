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

Deno.test("parseCommand board list and synonyms", () => {
  assertEquals(parseCommand(["board", "list"]), {
    object: "board",
    verb: "list",
    positional: [],
  });
  assertEquals(parseCommand(["list-boards"]), {
    object: "board",
    verb: "list",
    positional: [],
  });
  assertEquals(parseCommand(["show-board", "stories"]), {
    object: "board",
    verb: "show",
    positional: ["stories"],
  });
  assertEquals(parseCommand(["validate-board", "stories"]), {
    object: "board",
    verb: "validate",
    positional: ["stories"],
  });
});
