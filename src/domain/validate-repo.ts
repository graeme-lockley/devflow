import { DEVFLOW_GITIGNORE_PATTERNS } from "../infra/gitignore.ts";
import { devflowRoot } from "../infra/paths.ts";

export async function validateRepoOnDisk(
  repoRoot: string,
): Promise<string[]> {
  const problems: string[] = [];

  const gitVersion = await new Deno.Command("git", {
    args: ["--version"],
    stdout: "null",
    stderr: "null",
  }).output();
  if (!gitVersion.success) {
    problems.push("git command is not available");
  }

  const devflowPath = `${repoRoot}/${devflowRoot()}`;
  try {
    const stat = await Deno.stat(devflowPath);
    if (!stat.isDirectory) {
      problems.push(
        `${devflowRoot()} exists but is not a directory`,
      );
    }
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      problems.push(
        `${devflowRoot()}/ directory does not exist (no boards initialized yet)`,
      );
    } else {
      throw e;
    }
  }

  let gitignoreContent = "";
  try {
    gitignoreContent = await Deno.readTextFile(`${repoRoot}/.gitignore`);
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      problems.push(".gitignore does not exist");
    } else {
      throw e;
    }
  }

  if (gitignoreContent) {
    const lines = new Set(
      gitignoreContent.split("\n").map((l) => l.trim()),
    );
    for (const pattern of DEVFLOW_GITIGNORE_PATTERNS) {
      if (!lines.has(pattern)) {
        problems.push(
          `.gitignore missing required entry: ${pattern}`,
        );
      }
    }
  }

  return problems;
}
