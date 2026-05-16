import { advanceRunDir } from "../infra/paths.ts";
import { getLogLevel } from "./console.ts";

export interface RunScriptRecord {
  name: string;
  exitCode: number;
}

export interface RunMetadata {
  card: string;
  board: string;
  from: string;
  to: string;
  startedAt: string;
  completedAt: string;
  status: "succeeded" | "failed";
  scripts: RunScriptRecord[];
}

export interface TransitionRunContext {
  repoRoot: string;
  boardName: string;
  cardId: string;
  fromPhase: string;
  toPhase: string;
  startedAt: string;
  runDirRel: string;
  runDirAbs: string;
}

export async function createTransitionRun(
  repoRoot: string,
  boardName: string,
  cardId: string,
  fromPhase: string,
  toPhase: string,
  startedAt: string = new Date().toISOString(),
): Promise<TransitionRunContext> {
  const runDirRel = advanceRunDir(
    boardName,
    cardId,
    fromPhase,
    toPhase,
    new Date(startedAt),
  );
  const runDirAbs = `${repoRoot}/${runDirRel}`;
  await Deno.mkdir(runDirAbs, { recursive: true });
  return {
    repoRoot,
    boardName,
    cardId,
    fromPhase,
    toPhase,
    startedAt,
    runDirRel,
    runDirAbs,
  };
}

export async function appendScriptOutput(
  run: TransitionRunContext,
  scriptName: string,
  stdout: string,
  stderr: string,
): Promise<void> {
  const level = getLogLevel();
  if (level === "verbose") {
    if (stdout) Deno.stderr.writeSync(new TextEncoder().encode(stdout));
    if (stderr) Deno.stderr.writeSync(new TextEncoder().encode(stderr));
  } else if (level === "info") {
    console.error(`running ${scriptName}`);
  }

  const logPath = `${run.runDirAbs}/output.log`;
  const header = `\n--- ${scriptName} ---\n`;
  const body = stdout + (stderr ? (stdout ? "" : "") + stderr : "");
  const existing = await Deno.readTextFile(logPath).catch(() => "");
  await Deno.writeTextFile(logPath, existing + header + body);
}

export async function writeRunJson(
  run: TransitionRunContext,
  status: "succeeded" | "failed",
  scripts: RunScriptRecord[],
  completedAt: string = new Date().toISOString(),
): Promise<void> {
  const metadata: RunMetadata = {
    card: run.cardId,
    board: run.boardName,
    from: run.fromPhase,
    to: run.toPhase,
    startedAt: run.startedAt,
    completedAt,
    status,
    scripts,
  };
  await Deno.writeTextFile(
    `${run.runDirAbs}/run.json`,
    JSON.stringify(metadata, null, 2) + "\n",
  );
}

export function runLogPath(run: TransitionRunContext): string {
  return `${run.runDirRel}/output.log`;
}

/** Writes captured commit message to run directory (req §15.2). */
export async function writeCommitMessageTxt(
  run: TransitionRunContext,
  message: string,
): Promise<void> {
  await Deno.writeTextFile(`${run.runDirAbs}/commit-message.txt`, message);
}

export async function appendGitError(
  run: TransitionRunContext,
  error: string,
): Promise<void> {
  const logPath = `${run.runDirAbs}/output.log`;
  const header = "\n--- git commit ---\n";
  const existing = await Deno.readTextFile(logPath).catch(() => "");
  await Deno.writeTextFile(logPath, existing + header + error + "\n");
}
