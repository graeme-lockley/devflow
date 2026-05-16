import { boardsRoot } from "../infra/paths.ts";

export async function listBoards(repoRoot: string): Promise<string[]> {
  const boardsPath = `${repoRoot}/${boardsRoot()}`;
  const names: string[] = [];

  try {
    for await (const entry of Deno.readDir(boardsPath)) {
      if (!entry.isDirectory) continue;
      const configPath = `${boardsPath}/${entry.name}/board.json`;
      try {
        const stat = await Deno.stat(configPath);
        if (stat.isFile) {
          names.push(entry.name);
        }
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

export function formatBoardList(names: string[]): string {
  if (names.length === 0) return "";
  return names.join("\n") + "\n";
}
