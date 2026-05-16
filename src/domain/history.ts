import type {
  BlockedEvent,
  CardState,
  CreatedEvent,
  FileAttachedEvent,
  HistoryEvent,
  TitleChangedEvent,
  UnblockedEvent,
} from "./card.ts";

/** UTC ISO 8601 with Z suffix (req §6.8). */
export function utcNow(date: Date = new Date()): string {
  return date.toISOString();
}

export function createdEvent(phase: string, at: string): CreatedEvent {
  return { type: "created", at, phase };
}

export function titleChangedEvent(
  from: string,
  to: string,
  at: string,
): TitleChangedEvent {
  return { type: "titleChanged", at, from, to };
}

export function fileAttachedEvent(
  filename: string,
  at: string,
): FileAttachedEvent {
  return { type: "fileAttached", at, filename };
}

export function blockedEvent(
  from: string,
  reason: string,
  at: string,
): BlockedEvent {
  return { type: "blocked", at, from, reason };
}

export function unblockedEvent(to: string, at: string): UnblockedEvent {
  return { type: "unblocked", at, to };
}

export function appendHistory(
  state: CardState,
  event: HistoryEvent,
): CardState {
  return {
    ...state,
    history: [...state.history, event],
    updatedAt: "at" in event && typeof event.at === "string"
      ? event.at
      : state.updatedAt,
  };
}
