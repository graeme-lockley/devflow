import { assertEquals, assertThrows } from "@std/assert";
import { createBoardConfig } from "./board.ts";
import {
  assertForwardTarget,
  assertNormalPhase,
  enumerateHops,
  isAtTarget,
  nextPhase,
  phaseIndex,
} from "./phases.ts";

const board = createBoardConfig("stories", [
  "unplanned",
  "planning",
  "planned",
  "building",
]);

Deno.test("phaseIndex and nextPhase (req §11.3)", () => {
  assertEquals(phaseIndex(board, "planning"), 1);
  assertEquals(nextPhase(board, "planning"), "planned");
  assertEquals(nextPhase(board, "building"), null);
});

Deno.test("enumerateHops multi-hop (req §11.3)", () => {
  assertEquals(enumerateHops(board, "unplanned", "building"), [
    { from: "unplanned", to: "planning" },
    { from: "planning", to: "planned" },
    { from: "planned", to: "building" },
  ]);
  assertEquals(enumerateHops(board, "planning", "planning"), []);
});

Deno.test("assertForwardTarget rejects backward (req §11.7)", () => {
  assertThrows(
    () => assertForwardTarget(board, "building", "planning"),
    Error,
    "behind current phase",
  );
});

Deno.test("assertNormalPhase rejects unknown and blocked", () => {
  assertThrows(
    () => assertNormalPhase(board, "nope"),
    Error,
    'unknown phase "nope"',
  );
  assertThrows(
    () => assertNormalPhase(board, "blocked"),
    Error,
    "blocked phase",
  );
});

Deno.test("isAtTarget (req §11.6)", () => {
  assertEquals(isAtTarget("building", "building"), true);
  assertEquals(isAtTarget("planning", "building"), false);
});
