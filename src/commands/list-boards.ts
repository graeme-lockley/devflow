import { listBoardNames } from "../domain/board.ts";

export function listBoards(repoRoot: string): Promise<string[]> {
  return listBoardNames(repoRoot);
}

export function formatBoardList(names: string[]): string {
  if (names.length === 0) return "";
  return names.join("\n") + "\n";
}
