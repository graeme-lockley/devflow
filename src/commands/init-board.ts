import {
  createBoardConfig,
  type PhaseScriptConfig,
  saveBoardConfig,
} from "../domain/board.ts";
import { validateIdentifier } from "../domain/identifiers.ts";
import { parseInitArgs, validateSequenceWidth } from "../cli/init-flags.ts";
import { ensureDevflowGitignoreEntries } from "../infra/gitignore.ts";
import {
  boardCardsDir,
  boardConfigFile,
  boardScriptsDir,
  boardSkillsDir,
  boardsRoot,
  devflowRoot,
} from "../infra/paths.ts";
import { acquireRepoLock, releaseRepoLock } from "../services/locks.ts";
import {
  copyTemplateScriptsAndSkills,
  loadTemplatePhaseScripts,
  resolveTemplateDirOrThrow,
} from "../services/templates.ts";

export interface InitBoardOptions {
  sequenceWidth?: number;
  template?: string;
}

async function assertDirectory(path: string, label: string): Promise<void> {
  try {
    const stat = await Deno.stat(path);
    if (!stat.isDirectory) {
      throw new Error(`${label} exists but is not a directory`);
    }
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return;
    throw e;
  }
}

export async function initBoard(
  boardName: string,
  phaseNames: string[],
  repoRoot = Deno.cwd(),
  options: InitBoardOptions = {},
): Promise<void> {
  const boardErr = validateIdentifier(boardName, "board");
  if (boardErr) throw new Error(boardErr);

  if (phaseNames.length === 0) {
    throw new Error("board init requires at least one phase name");
  }

  for (const name of phaseNames) {
    const err = validateIdentifier(name, "phase");
    if (err) throw new Error(err);
  }

  if (options.sequenceWidth !== undefined) {
    validateSequenceWidth(options.sequenceWidth);
  }

  await acquireRepoLock(repoRoot);
  try {
    const devflowPath = `${repoRoot}/${devflowRoot()}`;
    const boardsPath = `${repoRoot}/${boardsRoot()}`;
    await assertDirectory(devflowPath, devflowRoot());
    await assertDirectory(boardsPath, boardsRoot());

    const configRel = boardConfigFile(boardName);
    const configPath = `${repoRoot}/${configRel}`;
    try {
      await Deno.stat(configPath);
      throw new Error(
        `board "${boardName}" already exists at ${configRel}; remove it before re-initializing`,
      );
    } catch (e) {
      if (!(e instanceof Deno.errors.NotFound)) throw e;
    }

    const dirs = [
      `${repoRoot}/${boardsRoot()}`,
      `${repoRoot}/${boardCardsDir(boardName)}`,
      `${repoRoot}/${boardScriptsDir(boardName)}`,
      `${repoRoot}/${boardSkillsDir(boardName)}`,
    ];

    for (const dir of dirs) {
      await Deno.mkdir(dir, { recursive: true });
    }

    let phaseScripts: Record<string, PhaseScriptConfig> | undefined;
    if (options.template) {
      const templateDir = await resolveTemplateDirOrThrow(
        options.template,
        repoRoot,
      );
      await copyTemplateScriptsAndSkills(templateDir, repoRoot, boardName);
      phaseScripts = await loadTemplatePhaseScripts(templateDir, phaseNames);
    }

    const config = createBoardConfig(boardName, phaseNames, {
      sequenceWidth: options.sequenceWidth,
    });
    if (phaseScripts) {
      config.phaseScripts = phaseScripts;
    }
    await saveBoardConfig(repoRoot, config);

    await ensureDevflowGitignoreEntries(repoRoot);
  } finally {
    await releaseRepoLock(repoRoot);
  }
}

export async function initBoardFromArgs(
  boardName: string,
  args: string[],
  repoRoot = Deno.cwd(),
): Promise<void> {
  const { phaseNames, options } = parseInitArgs(args);
  await initBoard(boardName, phaseNames, repoRoot, options);
}
