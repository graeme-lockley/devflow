import type {
  ActionSkippedEvent,
  BlockedEvent,
  CardState,
  CreatedEvent,
  FileAttachedEvent,
  HistoryEvent,
  PhaseChangedEvent,
  TitleChangedEvent,
  TransitionFailedEvent,
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

export function phaseChangedEvent(
  from: string,
  to: string,
  at: string,
  mode: PhaseChangedEvent["mode"] = "normal",
): PhaseChangedEvent {
  return { type: "phaseChanged", at, from, to, mode };
}

export function transitionFailedEvent(
  from: string,
  to: string,
  script: string,
  exitCode: number,
  at: string,
): TransitionFailedEvent {
  return { type: "transitionFailed", at, from, to, script, exitCode };
}

export function actionSkippedEvent(
  from: string,
  to: string,
  script: string,
  at: string,
): ActionSkippedEvent {
  return { type: "actionSkipped", at, from, to, script };
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
