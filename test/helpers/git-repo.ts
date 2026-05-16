/** Runs fn inside a temporary directory initialized as a Git repository. */
export async function withTempGitRepo<T>(
  fn: (repoRoot: string) => Promise<T>,
): Promise<T> {
  const dir = await Deno.makeTempDir();
  const init = new Deno.Command("git", {
    args: ["init"],
    cwd: dir,
    stdout: "null",
    stderr: "null",
  });
  const { code } = await init.output();
  if (code !== 0) {
    throw new Error("failed to initialize temp git repository");
  }

  try {
    return await fn(dir);
  } finally {
    try {
      await Deno.remove(dir, { recursive: true });
    } catch {
      // best-effort cleanup
    }
  }
}
