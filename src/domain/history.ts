import type {
  CardState,
  CreatedEvent,
  FileAttachedEvent,
  HistoryEvent,
  TitleChangedEvent,
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
