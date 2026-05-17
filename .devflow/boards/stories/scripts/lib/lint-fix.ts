/**
 * Mechanical lint fixes for the stories build loop (after `deno fmt`).
 * Applies safe auto-fixes for `no-unused-vars` on import lines; remaining
 * diagnostics are left for gate-ci and the pi feedback loop.
 */
const IGNORE = "--ignore=.devflow";
const MAX_PASSES = 3;

interface LintRange {
  start: { line: number; col: number };
  end: { line: number; col: number };
}

interface LintDiagnostic {
  filename: string;
  range: LintRange;
  message: string;
  code: string;
}

interface LintJson {
  diagnostics: LintDiagnostic[];
}

function filePathFromLintUrl(url: string): string {
  if (url.startsWith("file://")) {
    return decodeURIComponent(new URL(url).pathname);
  }
  return url;
}

function unusedNameFromMessage(message: string): string | null {
  const m = message.match(/^`([^`]+)` is never used/);
  return m?.[1] ?? null;
}

function isImportLine(line: string): boolean {
  const t = line.trimStart();
  return t.startsWith("import ") || t.startsWith("import{");
}

/** Remove a named binding from `import { a, b } from "…"`. */
export function removeNamedImportBinding(line: string, name: string): string | null {
  if (!isImportLine(line) || !line.includes(name)) return null;

  let next = line;
  next = next.replace(new RegExp(`\\b${name}\\s*,\\s*`), "");
  next = next.replace(new RegExp(`,\\s*${name}\\b`), "");
  next = next.replace(
    new RegExp(`import\\s*\\{\\s*${name}\\s*\\}\\s*from`),
    "import {} from",
  );

  if (next.includes("import {} from") || next.includes("import {  } from")) {
    return null;
  }
  if (next === line) return null;
  return next;
}

/** Drop a full default/namespace import line when the binding is unused. */
export function removeWholeImportLine(line: string, name: string, range: LintRange): boolean {
  if (!isImportLine(line)) return false;
  const trimmed = line.trim();
  const defaultRe = new RegExp(`^import\\s+${name}\\s+from\\s`);
  const nsRe = new RegExp(`^import\\s+\\*\\s+as\\s+${name}\\s+from\\s`);
  if (defaultRe.test(trimmed) || nsRe.test(trimmed)) {
    return range.start.col === 0 || trimmed.startsWith(`import ${name}`) ||
      trimmed.startsWith(`import * as ${name}`);
  }
  return false;
}

function applyFix(
  lines: string[],
  diag: LintDiagnostic,
): string | null {
  const name = unusedNameFromMessage(diag.message);
  if (!name || diag.code !== "no-unused-vars") return null;

  // deno lint --json uses 1-indexed line numbers (editor lines).
  const lineNo = Math.max(0, diag.range.start.line - 1);
  const line = lines[lineNo];
  if (!line || !isImportLine(line)) return null;

  if (removeWholeImportLine(line, name, diag.range)) {
    lines[lineNo] = "";
    return `removed unused import line (${name})`;
  }

  const updated = removeNamedImportBinding(line, name);
  if (updated) {
    lines[lineNo] = updated;
    return `removed unused import \`${name}\``;
  }

  const sole = new RegExp(`import\\s*\\{\\s*${name}\\s*\\}\\s*from`);
  if (sole.test(line.trim())) {
    lines[lineNo] = "";
    return `removed unused import line (\`${name}\`)`;
  }
  return null;
}

async function runLintJson(cwd: string): Promise<LintDiagnostic[]> {
  const cmd = new Deno.Command(Deno.execPath(), {
    args: ["lint", IGNORE, "--json"],
    cwd,
    stdout: "piped",
    stderr: "piped",
  });
  const { stdout } = await cmd.output();
  const text = new TextDecoder().decode(stdout).trim();
  if (!text) return [];
  const parsed = JSON.parse(text) as LintJson;
  return parsed.diagnostics ?? [];
}

async function fixPass(cwd: string): Promise<string[]> {
  const diags = await runLintJson(cwd);
  const byFile = new Map<string, LintDiagnostic[]>();
  for (const d of diags) {
    if (d.code !== "no-unused-vars") continue;
    const path = filePathFromLintUrl(d.filename);
    const list = byFile.get(path) ?? [];
    list.push(d);
    byFile.set(path, list);
  }

  const actions: string[] = [];
  for (const [path, fileDiags] of byFile) {
    let text: string;
    try {
      text = await Deno.readTextFile(path);
    } catch {
      continue;
    }
    const lines = text.split("\n");
    const sorted = [...fileDiags].sort((a, b) => b.range.start.line - a.range.start.line);
    let changed = false;
    for (const diag of sorted) {
      const action = applyFix(lines, diag);
      if (action) {
        actions.push(`${path}: ${action}`);
        changed = true;
      }
    }
    if (changed) {
      const body = lines.join("\n").replace(/\n{3,}/g, "\n\n");
      await Deno.writeTextFile(path, body.endsWith("\n") ? body : body + "\n");
    }
  }
  return actions;
}

if (import.meta.main) {
  const cwd = Deno.cwd();
  const all: string[] = [];
  for (let pass = 1; pass <= MAX_PASSES; pass++) {
    const actions = await fixPass(cwd);
    if (actions.length === 0) break;
    all.push(...actions.map((a) => `[pass ${pass}] ${a}`));
  }
  if (all.length > 0) {
    console.log(all.join("\n"));
  } else {
    console.log("lint-fix: no auto-fixable unused imports");
  }
}
