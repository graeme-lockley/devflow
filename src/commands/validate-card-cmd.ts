import { validateCardById } from "../domain/validate-card.ts";

export async function validateCardCommand(
  cardId: string,
  repoRoot: string,
): Promise<number> {
  const problems = await validateCardById(repoRoot, cardId);
  if (problems.length > 0) {
    for (const p of problems) {
      console.error(p);
    }
    return 1;
  }
  return 0;
}
