import { addCardFile } from "../commands/add-card-file.ts";
import { blockCard } from "../commands/block-card.ts";
import { cardDirPath } from "../commands/card-dir.ts";
import { createCard } from "../commands/create-card.ts";
import { getVariable } from "../commands/get-variable.ts";
import { initBoardFromArgs } from "../commands/init-board.ts";
import { formatBoardList, listBoards } from "../commands/list-boards.ts";
import { formatCardList, listCards } from "../commands/list-cards.ts";
import { renameCard } from "../commands/rename-card.ts";
import { unblockCard } from "../commands/unblock-card.ts";
import { advanceCard } from "../commands/card-advance.ts";
import { setVariable } from "../commands/set-variable.ts";
import { showBoard } from "../commands/show-board.ts";
import { showCard } from "../commands/show-card.ts";
import { validateBoardCommand } from "../commands/validate-board-cmd.ts";
import { validateCardCommand } from "../commands/validate-card-cmd.ts";
import { validateCommand } from "../commands/validate-cmd.ts";
import { releaseBoardLockCommand } from "../commands/release-board-lock.ts";
import { releaseCardLockCommand } from "../commands/release-card-lock.ts";
import { releaseRepoLockCommand } from "../commands/release-repo-lock.ts";
import { resolveGitRoot } from "../infra/git-root.ts";
import { boardRoot } from "../infra/paths.ts";
import {
  logCliMessage,
  logError,
  logTransitionFailure,
  resetLogLevel,
  setLogLevel,
} from "../services/console.ts";
import { parseAddCardFileArgs } from "./add-file-flags.ts";
import { parseCardListArgs } from "./card-list-flags.ts";
import { parseAdvanceArgs } from "./advance-flags.ts";
import { parseLockForceArgs } from "./lock-force-flags.ts";
import {
  parseGlobalFlags,
  resolveLogLevel,
  validateGlobalFlags,
} from "./flags.ts";
import { parseCommand } from "./parser.ts";

export const USAGE =
  `devflow — deterministic workflow harness for development boards

Usage:
  devflow board init <board> <phase> [<phase> ...] [--sequence-width N] [--template NAME]
  devflow init-board <board> <phase> [<phase> ...] [--sequence-width N] [--template NAME]

  devflow board list
  devflow list-boards

  devflow board show <board>
  devflow show-board <board>

  devflow board validate <board>
  devflow validate-board <board>

  devflow validate

  devflow card create <board> "<title>"
  devflow create-card <board> "<title>"

  devflow card list <board> [--phase <name>]
  devflow list-cards <board> [--phase <name>]

  devflow card show <card-id>
  devflow show-card <card-id>

  devflow card dir <card-id>
  devflow card-dir <card-id>

  devflow card rename <card-id> "<title>"
  devflow rename-card <card-id> "<title>"

  devflow card add-file <card-id> <source> [--overwrite] [--ignore-lock]
  devflow add-card-file <card-id> <source> [--overwrite] [--ignore-lock]

  devflow card validate <card-id>
  devflow validate-card <card-id>

  devflow card block <card-id> "<reason>"
  devflow block-card <card-id> "<reason>"

  devflow card unblock <card-id>
  devflow unblock-card <card-id>

  devflow card advance <card-id> <phase> [--force]
  devflow advance-card <card-id> <phase> [--force]

  devflow variable get <card-id> <NAME>
  devflow get-variable <card-id> <NAME>

  devflow variable set <card-id> <NAME> <value> [--ignore-lock]
  devflow set-variable <card-id> <NAME> <value> [--ignore-lock]

  devflow lock release <card-id> [--force]
  devflow release-lock <card-id> [--force]

  devflow lock release-board <board> [--force]
  devflow release-board-lock <board> [--force]

  devflow lock release-repo [--force]
  devflow release-repo-lock [--force]

  <board>   Board name (^[a-z][a-z0-9_]*$)
  <card-id> Card ID (e.g. stories-000001)
  <phase>   Phase names in forward order (blocked is added automatically)

Global flags:
  --verbose       Verbose console output
  --summary       Summary-only console output
  --ignore-lock   Skip card lock (variable set and card add-file only)

Run \`devflow\` with no arguments to print this help.
`;

export interface CommandContext {
  ignoreLock: boolean;
}

type CommandHandler = (
  positional: string[],
  repoRoot: string,
  ctx: CommandContext,
) => Promise<number>;

const IGNORE_LOCK_COMMANDS = new Set(["variable:set", "card:add-file"]);

const handlers = new Map<string, CommandHandler>([
  [
    "repo:validate",
    async (_positional, repoRoot, _ctx) => {
      try {
        return await validateCommand(repoRoot);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        logError(`devflow validate: ${message}`);
        return 1;
      }
    },
  ],
  [
    "board:init",
    async (positional, repoRoot, _ctx) => {
      const [boardName, ...rest] = positional;
      if (!boardName) {
        console.error("devflow board init: board name required\n");
        console.log(USAGE.trimEnd());
        return 1;
      }
      try {
        await initBoardFromArgs(boardName, rest, repoRoot);
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
  [
    "board:list",
    async (_positional, repoRoot, _ctx) => {
      const names = await listBoards(repoRoot);
      const out = formatBoardList(names);
      if (out) Deno.stdout.writeSync(new TextEncoder().encode(out));
      return 0;
    },
  ],
  [
    "board:show",
    async (positional, repoRoot, _ctx) => {
      const [boardName] = positional;
      if (!boardName) {
        console.error("devflow board show: board name required\n");
        console.log(USAGE.trimEnd());
        return 1;
      }
      try {
        const out = await showBoard(boardName, repoRoot);
        Deno.stdout.writeSync(new TextEncoder().encode(out));
        return 0;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error(`devflow board show ${boardName}: ${message}`);
        return 1;
      }
    },
  ],
  [
    "card:create",
    async (positional, repoRoot, _ctx) => {
      const [boardName, title] = positional;
      if (!boardName || title === undefined) {
        console.error("devflow card create: board name and title required\n");
        console.log(USAGE.trimEnd());
        return 1;
      }
      try {
        const cardId = await createCard(boardName, title, repoRoot);
        Deno.stdout.writeSync(new TextEncoder().encode(`${cardId}\n`));
        return 0;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error(`devflow card create ${boardName}: ${message}`);
        return 1;
      }
    },
  ],
  [
    "card:list",
    async (positional, repoRoot, _ctx) => {
      try {
        const { boardName, phase } = parseCardListArgs(positional);
        const ids = await listCards(boardName, repoRoot, phase);
        const out = formatCardList(ids);
        if (out) Deno.stdout.writeSync(new TextEncoder().encode(out));
        return 0;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error(message);
        return 1;
      }
    },
  ],
  [
    "card:show",
    async (positional, repoRoot, _ctx) => {
      const [cardId] = positional;
      if (!cardId) {
        console.error("devflow card show: card id required\n");
        console.log(USAGE.trimEnd());
        return 1;
      }
      try {
        const out = await showCard(cardId, repoRoot);
        Deno.stdout.writeSync(new TextEncoder().encode(out));
        return 0;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error(`devflow card show ${cardId}: ${message}`);
        return 1;
      }
    },
  ],
  [
    "card:dir",
    async (positional, repoRoot, _ctx) => {
      const [cardId] = positional;
      if (!cardId) {
        console.error("devflow card dir: card id required\n");
        console.log(USAGE.trimEnd());
        return 1;
      }
      try {
        const path = await cardDirPath(cardId, repoRoot);
        Deno.stdout.writeSync(new TextEncoder().encode(`${path}\n`));
        return 0;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error(`devflow card dir ${cardId}: ${message}`);
        return 1;
      }
    },
  ],
  [
    "card:rename",
    async (positional, repoRoot, _ctx) => {
      const [cardId, title] = positional;
      if (!cardId || title === undefined) {
        console.error("devflow card rename: card id and title required\n");
        console.log(USAGE.trimEnd());
        return 1;
      }
      try {
        await renameCard(cardId, title, repoRoot);
        return 0;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error(`devflow card rename ${cardId}: ${message}`);
        return 1;
      }
    },
  ],
  [
    "card:add-file",
    async (positional, repoRoot, _ctx) => {
      try {
        const { cardId, sourcePath, overwrite } = parseAddCardFileArgs(
          positional,
        );
        await addCardFile(cardId, sourcePath, repoRoot, {
          overwrite,
          ignoreLock: _ctx.ignoreLock,
        });
        return 0;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error(message);
        return 1;
      }
    },
  ],
  [
    "card:block",
    async (positional, repoRoot, _ctx) => {
      const [cardId, reason] = positional;
      if (!cardId || reason === undefined) {
        console.error("devflow card block: card id and reason required\n");
        console.log(USAGE.trimEnd());
        return 1;
      }
      try {
        await blockCard(cardId, reason, repoRoot);
        return 0;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error(`devflow card block ${cardId}: ${message}`);
        return 1;
      }
    },
  ],
  [
    "card:advance",
    async (positional, repoRoot, _ctx) => {
      const { cardId, targetPhase, force } = parseAdvanceArgs(positional);
      if (!cardId || !targetPhase) {
        console.error(
          "devflow card advance: card id and target phase required\n",
        );
        console.log(USAGE.trimEnd());
        return 1;
      }
      try {
        const result = await advanceCard(cardId, targetPhase, repoRoot, {
          force,
        });
        if (result.notice?.kind === "already-in-phase") {
          logCliMessage({
            kind: "success",
            command: "card advance",
            subject: result.notice.cardId,
            detail: `already in phase "${result.notice.phase}"`,
          });
        }
        if (result.failure && result.cardId) {
          logTransitionFailure(result.cardId, result.failure);
        }
        return result.exitCode;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        logCliMessage({
          kind: "error",
          command: "card advance",
          subject: cardId,
          detail: message,
        });
        return 1;
      }
    },
  ],
  [
    "card:unblock",
    async (positional, repoRoot, _ctx) => {
      const [cardId] = positional;
      if (!cardId) {
        console.error("devflow card unblock: card id required\n");
        console.log(USAGE.trimEnd());
        return 1;
      }
      try {
        await unblockCard(cardId, repoRoot);
        return 0;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error(`devflow card unblock ${cardId}: ${message}`);
        return 1;
      }
    },
  ],
  [
    "card:validate",
    async (positional, repoRoot, _ctx) => {
      const [cardId] = positional;
      if (!cardId) {
        console.error("devflow card validate: card id required\n");
        console.log(USAGE.trimEnd());
        return 1;
      }
      try {
        return await validateCardCommand(cardId, repoRoot);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error(`devflow card validate ${cardId}: ${message}`);
        return 1;
      }
    },
  ],
  [
    "variable:get",
    async (positional, repoRoot, _ctx) => {
      const [cardId, name] = positional;
      if (!cardId || !name) {
        console.error(
          "devflow variable get: card id and variable name required\n",
        );
        console.log(USAGE.trimEnd());
        return 1;
      }
      try {
        const value = await getVariable(cardId, name, repoRoot);
        Deno.stdout.writeSync(new TextEncoder().encode(value));
        return 0;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error(`devflow variable get ${cardId} ${name}: ${message}`);
        return 1;
      }
    },
  ],
  [
    "variable:set",
    async (positional, repoRoot, _ctx) => {
      const [cardId, name, ...rest] = positional;
      if (!cardId || !name || rest.length === 0) {
        console.error(
          "devflow variable set: card id, name, and value required\n",
        );
        console.log(USAGE.trimEnd());
        return 1;
      }
      const value = rest.join(" ");
      try {
        await setVariable(cardId, name, value, repoRoot, {
          ignoreLock: _ctx.ignoreLock,
        });
        return 0;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error(`devflow variable set ${cardId} ${name}: ${message}`);
        return 1;
      }
    },
  ],
  [
    "board:validate",
    async (positional, repoRoot, _ctx) => {
      const [boardName] = positional;
      if (!boardName) {
        console.error("devflow board validate: board name required\n");
        console.log(USAGE.trimEnd());
        return 1;
      }
      return await validateBoardCommand(boardName, repoRoot);
    },
  ],
  [
    "lock:release",
    async (positional, repoRoot, _ctx) => {
      try {
        const { target: cardId, force } = parseLockForceArgs(positional);
        if (!cardId) {
          console.error("devflow lock release: card id required\n");
          console.log(USAGE.trimEnd());
          return 1;
        }
        const message = await releaseCardLockCommand(cardId, repoRoot, force);
        console.error(message);
        return 0;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error(`devflow lock release: ${message}`);
        return 1;
      }
    },
  ],
  [
    "lock:release-board",
    async (positional, repoRoot, _ctx) => {
      try {
        const { target: boardName, force } = parseLockForceArgs(positional);
        if (!boardName) {
          console.error("devflow lock release-board: board name required\n");
          console.log(USAGE.trimEnd());
          return 1;
        }
        const message = await releaseBoardLockCommand(
          boardName,
          repoRoot,
          force,
        );
        console.error(message);
        return 0;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error(`devflow lock release-board: ${message}`);
        return 1;
      }
    },
  ],
  [
    "lock:release-repo",
    async (positional, repoRoot, _ctx) => {
      try {
        let force = false;
        for (const arg of positional) {
          if (arg === "--force") force = true;
          else {
            throw new Error(`unexpected argument "${arg}"`);
          }
        }
        const message = await releaseRepoLockCommand(repoRoot, force);
        console.error(message);
        return 0;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error(`devflow lock release-repo: ${message}`);
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

  if (flags.ignoreLock && !IGNORE_LOCK_COMMANDS.has(key)) {
    console.error("devflow: --ignore-lock is not supported for this command");
    return 1;
  }

  try {
    return await handler(parsed.positional, repoRoot, {
      ignoreLock: flags.ignoreLock,
    });
  } finally {
    Deno.chdir(originalCwd);
  }
}
