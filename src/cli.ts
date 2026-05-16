import { initBoard } from "./commands/init-board.ts";
import { boardRoot } from "./paths.ts";

const USAGE = `devflow — AI harness around a Kanban board

Usage:
  devflow init <board> <column> [<column> ...]

  <board>   Board name (any identifier valid as a directory name under .devflow/)
  <column>  Column names, left to right on the board

Run \`devflow\` with no arguments to print this help.
`;

export async function runCli(args: string[]): Promise<number> {
  if (args.length === 0) {
    console.log(USAGE.trimEnd());
    return 0;
  }

  const [command, boardName, ...rest] = args;

  if (command === "init") {
    if (!boardName) {
      console.error("devflow init: board name required\n");
      console.log(USAGE.trimEnd());
      return 1;
    }
    try {
      await initBoard(boardName, rest);
      console.log(`Initialized board "${boardName}" at ${boardRoot(boardName)}/`);
      return 0;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`devflow init ${boardName}: ${message}`);
      return 1;
    }
  }

  console.error(`Unknown command: ${args.join(" ")}\n`);
  console.log(USAGE.trimEnd());
  return 1;
}
