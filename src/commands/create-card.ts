import { loadBoardConfig, saveBoardConfig } from "../domain/board.ts";
import {
  type CardState,
  formatCardId,
  isSequenceExhausted,
} from "../domain/card.ts";
import { createdEvent, utcNow } from "../domain/history.ts";
import { writeTextFileAtomic } from "../infra/atomic-write.ts";
import { boardCardsDir, cardDir } from "../infra/paths.ts";
import { acquireBoardLock, releaseBoardLock } from "../services/locks.ts";

export async function createCard(
  boardName: string,
  title: string,
  repoRoot: string,
  description?: string,
): Promise<string> {
  if (!title.trim()) {
    throw new Error("card create requires a non-empty title");
  }

  const cardMd = description === undefined
    ? `# ${title}\n`
    : `# ${title}\n\n${description.replace(/\n+$/, "")}\n`;

  let config = await loadBoardConfig(repoRoot, boardName);

  if (isSequenceExhausted(config.nextSequence, config.sequenceWidth)) {
    throw new Error(
      `board "${boardName}": sequence exhausted for sequenceWidth ${config.sequenceWidth}`,
    );
  }

  await acquireBoardLock(repoRoot, boardName);
  try {
    config = await loadBoardConfig(repoRoot, boardName);

    if (isSequenceExhausted(config.nextSequence, config.sequenceWidth)) {
      throw new Error(
        `board "${boardName}": sequence exhausted for sequenceWidth ${config.sequenceWidth}`,
      );
    }

    const sequence = config.nextSequence;
    const cardId = formatCardId(
      config.idPrefix,
      sequence,
      config.sequenceWidth,
    );
    const firstPhase = config.phases[0];
    if (!firstPhase) {
      throw new Error(`board "${boardName}" has no phases`);
    }

    const now = utcNow();
    const state: CardState = {
      id: cardId,
      board: boardName,
      title,
      phase: firstPhase,
      previousPhase: null,
      createdAt: now,
      updatedAt: now,
      variables: {},
      history: [createdEvent(firstPhase, now)],
      blocked: null,
    };

    const cardsPath = `${repoRoot}/${boardCardsDir(boardName)}`;
    const tmpDir = `${cardsPath}/.${cardId}.tmp.${Deno.pid}`;
    const finalDir = `${repoRoot}/${cardDir(boardName, cardId)}`;

    try {
      await Deno.mkdir(`${tmpDir}/files`, { recursive: true });
      await Deno.mkdir(`${tmpDir}/logs`, { recursive: true });

      await writeTextFileAtomic(
        `${tmpDir}/state.json`,
        JSON.stringify(state, null, 2) + "\n",
      );
      await Deno.writeTextFile(`${tmpDir}/card.md`, cardMd);

      await Deno.rename(tmpDir, finalDir);
    } catch (e) {
      try {
        await Deno.remove(tmpDir, { recursive: true });
      } catch {
        // best-effort cleanup
      }
      throw e;
    }

    config.nextSequence = sequence + 1;
    config.updatedAt = now;
    await saveBoardConfig(repoRoot, config);

    return cardId;
  } finally {
    await releaseBoardLock(repoRoot, boardName);
  }
}
