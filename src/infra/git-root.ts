const NOT_IN_GIT_MESSAGE = "devflow: not inside a Git repository";

/** Resolves the Git work tree root from startDir (defaults to cwd). */
export async function resolveGitRoot(startDir = Deno.cwd()): Promise<string> {
  const cmd = new Deno.Command("git", {
    args: ["rev-parse", "--show-toplevel"],
    cwd: startDir,
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stdout, stderr } = await cmd.output();
  if (code === 0) {
    return new TextDecoder().decode(stdout).trim();
  }

  const errText = new TextDecoder().decode(stderr);
  if (
    errText.includes("not a git repository") ||
    errText.includes("Not a git repository")
  ) {
    throw new Error(NOT_IN_GIT_MESSAGE);
  }

  const walked = await walkForGitRoot(startDir);
  if (walked) return walked;

  throw new Error(NOT_IN_GIT_MESSAGE);
}

async function walkForGitRoot(startDir: string): Promise<string | null> {
  let dir = startDir;
  while (true) {
    try {
      const gitPath = `${dir}/.git`;
      const stat = await Deno.stat(gitPath);
      if (stat.isDirectory || stat.isFile) {
        return dir;
      }
    } catch (e) {
      if (!(e instanceof Deno.errors.NotFound)) throw e;
    }

    const parent = dir.replace(/\/[^/]+$/, "");
    if (parent === dir) return null;
    dir = parent;
  }
}
