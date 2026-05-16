import { assertEquals } from "@std/assert";
import type { CardState } from "./card.ts";
import {
  appendHistory,
  phaseChangedEvent,
  transitionFailedEvent,
  utcNow,
} from "./history.ts";

const baseState: CardState = {
  id: "stories-000001",
  board: "stories",
  title: "Test",
  phase: "planning",
  previousPhase: null,
  createdAt: "2026-05-16T07:00:00Z",
  updatedAt: "2026-05-16T07:00:00Z",
  variables: {},
  history: [],
  blocked: null,
};

Deno.test("phaseChangedEvent updates updatedAt via appendHistory", () => {
  const at = utcNow();
  const next = appendHistory(
    baseState,
    phaseChangedEvent("planning", "planned", at),
  );
  assertEquals(next.phase, "planning");
  assertEquals(next.updatedAt, at);
  assertEquals(next.history.length, 1);
  assertEquals(next.history[0], {
    type: "phaseChanged",
    at,
    from: "planning",
    to: "planned",
    mode: "normal",
  });
});

Deno.test("transitionFailedEvent via appendHistory", () => {
  const at = utcNow();
  const next = appendHistory(
    baseState,
    transitionFailedEvent("planning", "planned", "planning-001-x", 1, at),
  );
  assertEquals(next.history[0].type, "transitionFailed");
});
