import { ensureJsrBuiltinTemplateDir } from "../infra/jsr-templates.ts";
import { devflowPackageRoot } from "../infra/package-root.ts";
import { boardRoot, templatesRoot } from "../infra/paths.ts";

async function isDirectory(path: string): Promise<boolean> {
  try {
    const stat = await Deno.stat(path);
    return stat.isDirectory;
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return false;
    throw e;
  }
}

export async function resolveTemplateDir(
  templateName: string,
  repoRoot: string,
): Promise<string> {
  const local = `${repoRoot}/${templatesRoot()}/${templateName}`;
  if (await isDirectory(local)) {
    return local;
  }

  const builtin = `${devflowPackageRoot()}/templates/${templateName}`;
  if (await isDirectory(builtin)) {
    return builtin;
  }

  try {
    return await ensureJsrBuiltinTemplateDir(
      templateName,
      import.meta.url,
    );
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new Error(
      `template "${templateName}" not found (checked ${templatesRoot()}/${templateName}/, built-in templates/${templateName}/, and JSR cache: ${detail})`,
    );
  }
}

async function copyDirRecursive(src: string, dest: string): Promise<void> {
  await Deno.mkdir(dest, { recursive: true });
  for await (const entry of Deno.readDir(src)) {
    const srcPath = `${src}/${entry.name}`;
    const destPath = `${dest}/${entry.name}`;
    if (entry.isDirectory) {
      await copyDirRecursive(srcPath, destPath);
    } else if (entry.isFile) {
      await Deno.copyFile(srcPath, destPath);
    }
  }
}

export async function copyTemplateScriptsAndSkills(
  templateDir: string,
  repoRoot: string,
  boardName: string,
): Promise<void> {
  const scriptsSrc = `${templateDir}/scripts`;
  const skillsSrc = `${templateDir}/skills`;
  const assetsSrc = `${templateDir}/assets`;

  if (!(await isDirectory(scriptsSrc))) {
    throw new Error(`template missing scripts/ directory: ${scriptsSrc}`);
  }
  if (!(await isDirectory(skillsSrc))) {
    throw new Error(`template missing skills/ directory: ${skillsSrc}`);
  }

  const boardBase = `${repoRoot}/${boardRoot(boardName)}`;
  await copyDirRecursive(scriptsSrc, `${boardBase}/scripts`);
  await copyDirRecursive(skillsSrc, `${boardBase}/skills`);

  // Copy assets/ if present (optional)
  if (await isDirectory(assetsSrc)) {
    await copyDirRecursive(assetsSrc, `${boardBase}/assets`);
  }
}

export async function templateHasScriptsAndSkills(
  templateDir: string,
): Promise<boolean> {
  return (
    (await isDirectory(`${templateDir}/scripts`)) &&
    (await isDirectory(`${templateDir}/skills`))
  );
}

export async function resolveTemplateDirOrThrow(
  templateName: string,
  repoRoot: string,
): Promise<string> {
  const dir = await resolveTemplateDir(templateName, repoRoot);
  if (!(await templateHasScriptsAndSkills(dir))) {
    throw new Error(
      `template "${templateName}" is missing scripts/ or skills/`,
    );
  }
  return dir;
}
