import { loadCardState } from "../domain/card.ts";
import { resolveBoardForCard } from "../domain/resolve-card.ts";

export async function getVariable(
  cardId: string,
  name: string,
  repoRoot: string,
): Promise<string> {
  const boardName = await resolveBoardForCard(repoRoot, cardId);
  const state = await loadCardState(repoRoot, boardName, cardId);
  if (!(name in state.variables)) {
    throw new Error(`variable "${name}" not set on card "${cardId}"`);
  }
  return state.variables[name];
}
