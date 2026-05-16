import { assertEquals } from "@std/assert";
import { parseCommand } from "./parser.ts";

Deno.test("parseCommand validate synonym (req §17)", () => {
  assertEquals(parseCommand(["validate"]), {
    object: "repo",
    verb: "validate",
    positional: [],
  });
});

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

Deno.test("parseCommand card advance synonym (req §11)", () => {
  assertEquals(
    parseCommand(["card", "advance", "stories-000001", "building"]),
    {
      object: "card",
      verb: "advance",
      positional: ["stories-000001", "building"],
    },
  );
  assertEquals(parseCommand(["advance-card", "stories-000001", "building"]), {
    object: "card",
    verb: "advance",
    positional: ["stories-000001", "building"],
  });
});

Deno.test("parseCommand lock release synonyms (req §14.6)", () => {
  assertEquals(parseCommand(["lock", "release", "stories-000001"]), {
    object: "lock",
    verb: "release",
    positional: ["stories-000001"],
  });
  assertEquals(parseCommand(["release-lock", "stories-000001"]), {
    object: "lock",
    verb: "release",
    positional: ["stories-000001"],
  });
  assertEquals(parseCommand(["lock", "release-board", "stories"]), {
    object: "lock",
    verb: "release-board",
    positional: ["stories"],
  });
  assertEquals(parseCommand(["release-repo-lock"]), {
    object: "lock",
    verb: "release-repo",
    positional: [],
  });
});
