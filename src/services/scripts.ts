import {
  isCommitMessageScript,
  matchesExitScript,
  sortExitScriptNames,
} from "../domain/script-names.ts";
import { defaultCommitMessage } from "./git.ts";
import {
  boardRoot,
  boardScriptsDir,
  cardDir,
  devflowRoot,
} from "../infra/paths.ts";
import { getLogLevel } from "./console.ts";
import { setActiveChild } from "./signals.ts";

export interface ScriptHopContext {
  repoRoot: string;
  boardName: string;
  cardId: string;
  fromPhase: string;
  toPhase: string;
  runDirAbs: string;
}

export interface ScriptInvokeResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export function buildScriptEnv(ctx: ScriptHopContext): Record<string, string> {
  const repoRoot = ctx.repoRoot;
  const devflowAbs = `${repoRoot}/${devflowRoot()}`;
  const boardDirAbs = `${repoRoot}/${boardRoot(ctx.boardName)}`;
  const cardDirAbs = `${repoRoot}/${cardDir(ctx.boardName, ctx.cardId)}`;

  return {
    DEVFLOW_ROOT: devflowAbs,
    DEVFLOW_BOARD: ctx.boardName,
    DEVFLOW_BOARD_DIR: boardDirAbs,
    DEVFLOW_CARD_ID: ctx.cardId,
    DEVFLOW_CARD_DIR: cardDirAbs,
    DEVFLOW_FROM_PHASE: ctx.fromPhase,
    DEVFLOW_TO_PHASE: ctx.toPhase,
    DEVFLOW_CURRENT_PHASE: ctx.fromPhase,
    DEVFLOW_NEXT_PHASE: ctx.toPhase,
    DEVFLOW_RUN_DIR: ctx.runDirAbs,
    DEVFLOW_REPO_ROOT: repoRoot,
    DEVFLOW_LOG_LEVEL: getLogLevel(),
  };
}

export async function isExecutable(path: string): Promise<boolean> {
  try {
    const stat = await Deno.stat(path);
    if (!stat.isFile) return false;
    return (stat.mode ?? 0) & 0o111 ? true : false;
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return false;
    throw e;
  }
}

/**
 * Lists executable exit scripts for a phase in lexical order (req §9.3).
 */
export async function listExitScripts(
  repoRoot: string,
  boardName: string,
  phase: string,
): Promise<string[]> {
  const scriptsDir = `${repoRoot}/${boardScriptsDir(boardName)}`;
  const names: string[] = [];

  try {
    for await (const entry of Deno.readDir(scriptsDir)) {
      if (!entry.isFile) continue;
      if (!matchesExitScript(entry.name, phase)) continue;
      const path = `${scriptsDir}/${entry.name}`;
      if (await isExecutable(path)) {
        names.push(entry.name);
      }
    }
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return [];
    throw e;
  }

  return sortExitScriptNames(names);
}

export function commitMessageScriptName(phase: string): string {
  return `${phase}.commit-message`;
}

/**
 * Resolves executable <phase>.commit-message script path, or null (req §13.4).
 */
export async function resolveCommitMessageScript(
  repoRoot: string,
  boardName: string,
  phase: string,
): Promise<string | null> {
  const name = commitMessageScriptName(phase);
  if (!isCommitMessageScript(name, phase)) return null;

  const path = `${repoRoot}/${boardScriptsDir(boardName)}/${name}`;
  if (await isExecutable(path)) return path;
  return null;
}

export function fallbackCommitMessage(
  cardId: string,
  fromPhase: string,
  toPhase: string,
): string {
  return defaultCommitMessage(cardId, fromPhase, toPhase);
}

export type CommitMessageResult =
  | { ok: true; message: string; scriptName: string | null }
  | { ok: false; scriptName: string; exitCode: number };

/**
 * Runs commit-message script or fallback (req §13.4). Stdout is not streamed.
 */
export async function resolveCommitMessage(
  repoRoot: string,
  boardName: string,
  cardId: string,
  hop: { from: string; to: string },
  hopCtx: ScriptHopContext,
): Promise<CommitMessageResult> {
  const scriptPath = await resolveCommitMessageScript(
    repoRoot,
    boardName,
    hop.from,
  );

  if (!scriptPath) {
    return {
      ok: true,
      message: fallbackCommitMessage(cardId, hop.from, hop.to),
      scriptName: null,
    };
  }

  const name = commitMessageScriptName(hop.from);
  const env = buildScriptEnv(hopCtx);
  const result = await invokeScript(
    scriptPath,
    boardName,
    cardId,
    env,
    repoRoot,
  );

  if (result.exitCode !== 0) {
    return { ok: false, scriptName: name, exitCode: result.exitCode };
  }

  const message = result.stdout.trim();
  if (!message) {
    return { ok: false, scriptName: name, exitCode: 0 };
  }

  return { ok: true, message, scriptName: name };
}

/**
 * Invokes a script directly (shebang honoured). req §9.9, ADR-0007.
 */
export async function invokeScript(
  scriptPath: string,
  boardName: string,
  cardId: string,
  env: Record<string, string>,
  repoRoot: string,
): Promise<ScriptInvokeResult> {
  if (!(await isExecutable(scriptPath))) {
    throw new Error(`script is not executable: ${scriptPath}`);
  }

  const cmd = new Deno.Command(scriptPath, {
    args: [boardName, cardId],
    cwd: repoRoot,
    env: { ...Deno.env.toObject(), ...env },
    stdout: "piped",
    stderr: "piped",
  });

  const child = cmd.spawn();
  setActiveChild(child);
  try {
    const [status, stdout, stderr] = await Promise.all([
      child.status,
      readStream(child.stdout),
      readStream(child.stderr),
    ]);

    const exitCode = status.code ?? (status.success ? 0 : 1);
    return { exitCode, stdout, stderr };
  } finally {
    setActiveChild(null);
  }
}

async function readStream(
  stream: ReadableStream<Uint8Array>,
): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const len = chunks.reduce((n, c) => n + c.length, 0);
  const buf = new Uint8Array(len);
  let off = 0;
  for (const c of chunks) {
    buf.set(c, off);
    off += c.length;
  }
  return new TextDecoder().decode(buf);
}
