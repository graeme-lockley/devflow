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

  for (
    const [key, value] of [
      ["user.email", "devflow@test.local"],
      ["user.name", "Devflow Test"],
    ] as const
  ) {
    const cfg = new Deno.Command("git", {
      args: ["config", key, value],
      cwd: dir,
      stdout: "null",
      stderr: "null",
    });
    const cfgOut = await cfg.output();
    if (cfgOut.code !== 0) {
      throw new Error(`failed to set git ${key}`);
    }
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

export async function countCommits(repoRoot: string): Promise<number> {
  const result = await new Deno.Command("git", {
    args: ["rev-list", "--count", "HEAD"],
    cwd: repoRoot,
    stdout: "piped",
  }).output();
  if (result.code !== 0) return 0;
  return Number(new TextDecoder().decode(result.stdout).trim());
}

export async function latestCommitSubject(repoRoot: string): Promise<string> {
  const result = await new Deno.Command("git", {
    args: ["log", "-1", "--format=%s"],
    cwd: repoRoot,
    stdout: "piped",
  }).output();
  return new TextDecoder().decode(result.stdout).trim();
}
