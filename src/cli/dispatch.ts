import { initBoard } from "../commands/init-board.ts";
import { resolveGitRoot } from "../infra/git-root.ts";
import { boardRoot } from "../infra/paths.ts";
import { resetLogLevel, setLogLevel } from "../services/console.ts";
import {
  parseGlobalFlags,
  resolveLogLevel,
  validateGlobalFlags,
} from "./flags.ts";
import { parseCommand } from "./parser.ts";

export const USAGE = `devflow — deterministic workflow harness for development boards

Usage:
  devflow board init <board> <phase> [<phase> ...]
  devflow init-board <board> <phase> [<phase> ...]

  <board>   Board name (^[a-z][a-z0-9_]*$)
  <phase>   Phase names in forward order (blocked is added automatically)

Global flags:
  --verbose   Verbose console output
  --summary   Summary-only console output

Run \`devflow\` with no arguments to print this help.
`;

type CommandHandler = (
  positional: string[],
  repoRoot: string,
) => Promise<number>;

const handlers = new Map<string, CommandHandler>([
  [
    "board:init",
    async (positional, repoRoot) => {
      const [boardName, ...phaseNames] = positional;
      if (!boardName) {
        console.error("devflow board init: board name required\n");
        console.log(USAGE.trimEnd());
        return 1;
      }
      try {
        await initBoard(boardName, phaseNames, repoRoot);
        console.log(
          `Initialized board "${boardName}" at ${boardRoot(boardName)}/`,
        );
        return 0;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error(`devflow board init ${boardName}: ${message}`);
        return 1;
      }
    },
  ],
]);

export async function runCli(args: string[]): Promise<number> {
  resetLogLevel();

  const flags = parseGlobalFlags(args);
  const flagError = validateGlobalFlags(flags);
  if (flagError) {
    console.error(flagError);
    return 1;
  }

  if (flags.ignoreLock) {
    console.error("devflow: --ignore-lock is not supported for this command");
    return 1;
  }

  setLogLevel(resolveLogLevel(flags));

  if (flags.remaining.length === 0) {
    console.log(USAGE.trimEnd());
    return 0;
  }

  let repoRoot: string;
  const originalCwd = Deno.cwd();
  try {
    repoRoot = await resolveGitRoot(originalCwd);
    Deno.chdir(repoRoot);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(message);
    return 1;
  }

  const parsed = parseCommand(flags.remaining);
  if (!parsed) {
    console.error(`Unknown command: ${flags.remaining.join(" ")}\n`);
    console.log(USAGE.trimEnd());
    return 1;
  }

  const key = `${parsed.object}:${parsed.verb}`;
  const handler = handlers.get(key);
  if (!handler) {
    console.error(`Unknown command: ${flags.remaining.join(" ")}\n`);
    console.log(USAGE.trimEnd());
    return 1;
  }

  try {
    return await handler(parsed.positional, repoRoot);
  } finally {
    Deno.chdir(originalCwd);
  }
}
