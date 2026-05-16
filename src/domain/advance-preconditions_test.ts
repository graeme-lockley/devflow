import { assertThrows } from "@std/assert";
import { createBoardConfig } from "./board.ts";
import type { CardState } from "./card.ts";
import { assertAdvanceAllowed } from "./advance-preconditions.ts";

function baseCard(overrides: Partial<CardState> = {}): CardState {
  return {
    id: "stories-000001",
    board: "stories",
    title: "Test",
    phase: "todo",
    previousPhase: null,
    createdAt: "2026-05-16T07:00:00.000Z",
    updatedAt: "2026-05-16T07:00:00.000Z",
    variables: {},
    history: [],
    blocked: null,
    ...overrides,
  };
}

Deno.test("assertAdvanceAllowed rejects blocked card (req §12.3)", () => {
  const board = createBoardConfig("stories", ["todo", "done"]);
  const state = baseCard({
    phase: "blocked",
    previousPhase: "todo",
    blocked: { reason: "Waiting", blockedAt: "2026-05-16T07:25:00.000Z" },
  });

  assertThrows(
    () => assertAdvanceAllowed(state, board, "done"),
    Error,
    "card is blocked; unblock before advancing",
  );
});

Deno.test("assertAdvanceAllowed rejects blocked phase as target", () => {
  const board = createBoardConfig("stories", ["todo", "done"]);

  assertThrows(
    () => assertAdvanceAllowed(baseCard(), board, "blocked"),
    Error,
    "cannot advance to blocked phase",
  );
});

Deno.test("assertAdvanceAllowed rejects force on blocked card", () => {
  const board = createBoardConfig("stories", ["todo", "done"]);
  const state = baseCard({
    phase: "blocked",
    previousPhase: "todo",
    blocked: { reason: "Waiting", blockedAt: "2026-05-16T07:25:00.000Z" },
  });

  assertThrows(
    () => assertAdvanceAllowed(state, board, "done", { force: true }),
    Error,
    "cannot force-advance a blocked card",
  );
});

Deno.test("assertAdvanceAllowed allows normal advance target", () => {
  const board = createBoardConfig("stories", ["todo", "done"]);
  assertAdvanceAllowed(baseCard(), board, "done");
});
