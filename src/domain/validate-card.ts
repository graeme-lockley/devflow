import type { BoardConfig } from "./board.ts";
import { loadBoardConfig } from "./board.ts";
import { boardCardsDir } from "../infra/paths.ts";
import { type CardState, parseCardId, parseCardState } from "./card.ts";
import {
  cardDir,
  cardFilesDir,
  cardLogsDir,
  cardMdFile,
  cardStateFile,
} from "../infra/paths.ts";

const UTC_ISO_Z = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

function isValidUtcTimestamp(s: string): boolean {
  return UTC_ISO_Z.test(s) && !Number.isNaN(Date.parse(s));
}

export function validateCardState(
  state: CardState,
  cardDirName: string,
  board: BoardConfig,
  allCardIds: string[],
): string[] {
  const problems: string[] = [];

  if (state.id !== cardDirName) {
    problems.push(
      `card ID "${state.id}" does not match directory name "${cardDirName}"`,
    );
  }

  if (state.board !== board.name) {
    problems.push(
      `card board "${state.board}" does not match board name "${board.name}"`,
    );
  }

  const parsed = parseCardId(state.id, board.idPrefix);
  if (parsed === null) {
    problems.push(
      `card ID "${state.id}" does not match board idPrefix "${board.idPrefix}"`,
    );
  } else if (parsed.suffix.length !== board.sequenceWidth) {
    problems.push(
      `card ID suffix length ${parsed.suffix.length} does not match sequenceWidth ${board.sequenceWidth}`,
    );
  }

  if (!state.title.trim()) {
    problems.push("title must not be empty");
  }

  const validPhases = new Set([...board.phases, board.blockedPhase]);
  if (!validPhases.has(state.phase)) {
    problems.push(`invalid phase "${state.phase}"`);
  }

  const isBlocked = state.phase === board.blockedPhase;
  if (isBlocked && state.blocked === null) {
    problems.push("phase is blocked but blocked metadata is missing");
  }
  if (!isBlocked && state.blocked !== null) {
    problems.push("blocked metadata present but phase is not blocked");
  }
  if (isBlocked && state.previousPhase === null) {
    problems.push("previousPhase must be set when card is blocked");
  }
  if (!isBlocked && state.previousPhase !== null) {
    problems.push("previousPhase must be null unless card is blocked");
  }

  if (!isValidUtcTimestamp(state.createdAt)) {
    problems.push("createdAt must be valid UTC ISO 8601 with Z suffix");
  }
  if (!isValidUtcTimestamp(state.updatedAt)) {
    problems.push("updatedAt must be valid UTC ISO 8601 with Z suffix");
  }

  if (!Array.isArray(state.history)) {
    problems.push("history must be an array");
  } else {
    for (let i = 0; i < state.history.length; i++) {
      const ev = state.history[i];
      if (typeof ev !== "object" || ev === null || Array.isArray(ev)) {
        problems.push(`history[${i}] must be an object`);
        continue;
      }
      const e = ev as Record<string, unknown>;
      if (typeof e.type !== "string" || typeof e.at !== "string") {
        problems.push(`history[${i}] must have string "type" and "at"`);
      } else if (!isValidUtcTimestamp(e.at)) {
        problems.push(`history[${i}].at must be valid UTC ISO 8601 with Z`);
      }
    }
  }

  const duplicates = allCardIds.filter((id) => id === state.id);
  if (duplicates.length > 1) {
    problems.push(`duplicate card ID "${state.id}" on board`);
  }

  return problems;
}

export async function validateCardOnDisk(
  repoRoot: string,
  boardName: string,
  cardId: string,
): Promise<string[]> {
  const problems: string[] = [];
  const board = await loadBoardConfig(repoRoot, boardName);
  const cardPath = `${repoRoot}/${cardDir(boardName, cardId)}`;

  try {
    const stat = await Deno.stat(cardPath);
    if (!stat.isDirectory) {
      problems.push(`card directory exists but is not a directory: ${cardId}`);
      return problems;
    }
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      problems.push(`card directory does not exist: ${cardId}`);
      return problems;
    }
    throw e;
  }

  const required: { label: string; rel: string; kind: "file" | "directory" }[] =
    [
      {
        label: "state.json",
        rel: cardStateFile(boardName, cardId),
        kind: "file",
      },
      { label: "card.md", rel: cardMdFile(boardName, cardId), kind: "file" },
      {
        label: "files",
        rel: cardFilesDir(boardName, cardId),
        kind: "directory",
      },
      { label: "logs", rel: cardLogsDir(boardName, cardId), kind: "directory" },
    ];

  for (const { label, rel, kind } of required) {
    const path = `${repoRoot}/${rel}`;
    try {
      const stat = await Deno.stat(path);
      if (kind === "file" && !stat.isFile) {
        problems.push(`${label} exists but is not a file: ${rel}`);
      }
      if (kind === "directory" && !stat.isDirectory) {
        problems.push(`${label} exists but is not a directory: ${rel}`);
      }
    } catch (e) {
      if (e instanceof Deno.errors.NotFound) {
        problems.push(`${label} does not exist: ${rel}`);
      } else {
        throw e;
      }
    }
  }

  const statePath = `${repoRoot}/${cardStateFile(boardName, cardId)}`;
  let raw: string;
  try {
    raw = await Deno.readTextFile(statePath);
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return problems;
    throw e;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    problems.push("state.json is not valid JSON");
    return problems;
  }

  let state: CardState;
  try {
    state = parseCardState(parsed, cardId);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    problems.push(message);
    return problems;
  }

  const allIds: string[] = [];
  try {
    for await (
      const entry of Deno.readDir(
        `${repoRoot}/${boardCardsDir(boardName)}`,
      )
    ) {
      if (entry.isDirectory && !entry.name.startsWith(".")) {
        allIds.push(entry.name);
      }
    }
  } catch {
    // cards dir missing handled by board validate
  }

  problems.push(...validateCardState(state, cardId, board, allIds));
  return problems;
}

export async function validateCardById(
  repoRoot: string,
  cardId: string,
): Promise<string[]> {
  const { resolveBoardForCard } = await import("./resolve-card.ts");
  const boardName = await resolveBoardForCard(repoRoot, cardId);
  return validateCardOnDisk(repoRoot, boardName, cardId);
}
