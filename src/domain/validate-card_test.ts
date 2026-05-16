import { assertEquals } from "@std/assert";
import { createBoardConfig } from "./board.ts";
import type { CardState } from "./card.ts";
import { validateCardState } from "./validate-card.ts";

function baseCard(overrides: Partial<CardState> = {}): CardState {
  return {
    id: "stories-000001",
    board: "stories",
    title: "Test card",
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

Deno.test("validateCardState accepts valid blocked card (req §17.2)", () => {
  const board = createBoardConfig("stories", ["todo", "done"]);
  const state = baseCard({
    phase: "blocked",
    previousPhase: "todo",
    blocked: {
      reason: "Waiting",
      blockedAt: "2026-05-16T07:25:00.000Z",
    },
  });
  assertEquals(
    validateCardState(state, "stories-000001", board, [state.id]),
    [],
  );
});

Deno.test("validateCardState rejects invalid previousPhase when blocked", () => {
  const board = createBoardConfig("stories", ["todo", "done"]);
  const state = baseCard({
    phase: "blocked",
    previousPhase: "invalid",
    blocked: {
      reason: "Waiting",
      blockedAt: "2026-05-16T07:25:00.000Z",
    },
  });
  const problems = validateCardState(state, "stories-000001", board, [
    state.id,
  ]);
  assertEquals(
    problems.some((p) =>
      p.includes("previousPhase") && p.includes("normal phase")
    ),
    true,
  );
});

Deno.test("validateCardState rejects blockedPhase as previousPhase", () => {
  const board = createBoardConfig("stories", ["todo", "done"]);
  const state = baseCard({
    phase: "blocked",
    previousPhase: "blocked",
    blocked: {
      reason: "Waiting",
      blockedAt: "2026-05-16T07:25:00.000Z",
    },
  });
  const problems = validateCardState(state, "stories-000001", board, [
    state.id,
  ]);
  assertEquals(
    problems.some((p) => p.includes("previousPhase")),
    true,
  );
});

Deno.test("validateCardState rejects invalid blockedAt", () => {
  const board = createBoardConfig("stories", ["todo", "done"]);
  const state = baseCard({
    phase: "blocked",
    previousPhase: "todo",
    blocked: {
      reason: "Waiting",
      blockedAt: "not-a-timestamp",
    },
  });
  const problems = validateCardState(state, "stories-000001", board, [
    state.id,
  ]);
  assertEquals(
    problems.some((p) => p.includes("blocked.blockedAt")),
    true,
  );
});

Deno.test("validateCardState rejects stray previousPhase when not blocked", () => {
  const board = createBoardConfig("stories", ["todo", "done"]);
  const state = baseCard({ previousPhase: "todo" });
  const problems = validateCardState(state, "stories-000001", board, [
    state.id,
  ]);
  assertEquals(
    problems.some((p) => p.includes("previousPhase must be null")),
    true,
  );
});
