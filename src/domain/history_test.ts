import { assertEquals } from "@std/assert";
import type { CardState } from "./card.ts";
import {
  appendHistory,
  blockedEvent,
  createdEvent,
  fileAttachedEvent,
  titleChangedEvent,
  unblockedEvent,
  utcNow,
} from "./history.ts";

const baseState: CardState = {
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
};

Deno.test("utcNow returns ISO 8601 with Z suffix (req §6.8)", () => {
  const s = utcNow(new Date("2026-05-16T07:00:00.000Z"));
  assertEquals(s, "2026-05-16T07:00:00.000Z");
  assertEquals(s.endsWith("Z"), true);
});

Deno.test("createdEvent shape (req §6.4)", () => {
  assertEquals(createdEvent("unplanned", "2026-05-16T07:00:00Z"), {
    type: "created",
    at: "2026-05-16T07:00:00Z",
    phase: "unplanned",
  });
});

Deno.test("appendHistory appends and updates updatedAt", () => {
  const at = "2026-05-16T08:00:00.000Z";
  const next = appendHistory(baseState, titleChangedEvent("Old", "New", at));
  assertEquals(next.history.length, 1);
  assertEquals(next.history[0], {
    type: "titleChanged",
    at,
    from: "Old",
    to: "New",
  });
  assertEquals(next.updatedAt, at);
});

Deno.test("fileAttachedEvent shape", () => {
  assertEquals(
    fileAttachedEvent("doc.pdf", "2026-05-16T08:00:00.000Z"),
    {
      type: "fileAttached",
      at: "2026-05-16T08:00:00.000Z",
      filename: "doc.pdf",
    },
  );
});

Deno.test("blockedEvent shape (req §12.1)", () => {
  assertEquals(
    blockedEvent(
      "building",
      "Waiting for API contract",
      "2026-05-16T07:25:00Z",
    ),
    {
      type: "blocked",
      at: "2026-05-16T07:25:00Z",
      from: "building",
      reason: "Waiting for API contract",
    },
  );
});

Deno.test("unblockedEvent shape (req §12.2)", () => {
  assertEquals(unblockedEvent("building", "2026-05-16T08:00:00.000Z"), {
    type: "unblocked",
    at: "2026-05-16T08:00:00.000Z",
    to: "building",
  });
});

Deno.test("appendHistory with blocked event updates updatedAt", () => {
  const at = "2026-05-16T07:25:00.000Z";
  const next = appendHistory(
    baseState,
    blockedEvent("todo", "Waiting", at),
  );
  assertEquals(next.history.length, 1);
  assertEquals(next.updatedAt, at);
});
