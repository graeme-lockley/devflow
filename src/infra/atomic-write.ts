function parentDir(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? "." : path.slice(0, i);
}

function fileName(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? path : path.slice(i + 1);
}

/**
 * Writes content to path atomically via a temp file in the same directory.
 * ADR-0005: temp + rename on same filesystem.
 */
export async function writeTextFileAtomic(
  path: string,
  content: string,
): Promise<void> {
  const dir = parentDir(path);
  const base = fileName(path);
  const tmpPath = `${dir}/.${base}.tmp.${Deno.pid}`;

  await Deno.mkdir(dir, { recursive: true });
  await Deno.writeTextFile(tmpPath, content);
  await Deno.rename(tmpPath, path);
}
