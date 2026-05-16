import { assertEquals, assertThrows } from "@std/assert";
import { parseAdvanceArgs } from "./advance-flags.ts";

Deno.test("parseAdvanceArgs - basic args", () => {
  assertEquals(
    parseAdvanceArgs(["test-000001", "building", "--force"]),
    { cardId: "test-000001", targetPhase: "building", force: true, skip: [] },
  );
  assertEquals(
    parseAdvanceArgs(["--force", "test-000001", "building"]),
    { cardId: "test-000001", targetPhase: "building", force: true, skip: [] },
  );
  assertEquals(
    parseAdvanceArgs(["test-000001", "building"]),
    { cardId: "test-000001", targetPhase: "building", force: false, skip: [] },
  );
});

Deno.test("parseAdvanceArgs - skip single action", () => {
  assertEquals(
    parseAdvanceArgs(["test-000001", "building", "--skip", "planning-003"]),
    {
      cardId: "test-000001",
      targetPhase: "building",
      force: false,
      skip: ["planning-003"],
    },
  );
  assertEquals(
    parseAdvanceArgs(["test-000001", "building", "--skip=planning-003"]),
    {
      cardId: "test-000001",
      targetPhase: "building",
      force: false,
      skip: ["planning-003"],
    },
  );
});

Deno.test("parseAdvanceArgs - skip multiple comma-separated", () => {
  assertEquals(
    parseAdvanceArgs([
      "test-000001",
      "building",
      "--skip",
      "planning-003,planning-005",
    ]),
    {
      cardId: "test-000001",
      targetPhase: "building",
      force: false,
      skip: ["planning-003", "planning-005"],
    },
  );
  assertEquals(
    parseAdvanceArgs(["test-000001", "building", "--skip=a-001,b-002"]),
    {
      cardId: "test-000001",
      targetPhase: "building",
      force: false,
      skip: ["a-001", "b-002"],
    },
  );
});

Deno.test("parseAdvanceArgs - skip repeated flags", () => {
  assertEquals(
    parseAdvanceArgs([
      "test-000001",
      "building",
      "--skip",
      "planning-003",
      "--skip",
      "building-001",
    ]),
    {
      cardId: "test-000001",
      targetPhase: "building",
      force: false,
      skip: ["planning-003", "building-001"],
    },
  );
});

Deno.test("parseAdvanceArgs - skip full action name (normalized to prefix)", () => {
  assertEquals(
    parseAdvanceArgs([
      "test-000001",
      "building",
      "--skip",
      "planning-003-do-planning",
    ]),
    {
      cardId: "test-000001",
      targetPhase: "building",
      force: false,
      skip: ["planning-003"],
    },
  );
  assertEquals(
    parseAdvanceArgs([
      "test-000001",
      "building",
      "--skip",
      "planning-003-do-planning,building-001-run-tests",
    ]),
    {
      cardId: "test-000001",
      targetPhase: "building",
      force: false,
      skip: ["planning-003", "building-001"],
    },
  );
});

Deno.test("parseAdvanceArgs - skip deduplicates", () => {
  assertEquals(
    parseAdvanceArgs([
      "test-000001",
      "building",
      "--skip",
      "planning-003,planning-003",
    ]),
    {
      cardId: "test-000001",
      targetPhase: "building",
      force: false,
      skip: ["planning-003"],
    },
  );
  assertEquals(
    parseAdvanceArgs([
      "test-000001",
      "building",
      "--skip",
      "planning-003-foo",
      "--skip",
      "planning-003-bar",
    ]),
    {
      cardId: "test-000001",
      targetPhase: "building",
      force: false,
      skip: ["planning-003"],
    },
  );
});

Deno.test("parseAdvanceArgs - skip with spaces in comma list", () => {
  assertEquals(
    parseAdvanceArgs([
      "test-000001",
      "building",
      "--skip",
      "planning-003, building-001",
    ]),
    {
      cardId: "test-000001",
      targetPhase: "building",
      force: false,
      skip: ["planning-003", "building-001"],
    },
  );
});

Deno.test("parseAdvanceArgs - skip shape validation errors", () => {
  assertThrows(
    () =>
      parseAdvanceArgs(["test-000001", "building", "--skip", "planning_003"]),
    Error,
    'invalid --skip token "planning_003"',
  );
  assertThrows(
    () => parseAdvanceArgs(["test-000001", "building", "--skip", "planning-3"]),
    Error,
    'invalid --skip token "planning-3"',
  );
  assertThrows(
    () =>
      parseAdvanceArgs(["test-000001", "building", "--skip", "do-planning"]),
    Error,
    'invalid --skip token "do-planning"',
  );
  assertThrows(
    () =>
      parseAdvanceArgs(["test-000001", "building", "--skip", "Planning-003"]),
    Error,
    'invalid --skip token "Planning-003"',
  );
  assertThrows(
    () =>
      parseAdvanceArgs([
        "test-000001",
        "building",
        "--skip",
        "planning-003-Do-planning",
      ]),
    Error,
    'invalid --skip token "planning-003-Do-planning"',
  );
});

Deno.test("parseAdvanceArgs - skip requires value", () => {
  assertThrows(
    () => parseAdvanceArgs(["test-000001", "building", "--skip"]),
    Error,
    "--skip requires a value",
  );
  assertThrows(
    () => parseAdvanceArgs(["test-000001", "building", "--skip="]),
    Error,
    "--skip requires a value",
  );
});
