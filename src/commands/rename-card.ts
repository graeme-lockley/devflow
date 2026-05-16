import { loadCardState, saveCardState } from "../domain/card.ts";
import { appendHistory, titleChangedEvent, utcNow } from "../domain/history.ts";
import { resolveBoardForCard } from "../domain/resolve-card.ts";
import { cardMdFile } from "../infra/paths.ts";
import { acquireCardLock, releaseCardLock } from "../services/locks.ts";

function updateCardMdHeading(cardMd: string, title: string): string {
  const lines = cardMd.split("\n");
  if (lines[0]?.startsWith("# ")) {
    lines[0] = `# ${title}`;
    return lines.join("\n");
  }
  return `# ${title}\n${cardMd}`;
}

export async function renameCard(
  cardId: string,
  title: string,
  repoRoot: string,
): Promise<void> {
  if (!title.trim()) {
    throw new Error("card rename requires a non-empty title");
  }

  const boardName = await resolveBoardForCard(repoRoot, cardId);

  await acquireCardLock(repoRoot, boardName, cardId);
  try {
    let state = await loadCardState(repoRoot, boardName, cardId);
    const previousTitle = state.title;
    const now = utcNow();

    state = appendHistory(
      { ...state, title, updatedAt: now },
      titleChangedEvent(previousTitle, title, now),
    );
    await saveCardState(repoRoot, boardName, state);

    const mdPath = `${repoRoot}/${cardMdFile(boardName, cardId)}`;
    let cardMd: string;
    try {
      cardMd = await Deno.readTextFile(mdPath);
    } catch (e) {
      if (e instanceof Deno.errors.NotFound) {
        cardMd = "";
      } else {
        throw e;
      }
    }
    const updated = updateCardMdHeading(cardMd, title);
    const trailing = updated.endsWith("\n") ? updated : updated + "\n";
    await Deno.writeTextFile(mdPath, trailing);
  } finally {
    await releaseCardLock(repoRoot, boardName, cardId);
  }
}
