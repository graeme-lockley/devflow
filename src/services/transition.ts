import type { BoardConfig } from "../domain/board.ts";
import type { CardState } from "../domain/card.ts";
import { saveCardState } from "../domain/card.ts";
import { enumerateHops, isAtTarget } from "../domain/phases.ts";
import {
  actionSkippedEvent,
  appendHistory,
  phaseChangedEvent,
  utcNow,
} from "../domain/history.ts";
import {
  getLogLevel,
  logInfo,
  logSkipped,
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
  invokeChildScript,
  invokeScript,
  listExitScripts,
  resolveCommitMessage,
  type ScriptHopContext,
} from "./scripts.ts";
import { commit, stageAll } from "./git.ts";
import { boardScriptsDir } from "../infra/paths.ts";
import { partitionLoopRootScripts } from "../domain/script-names.ts";

export interface RunAdvanceOptions {
  repoRoot: string;
  board: BoardConfig;
  state: CardState;
  targetPhase: string;
  skip?: string[];
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

interface LoopBlockResult {
  ok: true;
  records: RunScriptRecord[];
}

interface LoopBlockFailure {
  ok: false;
  failure: HopFailure;
}

/**
 * Runs a loop block: iterate steps up to maxRounds, restart on failure (req §9.11).
 */
async function runLoopBlock(
  repoRoot: string,
  board: BoardConfig,
  state: CardState,
  _hop: { from: string; to: string },
  run: TransitionRunContext,
  loopSteps: string[],
  maxRounds: number,
  env: Record<string, string>,
): Promise<LoopBlockResult | LoopBlockFailure> {
  const scriptsDir = `${repoRoot}/${boardScriptsDir(board.name)}`;
  const records: RunScriptRecord[] = [];
  const streamScriptOutput = getLogLevel() === "info" ||
    getLogLevel() === "verbose";

  for (let round = 1; round <= maxRounds; round++) {
    if (streamScriptOutput) {
      logInfo(`round ${round}/${maxRounds}: starting`);
    }

    let allStepsSucceeded = true;
    for (const stepPath of loopSteps) {
      const scriptPath = `${scriptsDir}/${stepPath}`;
      if (streamScriptOutput) {
        logInfo(`round ${round}/${maxRounds}: step ${stepPath}`);
      }

      const result = await invokeChildScript(
        scriptPath,
        board.name,
        state.id,
        env,
        repoRoot,
        {
          streamOutput: streamScriptOutput,
          parentScript: "loop-orchestrator",
          round,
          maxRounds,
        },
      );

      records.push({
        name: `loop[${round}]:${stepPath}`,
        exitCode: result.exitCode,
      });
      await appendScriptOutput(
        run,
        `loop[${round}]:${stepPath}`,
        result.stdout,
        result.stderr,
        {
          alreadyStreamed: streamScriptOutput,
        },
      );

      if (result.exitCode !== 0) {
        allStepsSucceeded = false;
        if (round >= maxRounds) {
          // Exhausted max rounds
          await writeRunJson(run, "failed", records);
          return {
            ok: false,
            failure: {
              script:
                `loop exhausted at round ${round}/${maxRounds}, step ${stepPath}`,
              exitCode: result.exitCode,
              logPath: `${run.runDirRel}/output.log`,
              run,
            },
          };
        }
        // Restart loop from first step
        if (streamScriptOutput) {
          logInfo(
            `round ${round}/${maxRounds}: step ${stepPath} failed (exit ${result.exitCode}), restarting loop`,
          );
        }
        break; // Exit step loop to restart round
      }
    }

    if (allStepsSucceeded) {
      if (streamScriptOutput) {
        logInfo(`loop completed successfully after ${round} round(s)`);
      }
      return { ok: true, records };
    }
  }

  // Should not reach here
  await writeRunJson(run, "failed", records);
  return {
    ok: false,
    failure: {
      script: "loop",
      exitCode: 1,
      logPath: `${run.runDirRel}/output.log`,
      run,
    },
  };
}

export async function runHopExitScripts(
  repoRoot: string,
  board: BoardConfig,
  state: CardState,
  hop: { from: string; to: string },
  run: TransitionRunContext,
  skip: string[] = [],
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

  // Compute which scripts to skip for this hop (req stories-000005)
  const skipForThisHop = new Set<string>();
  for (const skipToken of skip) {
    // Only apply skip tokens that match this hop's phase
    if (skipToken.startsWith(`${hop.from}-`)) {
      // Find all script names that start with this prefix
      for (const scriptName of scriptNames) {
        if (scriptName.startsWith(skipToken)) {
          skipForThisHop.add(scriptName);
        }
      }
    }
  }

  // Validate that skipped scripts are not in loop band or commit-message (req stories-000005)
  const loopConfig = board.phaseScripts?.[hop.from]?.loop;
  const commitMsgScript = commitMessageScriptName(hop.from);
  for (const skippedScript of skipForThisHop) {
    // Check if it's the commit-message script
    if (skippedScript === commitMsgScript) {
      await writeRunJson(run, "failed", records);
      return {
        ok: false,
        failure: {
          script: `cannot skip commit-message script ${commitMsgScript}`,
          exitCode: 1,
          logPath: `${run.runDirRel}/output.log`,
          run,
        },
        state,
      };
    }

    // Check if it's in the loop band
    if (loopConfig) {
      const { entry, exit } = partitionLoopRootScripts(scriptNames, hop.from);
      const isLoopStep = !entry.includes(skippedScript) &&
        !exit.includes(skippedScript);
      if (isLoopStep) {
        await writeRunJson(run, "failed", records);
        return {
          ok: false,
          failure: {
            script: `cannot skip loop step ${skippedScript}`,
            exitCode: 1,
            logPath: `${run.runDirRel}/output.log`,
            run,
          },
          state,
        };
      }
    }
  }

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

    // Check for loop configuration (req §9.11, ADR-0014)
    const loopConfig = board.phaseScripts?.[hop.from]?.loop;

    if (!loopConfig) {
      // No loop: run all scripts in lexical order (backward compatible)
      for (const name of scriptNames) {
        // Check if this script should be skipped (req stories-000005)
        if (skipForThisHop.has(name)) {
          logSkipped(name, "--skip");
          records.push({ name, exitCode: 0, skipped: true });
          continue;
        }

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
    } else {
      // Loop configuration present: entry → loop → exit (req §9.11.3)
      const { entry: entryScripts, exit: exitScripts } =
        partitionLoopRootScripts(scriptNames, hop.from);

      // Run entry scripts
      for (const name of entryScripts) {
        // Check if this script should be skipped (req stories-000005)
        if (skipForThisHop.has(name)) {
          logSkipped(name, "--skip");
          records.push({ name, exitCode: 0, skipped: true });
          continue;
        }

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

      // Run loop block
      const loopResult = await runLoopBlock(
        repoRoot,
        board,
        state,
        hop,
        run,
        loopConfig.steps,
        loopConfig.maxRounds,
        env,
      );

      if (!loopResult.ok) {
        return {
          ok: false,
          failure: loopResult.failure,
          state,
        };
      }

      records.push(...loopResult.records);

      // Run exit scripts
      for (const name of exitScripts) {
        // Check if this script should be skipped (req stories-000005)
        if (skipForThisHop.has(name)) {
          logSkipped(name, "--skip");
          records.push({ name, exitCode: 0, skipped: true });
          continue;
        }

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
  skip: string[] = [],
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
    skip,
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
  let nextState = {
    ...state,
    phase: hop.to,
    updatedAt: at,
  };

  // Append actionSkipped events for each skipped script (req stories-000005)
  for (const record of records) {
    if (record.skipped) {
      nextState = appendHistory(
        nextState,
        actionSkippedEvent(hop.from, hop.to, record.name, at),
      );
    }
  }

  // Append phaseChanged event
  nextState = appendHistory(
    nextState,
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
  const { repoRoot, board, targetPhase, skip = [] } = options;
  let state = options.state;

  if (isAtTarget(state.phase, targetPhase)) {
    return { ok: true, state, hops: 0, alreadyAtTarget: true };
  }

  const hops = enumerateHops(board, state.phase, targetPhase);

  // Pre-validate skip tokens: collect all scripts across all hops (req stories-000005)
  if (skip.length > 0) {
    const allScriptsByPhase = new Map<string, string[]>();
    for (const hop of hops) {
      const scripts = await listExitScripts(repoRoot, board.name, hop.from);
      allScriptsByPhase.set(hop.from, scripts);
    }

    // Check each skip token matches at least one script in the relevant hop
    for (const skipToken of skip) {
      const phasePrefix = skipToken.split("-")[0];
      let matched = false;

      // Find the hop(s) where this skip token's phase matches
      for (const hop of hops) {
        if (hop.from === phasePrefix) {
          const scripts = allScriptsByPhase.get(hop.from) || [];
          for (const script of scripts) {
            if (script.startsWith(skipToken)) {
              matched = true;
              break;
            }
          }
        }
      }

      if (!matched) {
        throw new Error(
          `--skip token "${skipToken}" does not match any script in this advance`,
        );
      }
    }
  }

  let completed = 0;

  for (const hop of hops) {
    const result = await runSingleHopNormal(
      repoRoot,
      board,
      state,
      hop,
      targetPhase,
      skip,
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
