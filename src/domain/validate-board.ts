import type { BoardConfig } from "./board.ts";
import { parseBoardConfig } from "./board.ts";
import { validateIdentifier } from "./identifiers.ts";
import {
  boardCardsDir,
  boardConfigFile,
  boardRoot,
  boardScriptsDir,
  boardSkillsDir,
} from "../infra/paths.ts";

const MIN_SEQUENCE_WIDTH = 1;
const MAX_SEQUENCE_WIDTH = 12;

export function maxSequenceForWidth(sequenceWidth: number): number {
  return Math.pow(10, sequenceWidth) - 1;
}

export function isSequenceExhausted(
  nextSequence: number,
  sequenceWidth: number,
): boolean {
  return nextSequence > maxSequenceForWidth(sequenceWidth);
}

export function validateBoardConfig(
  config: BoardConfig,
  boardDirName: string,
): string[] {
  const problems: string[] = [];

  const boardErr = validateIdentifier(config.name, "board");
  if (boardErr) problems.push(boardErr);

  if (config.name !== boardDirName) {
    problems.push(
      `board name "${config.name}" does not match directory name "${boardDirName}"`,
    );
  }

  if (config.idPrefix !== config.name) {
    problems.push(
      `idPrefix "${config.idPrefix}" must equal board name "${config.name}"`,
    );
  }

  if (config.phases.length === 0) {
    problems.push("phases must not be empty");
  }

  const seen = new Set<string>();
  for (const phase of config.phases) {
    const err = validateIdentifier(phase, "phase");
    if (err) problems.push(err);
    if (seen.has(phase)) {
      problems.push(`duplicate phase name "${phase}"`);
    }
    seen.add(phase);
  }

  if (config.phases.includes("blocked")) {
    problems.push('phase name "blocked" is reserved');
  }

  if (config.blockedPhase !== "blocked") {
    problems.push(
      `blockedPhase must be "blocked", got "${config.blockedPhase}"`,
    );
  }

  if (
    !Number.isInteger(config.sequenceWidth) ||
    config.sequenceWidth < MIN_SEQUENCE_WIDTH ||
    config.sequenceWidth > MAX_SEQUENCE_WIDTH
  ) {
    problems.push(
      `sequenceWidth must be an integer from ${MIN_SEQUENCE_WIDTH} to ${MAX_SEQUENCE_WIDTH}`,
    );
  }

  if (!Number.isInteger(config.nextSequence) || config.nextSequence < 1) {
    problems.push("nextSequence must be a positive integer");
  } else if (
    Number.isInteger(config.sequenceWidth) &&
    isSequenceExhausted(config.nextSequence, config.sequenceWidth)
  ) {
    problems.push(
      `nextSequence ${config.nextSequence} is exhausted for sequenceWidth ${config.sequenceWidth}`,
    );
  }

  return problems;
}

function cardIdSuffixLength(cardId: string, idPrefix: string): number | null {
  const prefix = `${idPrefix}-`;
  if (!cardId.startsWith(prefix)) return null;
  const suffix = cardId.slice(prefix.length);
  if (!/^\d+$/.test(suffix)) return null;
  return suffix.length;
}

export async function validateBoardOnDisk(
  repoRoot: string,
  boardName: string,
): Promise<string[]> {
  const problems: string[] = [];
  const boardDir = `${repoRoot}/${boardRoot(boardName)}`;

  try {
    const stat = await Deno.stat(boardDir);
    if (!stat.isDirectory) {
      problems.push(
        `board directory exists but is not a directory: ${
          boardRoot(boardName)
        }`,
      );
      return problems;
    }
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      problems.push(`board directory does not exist: ${boardRoot(boardName)}`);
      return problems;
    }
    throw e;
  }

  const requiredPaths: {
    label: string;
    rel: string;
    kind: "file" | "directory";
  }[] = [
    { label: "board.json", rel: boardConfigFile(boardName), kind: "file" },
    { label: "scripts", rel: boardScriptsDir(boardName), kind: "directory" },
    { label: "skills", rel: boardSkillsDir(boardName), kind: "directory" },
    { label: "cards", rel: boardCardsDir(boardName), kind: "directory" },
  ];

  for (const { label, rel, kind } of requiredPaths) {
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

  const configPath = `${repoRoot}/${boardConfigFile(boardName)}`;
  let raw: string;
  try {
    raw = await Deno.readTextFile(configPath);
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      problems.push(`board.json does not exist: ${boardConfigFile(boardName)}`);
      return problems;
    }
    throw e;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    problems.push("board.json is not valid JSON");
    return problems;
  }

  let config: BoardConfig;
  try {
    config = parseBoardConfig(parsed, boardName);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    problems.push(message);
    return problems;
  }

  problems.push(...validateBoardConfig(config, boardName));

  const cardsPath = `${repoRoot}/${boardCardsDir(boardName)}`;
  try {
    for await (const entry of Deno.readDir(cardsPath)) {
      if (!entry.isDirectory) continue;
      const suffixLen = cardIdSuffixLength(entry.name, config.idPrefix);
      if (suffixLen === null) {
        problems.push(
          `card directory "${entry.name}" does not match board idPrefix "${config.idPrefix}"`,
        );
        continue;
      }
      if (suffixLen !== config.sequenceWidth) {
        problems.push(
          `card ID "${entry.name}" suffix length ${suffixLen} does not match sequenceWidth ${config.sequenceWidth}`,
        );
      }
    }
  } catch (e) {
    if (!(e instanceof Deno.errors.NotFound)) throw e;
  }

  return problems;
}
