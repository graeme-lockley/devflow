/** Git preconditions and commits for advance (req §13, ADR-0009). */

import { logPlain, logVerbose } from "./console.ts";

const GIT_STATE_MARKERS = [
  "MERGE_HEAD",
  "REBASE_HEAD",
  "CHERRY_PICK_HEAD",
  "REVERT_HEAD",
] as const;

export async function assertGitAdvanceAllowed(repoRoot: string): Promise<void> {
  const gitDir = `${repoRoot}/.git`;

  for (const marker of GIT_STATE_MARKERS) {
    const path = `${gitDir}/${marker}`;
    try {
      await Deno.stat(path);
      throw new Error(
        `repository is in an unresolved ${
          marker.replace("_HEAD", "").toLowerCase()
        } state; resolve before advancing`,
      );
    } catch (e) {
      if (e instanceof Deno.errors.NotFound) continue;
      if (e instanceof Error && e.message.includes("unresolved")) throw e;
      throw e;
    }
  }
}

export function defaultCommitMessage(
  cardId: string,
  fromPhase: string,
  toPhase: string,
): string {
  return `Advance ${cardId} from ${fromPhase} to ${toPhase}`;
}

async function runGit(
  repoRoot: string,
  args: string[],
): Promise<{ code: number; stderr: string }> {
  logVerbose(`git ${args.join(" ")}`);
  const result = await new Deno.Command("git", {
    args,
    cwd: repoRoot,
    stdout: "null",
    stderr: "piped",
  }).output();
  return {
    code: result.code,
    stderr: new TextDecoder().decode(result.stderr).trim(),
  };
}

/** Stages all changes from repository root (req §13.6). */
export async function stageAll(repoRoot: string): Promise<void> {
  const { code, stderr } = await runGit(repoRoot, ["add", "-A"]);
  if (code !== 0) {
    throw new Error(stderr || "git add -A failed");
  }
}

/** Paths included in the given commit (default HEAD). */
async function listCommitFiles(
  repoRoot: string,
  ref = "HEAD",
): Promise<string[]> {
  const result = await new Deno.Command("git", {
    args: ["show", "--name-only", "--pretty=format:", ref],
    cwd: repoRoot,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (result.code !== 0) return [];
  const text = new TextDecoder().decode(result.stdout).trim();
  if (!text) return [];
  return text.split("\n").filter((line) => line.length > 0);
}

function logCommittedFiles(message: string, files: string[]): void {
  const subject = message.split("\n")[0]?.trim() ?? message;
  const preview = subject.length > 72 ? `${subject.slice(0, 69)}...` : subject;
  if (files.length === 0) {
    logPlain(`git commit: ${preview}`);
    return;
  }
  logPlain(
    `git commit (${files.length} file${
      files.length === 1 ? "" : "s"
    }): ${preview}`,
  );
  for (const file of files) {
    logPlain(`  ${file}`);
  }
}

/** Creates a commit with the given message (req §13.5). */
export async function commit(
  repoRoot: string,
  message: string,
): Promise<void> {
  const { code, stderr } = await runGit(repoRoot, [
    "commit",
    "-m",
    message,
  ]);
  if (code !== 0) {
    throw new Error(stderr || "git commit failed");
  }
  const files = await listCommitFiles(repoRoot);
  logCommittedFiles(message, files);
}
