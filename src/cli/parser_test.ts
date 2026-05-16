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

Deno.test("parseCommand card block and unblock synonyms", () => {
  assertEquals(parseCommand(["card", "block", "stories-000001", "Waiting"]), {
    object: "card",
    verb: "block",
    positional: ["stories-000001", "Waiting"],
  });
  assertEquals(
    parseCommand(["block-card", "stories-000001", "Waiting for API"]),
    {
      object: "card",
      verb: "block",
      positional: ["stories-000001", "Waiting for API"],
    },
  );
  assertEquals(parseCommand(["card", "unblock", "stories-000001"]), {
    object: "card",
    verb: "unblock",
    positional: ["stories-000001"],
  });
  assertEquals(parseCommand(["unblock-card", "stories-000001"]), {
    object: "card",
    verb: "unblock",
    positional: ["stories-000001"],
  });
});
