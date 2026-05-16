import { assertEquals } from "@std/assert";
import { createBoardConfig } from "./board.ts";
import {
  isSequenceExhausted,
  maxSequenceForWidth,
  validateBoardConfig,
} from "./validate-board.ts";

Deno.test("isSequenceExhausted at boundary", () => {
  assertEquals(maxSequenceForWidth(6), 999999);
  assertEquals(isSequenceExhausted(999999, 6), false);
  assertEquals(isSequenceExhausted(1000000, 6), true);
});

Deno.test("validateBoardConfig accepts valid config", () => {
  const config = createBoardConfig("stories", ["todo", "done"]);
  assertEquals(validateBoardConfig(config, "stories"), []);
});

Deno.test("validateBoardConfig rejects directory name mismatch", () => {
  const config = createBoardConfig("stories", ["todo"]);
  assertEquals(
    validateBoardConfig(config, "other")[0],
    'board name "stories" does not match directory name "other"',
  );
});

Deno.test("validateBoardConfig rejects duplicate phase", () => {
  const config = createBoardConfig("stories", ["todo", "todo"]);
  assertEquals(
    validateBoardConfig(config, "stories").some((p) => p.includes("duplicate")),
    true,
  );
});

Deno.test("validateBoardConfig rejects blocked in phases", () => {
  const config = createBoardConfig("stories", ["blocked", "todo"]);
  assertEquals(
    validateBoardConfig(config, "stories").some((p) => p.includes("reserved")),
    true,
  );
});

Deno.test("validateBoardConfig rejects invalid sequenceWidth", () => {
  const config = createBoardConfig("stories", ["todo"], { sequenceWidth: 0 });
  assertEquals(
    validateBoardConfig(config, "stories").some((p) => p.includes("sequenceWidth")),
    true,
  );

  const tooWide = createBoardConfig("stories", ["todo"], { sequenceWidth: 13 });
  assertEquals(
    validateBoardConfig(tooWide, "stories").some((p) => p.includes("sequenceWidth")),
    true,
  );
});

Deno.test("validateBoardConfig rejects exhausted nextSequence", () => {
  const config = createBoardConfig("stories", ["todo"], { sequenceWidth: 2 });
  config.nextSequence = 100;
  assertEquals(
    validateBoardConfig(config, "stories").some((p) => p.includes("exhausted")),
    true,
  );
});
