export const DEVFLOW_GITIGNORE_PATTERNS = [
  ".devflow/.lock/",
  ".devflow/**/.lock/",
] as const;

/** Ensures spec lock-directory patterns exist in the repo .gitignore. */
export async function ensureDevflowGitignoreEntries(
  repoRoot: string,
): Promise<void> {
  const gitignorePath = `${repoRoot}/.gitignore`;
  let content = "";
  try {
    content = await Deno.readTextFile(gitignorePath);
  } catch (e) {
    if (!(e instanceof Deno.errors.NotFound)) throw e;
  }

  const lines = content.length > 0 ? content.split("\n") : [];
  const existing = new Set(lines.map((l) => l.trim()));

  const toAppend: string[] = [];
  for (const pattern of DEVFLOW_GITIGNORE_PATTERNS) {
    if (!existing.has(pattern)) {
      toAppend.push(pattern);
    }
  }

  if (toAppend.length === 0) return;

  const needsLeadingNewline = content.length > 0 && !content.endsWith("\n");
  const prefix = content.length === 0
    ? ""
    : needsLeadingNewline
    ? content + "\n"
    : content;
  const separator = prefix.length > 0 && !prefix.endsWith("\n\n") ? "\n" : "";
  await Deno.writeTextFile(
    gitignorePath,
    prefix + separator + toAppend.join("\n") + "\n",
  );
}
