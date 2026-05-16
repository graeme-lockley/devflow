import type { BoardConfig } from "../domain/board.ts";
import type { CardState } from "../domain/card.ts";
import { saveCardState } from "../domain/card.ts";
import { enumerateHops, isAtTarget } from "../domain/phases.ts";
import {
  appendHistory,
  phaseChangedEvent,
  transitionFailedEvent,
  utcNow,
} from "../domain/history.ts";
import {
  appendScriptOutput,
  createTransitionRun,
  type RunScriptRecord,
  type TransitionRunContext,
  writeRunJson,
} from "./transition-logs.ts";
import {
  buildScriptEnv,
  invokeScript,
  listExitScripts,
  type ScriptHopContext,
} from "./scripts.ts";
import { boardScriptsDir } from "../infra/paths.ts";

export interface RunAdvanceOptions {
  repoRoot: string;
  board: BoardConfig;
  state: CardState;
  targetPhase: string;
}

export type AdvanceResult =
  | { ok: true; state: CardState; hops: number; alreadyAtTarget?: boolean }
  | {
    ok: false;
    state: CardState;
    failure: {
      script: string;
      exitCode: number;
      logPath: string;
      from: string;
      to: string;
      targetPhase: string;
    };
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
 * Records transitionFailed when interrupted during a hop (req §14.5).
 */
export async function recordInterruptFailure(
  signal: Deno.Signal,
): Promise<void> {
  const ctx = inFlightHop;
  if (!ctx) return;

  const at = utcNow();
  const script = ctx.script ?? "<interrupted>";
  const exitCode = signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : 1;

  const records: RunScriptRecord[] = ctx.script
    ? [{ name: ctx.script, exitCode }]
    : [];

  await writeRunJson(ctx.run, "failed", records, at).catch(() => {});

  const next = appendHistory(
    ctx.state,
    transitionFailedEvent(
      ctx.hop.from,
      ctx.hop.to,
      script,
      exitCode,
      at,
    ),
  );
  await saveCardState(ctx.repoRoot, ctx.board.name, next).catch(() => {});
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

export async function runHopScripts(
  repoRoot: string,
  board: BoardConfig,
  state: CardState,
  hop: { from: string; to: string },
): Promise<RunHopScriptsResult | RunHopScriptsFailure> {
  const startedAt = utcNow();
  const run = await createTransitionRun(
    repoRoot,
    board.name,
    state.id,
    hop.from,
    hop.to,
    startedAt,
  );

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
    for (const name of scriptNames) {
      inFlightHop.script = name;
      const scriptPath = `${scriptsDir}/${name}`;
      const result = await invokeScript(
        scriptPath,
        board.name,
        state.id,
        env,
        repoRoot,
      );
      records.push({ name, exitCode: result.exitCode });
      await appendScriptOutput(run, name, result.stdout, result.stderr);

      if (result.exitCode !== 0) {
        await writeRunJson(run, "failed", records);
        const at = utcNow();
        const failedState = appendHistory(
          state,
          transitionFailedEvent(
            hop.from,
            hop.to,
            name,
            result.exitCode,
            at,
          ),
        );
        await saveCardState(repoRoot, board.name, failedState);
        return {
          ok: false,
          failure: {
            script: name,
            exitCode: result.exitCode,
            logPath: `${run.runDirRel}/output.log`,
            run,
          },
          state: failedState,
        };
      }
    }

    await writeRunJson(run, "succeeded", records);
    return { ok: true, run, records };
  } finally {
    clearInFlightHop();
  }
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
    const result = await runHopScripts(repoRoot, board, state, hop);
    if (!result.ok) {
      return {
        ok: false,
        state: result.state,
        failure: {
          script: result.failure.script,
          exitCode: result.failure.exitCode,
          logPath: result.failure.logPath,
          from: hop.from,
          to: hop.to,
          targetPhase,
        },
      };
    }

    const at = utcNow();
    state = appendHistory(
      {
        ...state,
        phase: hop.to,
        updatedAt: at,
      },
      phaseChangedEvent(hop.from, hop.to, at, "normal"),
    );
    await saveCardState(repoRoot, board.name, state);
    completed++;
  }

  return { ok: true, state, hops: completed };
}
