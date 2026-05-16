import { writeTextFileAtomic } from "../infra/atomic-write.ts";
import { cardStateFile } from "../infra/paths.ts";

export { isSequenceExhausted, maxSequenceForWidth } from "./validate-board.ts";

export interface BlockedMetadata {
  reason: string;
  blockedAt: string;
}

export interface CardState {
  id: string;
  board: string;
  title: string;
  phase: string;
  previousPhase: string | null;
  createdAt: string;
  updatedAt: string;
  variables: Record<string, string>;
  history: HistoryEvent[];
  blocked: BlockedMetadata | null;
}

export type HistoryEvent =
  | CreatedEvent
  | TitleChangedEvent
  | FileAttachedEvent
  | BlockedEvent
  | UnblockedEvent
  | Record<string, unknown>;

export interface CreatedEvent {
  type: "created";
  at: string;
  phase: string;
}

export interface TitleChangedEvent {
  type: "titleChanged";
  at: string;
  from: string;
  to: string;
}

export interface FileAttachedEvent {
  type: "fileAttached";
  at: string;
  filename: string;
}

export interface BlockedEvent {
  type: "blocked";
  at: string;
  from: string;
  reason: string;
}

export interface UnblockedEvent {
  type: "unblocked";
  at: string;
  to: string;
}

export function formatCardId(
  idPrefix: string,
  sequence: number,
  sequenceWidth: number,
): string {
  const suffix = String(sequence).padStart(sequenceWidth, "0");
  return `${idPrefix}-${suffix}`;
}

export interface ParsedCardId {
  idPrefix: string;
  sequence: number;
  suffix: string;
}

/**
 * Parses a card ID into prefix and numeric sequence.
 * Returns null if the ID does not match idPrefix + zero-padded digits.
 */
export function parseCardId(
  cardId: string,
  idPrefix: string,
): ParsedCardId | null {
  const prefix = `${idPrefix}-`;
  if (!cardId.startsWith(prefix)) return null;
  const suffix = cardId.slice(prefix.length);
  if (!/^\d+$/.test(suffix)) return null;
  const sequence = Number.parseInt(suffix, 10);
  if (!Number.isInteger(sequence) || sequence < 0) return null;
  return { idPrefix, sequence, suffix };
}

/**
 * Resolves board name from card ID using board idPrefix (equals board name).
 */
export function resolveBoardFromCardId(
  cardId: string,
  boards: { name: string; idPrefix: string }[],
): string | null {
  for (const board of boards) {
    if (parseCardId(cardId, board.idPrefix) !== null) {
      return board.name;
    }
  }
  return null;
}

export function resolveBoardFromCardIdWithPrefix(
  cardId: string,
  idPrefix: string,
): string | null {
  return parseCardId(cardId, idPrefix) !== null ? idPrefix : null;
}

export function cardStatePath(
  repoRoot: string,
  boardName: string,
  cardId: string,
): string {
  return `${repoRoot}/${cardStateFile(boardName, cardId)}`;
}

export function serializeCardState(state: CardState): string {
  return JSON.stringify(state, null, 2) + "\n";
}

export function parseCardState(raw: unknown, cardId: string): CardState {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(`card "${cardId}": state.json must be a JSON object`);
  }

  const o = raw as Record<string, unknown>;
  const required = [
    "id",
    "board",
    "title",
    "phase",
    "previousPhase",
    "createdAt",
    "updatedAt",
    "variables",
    "history",
    "blocked",
  ] as const;

  for (const key of required) {
    if (!(key in o)) {
      throw new Error(
        `card "${cardId}": state.json missing required field "${key}"`,
      );
    }
  }

  if (typeof o.id !== "string") {
    throw new Error(`card "${cardId}": "id" must be a string`);
  }
  if (typeof o.board !== "string") {
    throw new Error(`card "${cardId}": "board" must be a string`);
  }
  if (typeof o.title !== "string") {
    throw new Error(`card "${cardId}": "title" must be a string`);
  }
  if (typeof o.phase !== "string") {
    throw new Error(`card "${cardId}": "phase" must be a string`);
  }
  if (o.previousPhase !== null && typeof o.previousPhase !== "string") {
    throw new Error(
      `card "${cardId}": "previousPhase" must be a string or null`,
    );
  }
  if (typeof o.createdAt !== "string") {
    throw new Error(`card "${cardId}": "createdAt" must be a string`);
  }
  if (typeof o.updatedAt !== "string") {
    throw new Error(`card "${cardId}": "updatedAt" must be a string`);
  }
  if (
    typeof o.variables !== "object" ||
    o.variables === null ||
    Array.isArray(o.variables)
  ) {
    throw new Error(`card "${cardId}": "variables" must be an object`);
  }
  const variables = o.variables as Record<string, unknown>;
  for (const [k, v] of Object.entries(variables)) {
    if (typeof v !== "string") {
      throw new Error(`card "${cardId}": variable "${k}" must be a string`);
    }
  }
  if (!Array.isArray(o.history)) {
    throw new Error(`card "${cardId}": "history" must be an array`);
  }
  if (o.blocked !== null) {
    if (typeof o.blocked !== "object" || Array.isArray(o.blocked)) {
      throw new Error(`card "${cardId}": "blocked" must be an object or null`);
    }
    const b = o.blocked as Record<string, unknown>;
    if (typeof b.reason !== "string" || typeof b.blockedAt !== "string") {
      throw new Error(
        `card "${cardId}": "blocked" must have string "reason" and "blockedAt"`,
      );
    }
  }

  return {
    id: o.id,
    board: o.board,
    title: o.title,
    phase: o.phase,
    previousPhase: o.previousPhase as string | null,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    variables: o.variables as Record<string, string>,
    history: o.history as HistoryEvent[],
    blocked: o.blocked as BlockedMetadata | null,
  };
}

export async function loadCardState(
  repoRoot: string,
  boardName: string,
  cardId: string,
): Promise<CardState> {
  const path = cardStatePath(repoRoot, boardName, cardId);
  let raw: string;
  try {
    raw = await Deno.readTextFile(path);
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      throw new Error(
        `card "${cardId}" not found at ${cardStateFile(boardName, cardId)}`,
      );
    }
    throw e;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`card "${cardId}": state.json is not valid JSON`);
  }

  return parseCardState(parsed, cardId);
}

export async function saveCardState(
  repoRoot: string,
  boardName: string,
  state: CardState,
): Promise<void> {
  const path = cardStatePath(repoRoot, boardName, state.id);
  await writeTextFileAtomic(path, serializeCardState(state));
}
