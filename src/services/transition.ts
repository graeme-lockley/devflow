import type { BoardConfig } from "../domain/board.ts";
import type { CardState } from "../domain/card.ts";
import { saveCardState } from "../domain/card.ts";
import { enumerateHops, isAtTarget } from "../domain/phases.ts";
import { appendHistory, phaseChangedEvent, utcNow } from "../domain/history.ts";
import {
  getLogLevel,
  logInfo,
  logSuccess,
  logSummaryTransition,
} from "./console.ts";
import {
  appendGitError,
  appendScriptOutput,
  createTransitionRun,
  type RunScriptRecord,
  type TransitionRunContext,
  writeCommitMessageTxt,
  writeRunJson,
} from "./transition-logs.ts";
import {
  buildScriptEnv,
  commitMessageScriptName,
  invokeScript,
  listExitScripts,
  resolveCommitMessage,
  type ScriptHopContext,
} from "./scripts.ts";
import { commit, stageAll } from "./git.ts";
import { boardScriptsDir } from "../infra/paths.ts";

export interface RunAdvanceOptions {
  repoRoot: string;
  board: BoardConfig;
  state: CardState;
  targetPhase: string;
}

export type AdvanceFailure =
  | {
    kind: "script";
    script: string;
    exitCode: number;
    logPath: string;
    from: string;
    to: string;
    targetPhase: string;
  }
  | {
    kind: "git";
    gitError: string;
    logPath: string;
    from: string;
    to: string;
    targetPhase: string;
  };

export type AdvanceResult =
  | { ok: true; state: CardState; hops: number; alreadyAtTarget?: boolean }
  | {
    ok: false;
    state: CardState;
    failure: AdvanceFailure;
  };

export interface HopFailure {
  script: string;
  exitCode: number;
  logPath: string;
  run: TransitionRunContext;
}

/** In-flight hop for interrupt handling (req §14.5). */
let inFlightHop: {
  repoRoot: string;
  board: BoardConfig;
  state: CardState;
  hop: { from: string; to: string };
  run: TransitionRunContext;
  script: string | null;
} | null = null;

export function clearInFlightHop(): void {
  inFlightHop = null;
}

/** Test hook to simulate in-flight hop during interrupt (req §14.5). */
export function setInFlightHopForTest(
  ctx: NonNullable<typeof inFlightHop>,
): void {
  inFlightHop = ctx;
}

/**
 * Finalises the in-flight run log when interrupted during a hop (req §14.5).
 * Does not modify state.json — failure detail lives under logs/ only.
 */
export async function recordInterruptFailure(
  signal: Deno.Signal,
): Promise<void> {
  const ctx = inFlightHop;
  if (!ctx) return;

  const at = utcNow();
  const script = ctx.script ?? "<interrupted>";
  const exitCode = signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : 1;

  const records: RunScriptRecord[] = [{ name: script, exitCode }];

  await writeRunJson(ctx.run, "failed", records, at).catch(() => {});
  clearInFlightHop();
}

export interface RunHopScriptsResult {
  ok: true;
  run: TransitionRunContext;
  records: RunScriptRecord[];
}
export interface RunHopScriptsFailure {
  ok: false;
  failure: HopFailure;
  state: CardState;
}

export async function runHopExitScripts(
  repoRoot: string,
  board: BoardConfig,
  state: CardState,
  hop: { from: string; to: string },
  run: TransitionRunContext,
): Promise<RunHopScriptsResult | RunHopScriptsFailure> {
  const scriptNames = await listExitScripts(repoRoot, board.name, hop.from);
  const records: RunScriptRecord[] = [];
  const scriptsDir = `${repoRoot}/${boardScriptsDir(board.name)}`;

  const hopCtx: ScriptHopContext = {
    repoRoot,
    boardName: board.name,
    cardId: state.id,
    fromPhase: hop.from,
    toPhase: hop.to,
    runDirAbs: run.runDirAbs,
  };
  const env = buildScriptEnv(hopCtx);

  inFlightHop = {
    repoRoot,
    board,
    state,
    hop,
    run,
    script: null,
  };

  try {
    const level = getLogLevel();
    const streamScriptOutput = level === "info" || level === "verbose";

    for (const name of scriptNames) {
      inFlightHop.script = name;
      const scriptPath = `${scriptsDir}/${name}`;
      if (streamScriptOutput) {
        logInfo(`running ${name}`);
      }
      const result = await invokeScript(
        scriptPath,
        board.name,
        state.id,
        env,
        repoRoot,
        { streamOutput: streamScriptOutput },
      );
      records.push({ name, exitCode: result.exitCode });
      await appendScriptOutput(run, name, result.stdout, result.stderr, {
        alreadyStreamed: streamScriptOutput,
      });

      if (result.exitCode !== 0) {
        await writeRunJson(run, "failed", records);
        return {
          ok: false,
          failure: {
            script: name,
            exitCode: result.exitCode,
            logPath: `${run.runDirRel}/output.log`,
            run,
          },
          state,
        };
      }
    }

    return { ok: true, run, records };
  } finally {
    clearInFlightHop();
  }
}

type SingleHopResult =
  | { ok: true; state: CardState }
  | { ok: false; state: CardState; failure: AdvanceFailure };

/**
 * One normal advance hop: exit scripts → commit-message → state → git (req §13.5).
 */
async function runSingleHopNormal(
  repoRoot: string,
  board: BoardConfig,
  state: CardState,
  hop: { from: string; to: string },
  targetPhase: string,
): Promise<SingleHopResult> {
  const startedAt = utcNow();
  logSummaryTransition(hop.from, hop.to);
  logInfo(`advance ${state.id}: ${hop.from} → ${hop.to}`);

  const run = await createTransitionRun(
    repoRoot,
    board.name,
    state.id,
    hop.from,
    hop.to,
    startedAt,
  );

  const exitResult = await runHopExitScripts(
    repoRoot,
    board,
    state,
    hop,
    run,
  );
  if (!exitResult.ok) {
    return {
      ok: false,
      state: exitResult.state,
      failure: {
        kind: "script",
        script: exitResult.failure.script,
        exitCode: exitResult.failure.exitCode,
        logPath: exitResult.failure.logPath,
        from: hop.from,
        to: hop.to,
        targetPhase,
      },
    };
  }

  let records = [...exitResult.records];
  const hopCtx: ScriptHopContext = {
    repoRoot,
    boardName: board.name,
    cardId: state.id,
    fromPhase: hop.from,
    toPhase: hop.to,
    runDirAbs: run.runDirAbs,
  };

  const msgScriptName = commitMessageScriptName(hop.from);
  inFlightHop = {
    repoRoot,
    board,
    state,
    hop,
    run,
    script: msgScriptName,
  };

  let commitMessage: string;
  try {
    const msgResult = await resolveCommitMessage(
      repoRoot,
      board.name,
      state.id,
      hop,
      hopCtx,
    );

    if (!msgResult.ok) {
      records = [...records, {
        name: msgResult.scriptName,
        exitCode: msgResult.exitCode,
      }];
      await writeRunJson(run, "failed", records);
      return {
        ok: false,
        state,
        failure: {
          kind: "script",
          script: msgResult.scriptName,
          exitCode: msgResult.exitCode,
          logPath: `${run.runDirRel}/output.log`,
          from: hop.from,
          to: hop.to,
          targetPhase,
        },
      };
    }

    if (msgResult.scriptName) {
      records = [...records, { name: msgResult.scriptName, exitCode: 0 }];
    }
    commitMessage = msgResult.message;
  } finally {
    clearInFlightHop();
  }

  await writeCommitMessageTxt(run, commitMessage);

  const at = utcNow();
  const nextState = appendHistory(
    {
      ...state,
      phase: hop.to,
      updatedAt: at,
    },
    phaseChangedEvent(hop.from, hop.to, at, "normal"),
  );
  await saveCardState(repoRoot, board.name, nextState);

  try {
    await stageAll(repoRoot);
    await commit(repoRoot, commitMessage);
  } catch (e) {
    const gitError = e instanceof Error ? e.message : String(e);
    await appendGitError(run, gitError);
    await writeRunJson(run, "failed", records);
    return {
      ok: false,
      state: nextState,
      failure: {
        kind: "git",
        gitError,
        logPath: `${run.runDirRel}/output.log`,
        from: hop.from,
        to: hop.to,
        targetPhase,
      },
    };
  }

  await writeRunJson(run, "succeeded", records);
  logSuccess(`advanced ${state.id} to ${hop.to}`);
  return { ok: true, state: nextState };
}

export async function runAdvance(
  options: RunAdvanceOptions,
): Promise<AdvanceResult> {
  const { repoRoot, board, targetPhase } = options;
  let state = options.state;

  if (isAtTarget(state.phase, targetPhase)) {
    return { ok: true, state, hops: 0, alreadyAtTarget: true };
  }

  const hops = enumerateHops(board, state.phase, targetPhase);
  let completed = 0;

  for (const hop of hops) {
    const result = await runSingleHopNormal(
      repoRoot,
      board,
      state,
      hop,
      targetPhase,
    );
    if (!result.ok) {
      return { ok: false, state: result.state, failure: result.failure };
    }
    state = result.state;
    completed++;
  }

  return { ok: true, state, hops: completed };
}

/** Force advance: single jump, no scripts or git (req §11.8). */
export async function runForceAdvance(
  options: RunAdvanceOptions,
): Promise<AdvanceResult> {
  const { repoRoot, board, targetPhase } = options;
  let state = options.state;

  if (isAtTarget(state.phase, targetPhase)) {
    return { ok: true, state, hops: 0, alreadyAtTarget: true };
  }

  const from = state.phase;
  const at = utcNow();
  state = appendHistory(
    {
      ...state,
      phase: targetPhase,
      updatedAt: at,
    },
    phaseChangedEvent(from, targetPhase, at, "force"),
  );
  await saveCardState(repoRoot, board.name, state);

  return { ok: true, state, hops: 1 };
}
