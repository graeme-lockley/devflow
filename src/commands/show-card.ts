import { loadCardState } from "../domain/card.ts";
import { resolveBoardForCard } from "../domain/resolve-card.ts";
import { cardMdFile } from "../infra/paths.ts";

export function formatCardShow(
  state: {
    id: string;
    board: string;
    title: string;
    phase: string;
    createdAt: string;
    updatedAt: string;
  },
  cardMd: string,
): string {
  const frontmatter = [
    "---",
    `id: ${state.id}`,
    `board: ${state.board}`,
    `title: ${state.title}`,
    `phase: ${state.phase}`,
    `createdAt: ${state.createdAt}`,
    `updatedAt: ${state.updatedAt}`,
    "---",
    "",
  ].join("\n");
  return frontmatter + cardMd;
}

export async function showCard(
  cardId: string,
  repoRoot: string,
): Promise<string> {
  const boardName = await resolveBoardForCard(repoRoot, cardId);
  const state = await loadCardState(repoRoot, boardName, cardId);
  const mdPath = `${repoRoot}/${cardMdFile(boardName, cardId)}`;
  let cardMd: string;
  try {
    cardMd = await Deno.readTextFile(mdPath);
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      throw new Error(`card "${cardId}": card.md not found`);
    }
    throw e;
  }
  return formatCardShow(state, cardMd);
}
