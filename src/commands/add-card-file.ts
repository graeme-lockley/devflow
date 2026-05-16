import { loadCardState, saveCardState } from "../domain/card.ts";
import { appendHistory, fileAttachedEvent, utcNow } from "../domain/history.ts";
import { resolveBoardForCard } from "../domain/resolve-card.ts";
import { cardFilesDir } from "../infra/paths.ts";
import { acquireCardLock, releaseCardLock } from "../services/locks.ts";

function basename(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const i = normalized.lastIndexOf("/");
  return i === -1 ? normalized : normalized.slice(i + 1);
}

export async function addCardFile(
  cardId: string,
  sourcePath: string,
  repoRoot: string,
  options: { overwrite?: boolean; ignoreLock?: boolean } = {},
): Promise<void> {
  const boardName = await resolveBoardForCard(repoRoot, cardId);
  const filename = basename(sourcePath);

  if (filename.includes("/") || filename.includes("\\") || filename === "") {
    throw new Error("invalid source path for attachment");
  }

  const absSource = sourcePath.startsWith("/")
    ? sourcePath
    : new URL(sourcePath, `file://${repoRoot}/`).pathname;

  let sourceStat: Deno.FileInfo;
  try {
    sourceStat = await Deno.lstat(absSource);
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      throw new Error(`source file not found: ${sourcePath}`);
    }
    throw e;
  }

  if (sourceStat.isSymlink) {
    throw new Error(`symlinks are not allowed: ${sourcePath}`);
  }

  if (!sourceStat.isFile) {
    throw new Error(`source is not a regular file: ${sourcePath}`);
  }

  const destDir = `${repoRoot}/${cardFilesDir(boardName, cardId)}`;
  const destPath = `${destDir}/${filename}`;

  const acquired = await acquireCardLock(repoRoot, boardName, cardId, {
    ignoreLock: options.ignoreLock,
  });
  try {
    try {
      const destStat = await Deno.stat(destPath);
      if (destStat.isFile && !options.overwrite) {
        throw new Error(
          `file "${filename}" already exists; pass --overwrite to replace`,
        );
      }
    } catch (e) {
      if (!(e instanceof Deno.errors.NotFound)) throw e;
    }

    await Deno.mkdir(destDir, { recursive: true });
    await Deno.copyFile(absSource, destPath);

    const now = utcNow();
    let state = await loadCardState(repoRoot, boardName, cardId);
    state = appendHistory(
      { ...state, updatedAt: now },
      fileAttachedEvent(filename, now),
    );
    await saveCardState(repoRoot, boardName, state);
  } finally {
    if (acquired) {
      await releaseCardLock(repoRoot, boardName, cardId);
    }
  }
}
