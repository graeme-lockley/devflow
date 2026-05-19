import { writeTextFileAtomic } from "../infra/atomic-write.ts";
import { boardConfigFile, boardsRoot } from "../infra/paths.ts";

export interface LoopConfig {
  steps: string[];
  maxRounds: number;
}

export interface PhaseScriptConfig {
  loop?: LoopConfig;
}

export interface BoardConfig {
  name: string;
  idPrefix: string;
  nextSequence: number;
  sequenceWidth: number;
  phases: string[];
  blockedPhase: string;
  createdAt: string;
  updatedAt: string;
  phaseScripts?: Record<string, PhaseScriptConfig>;
  maxScriptExecutionsPerHop?: number;
}

export interface CreateBoardConfigOptions {
  sequenceWidth?: number;
  now?: Date;
}

export function createBoardConfig(
  boardName: string,
  phaseNames: string[],
  options: CreateBoardConfigOptions = {},
): BoardConfig {
  const now = options.now ?? new Date();
  const iso = now.toISOString();
  return {
    name: boardName,
    idPrefix: boardName,
    nextSequence: 1,
    sequenceWidth: options.sequenceWidth ?? 6,
    phases: phaseNames,
    blockedPhase: "blocked",
    createdAt: iso,
    updatedAt: iso,
  };
}

export function boardConfigPath(repoRoot: string, boardName: string): string {
  return `${repoRoot}/${boardConfigFile(boardName)}`;
}

export function serializeBoardConfig(config: BoardConfig): string {
  return JSON.stringify(config, null, 2) + "\n";
}

export async function loadBoardConfig(
  repoRoot: string,
  boardName: string,
): Promise<BoardConfig> {
  const path = boardConfigPath(repoRoot, boardName);
  let raw: string;
  try {
    raw = await Deno.readTextFile(path);
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      throw new Error(
        `board "${boardName}" not found at ${boardConfigFile(boardName)}`,
      );
    }
    throw e;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`board "${boardName}": board.json is not valid JSON`);
  }

  return parseBoardConfig(parsed, boardName);
}

export function parseBoardConfig(raw: unknown, boardName: string): BoardConfig {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(`board "${boardName}": board.json must be a JSON object`);
  }

  const o = raw as Record<string, unknown>;
  const required = [
    "name",
    "idPrefix",
    "nextSequence",
    "sequenceWidth",
    "phases",
    "blockedPhase",
    "createdAt",
    "updatedAt",
  ] as const;

  for (const key of required) {
    if (!(key in o)) {
      throw new Error(
        `board "${boardName}": board.json missing required field "${key}"`,
      );
    }
  }

  if (typeof o.name !== "string") {
    throw new Error(`board "${boardName}": "name" must be a string`);
  }
  if (typeof o.idPrefix !== "string") {
    throw new Error(`board "${boardName}": "idPrefix" must be a string`);
  }
  if (typeof o.nextSequence !== "number" || !Number.isInteger(o.nextSequence)) {
    throw new Error(`board "${boardName}": "nextSequence" must be an integer`);
  }
  if (
    typeof o.sequenceWidth !== "number" || !Number.isInteger(o.sequenceWidth)
  ) {
    throw new Error(`board "${boardName}": "sequenceWidth" must be an integer`);
  }
  if (
    !Array.isArray(o.phases) || !o.phases.every((p) => typeof p === "string")
  ) {
    throw new Error(
      `board "${boardName}": "phases" must be an array of strings`,
    );
  }
  if (typeof o.blockedPhase !== "string") {
    throw new Error(`board "${boardName}": "blockedPhase" must be a string`);
  }
  if (typeof o.createdAt !== "string") {
    throw new Error(`board "${boardName}": "createdAt" must be a string`);
  }
  if (typeof o.updatedAt !== "string") {
    throw new Error(`board "${boardName}": "updatedAt" must be a string`);
  }

  let maxScriptExecutionsPerHop: number | undefined;
  if ("maxScriptExecutionsPerHop" in o) {
    if (
      typeof o.maxScriptExecutionsPerHop !== "number" ||
      !Number.isInteger(o.maxScriptExecutionsPerHop) ||
      o.maxScriptExecutionsPerHop < 1
    ) {
      throw new Error(
        `board "${boardName}": "maxScriptExecutionsPerHop" must be an integer >= 1`,
      );
    }
    maxScriptExecutionsPerHop = o.maxScriptExecutionsPerHop;
  }

  let phaseScripts: Record<string, PhaseScriptConfig> | undefined;
  if ("phaseScripts" in o) {
    if (
      typeof o.phaseScripts !== "object" || o.phaseScripts === null ||
      Array.isArray(o.phaseScripts)
    ) {
      throw new Error(
        `board "${boardName}": "phaseScripts" must be a JSON object`,
      );
    }
    phaseScripts = {};
    const psObj = o.phaseScripts as Record<string, unknown>;
    for (const [phase, config] of Object.entries(psObj)) {
      if (
        typeof config !== "object" || config === null || Array.isArray(config)
      ) {
        throw new Error(
          `board "${boardName}": phaseScripts["${phase}"] must be an object`,
        );
      }
      const configObj = config as Record<string, unknown>;
      const phaseConfig: PhaseScriptConfig = {};

      if ("loop" in configObj) {
        if (
          typeof configObj.loop !== "object" || configObj.loop === null ||
          Array.isArray(configObj.loop)
        ) {
          throw new Error(
            `board "${boardName}": phaseScripts["${phase}"].loop must be an object`,
          );
        }
        const loopObj = configObj.loop as Record<string, unknown>;
        if (!("steps" in loopObj) || !("maxRounds" in loopObj)) {
          throw new Error(
            `board "${boardName}": phaseScripts["${phase}"].loop must have "steps" and "maxRounds"`,
          );
        }
        if (
          !Array.isArray(loopObj.steps) ||
          !loopObj.steps.every((s) => typeof s === "string")
        ) {
          throw new Error(
            `board "${boardName}": phaseScripts["${phase}"].loop.steps must be an array of strings`,
          );
        }
        if (
          typeof loopObj.maxRounds !== "number" ||
          !Number.isInteger(loopObj.maxRounds) || loopObj.maxRounds < 1
        ) {
          throw new Error(
            `board "${boardName}": phaseScripts["${phase}"].loop.maxRounds must be an integer >= 1`,
          );
        }
        phaseConfig.loop = {
          steps: loopObj.steps as string[],
          maxRounds: loopObj.maxRounds,
        };
      }

      phaseScripts[phase] = phaseConfig;
    }
  }

  return {
    name: o.name,
    idPrefix: o.idPrefix,
    nextSequence: o.nextSequence,
    sequenceWidth: o.sequenceWidth,
    phases: o.phases as string[],
    blockedPhase: o.blockedPhase,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    ...(phaseScripts ? { phaseScripts } : {}),
    ...(maxScriptExecutionsPerHop !== undefined
      ? { maxScriptExecutionsPerHop }
      : {}),
  };
}

export async function saveBoardConfig(
  repoRoot: string,
  config: BoardConfig,
): Promise<void> {
  const path = boardConfigPath(repoRoot, config.name);
  await writeTextFileAtomic(path, serializeBoardConfig(config));
}

export async function listBoardNames(repoRoot: string): Promise<string[]> {
  const boardsPath = `${repoRoot}/${boardsRoot()}`;
  const names: string[] = [];

  try {
    for await (const entry of Deno.readDir(boardsPath)) {
      if (!entry.isDirectory) continue;
      const configPath = `${boardsPath}/${entry.name}/board.json`;
      try {
        const stat = await Deno.stat(configPath);
        if (stat.isFile) names.push(entry.name);
      } catch (e) {
        if (e instanceof Deno.errors.NotFound) continue;
        throw e;
      }
    }
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return [];
    throw e;
  }

  names.sort();
  return names;
}
