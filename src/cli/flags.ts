import type { LogLevel } from "../services/console.ts";

export interface ParsedFlags {
  remaining: string[];
  verbose: boolean;
  summary: boolean;
  ignoreLock: boolean;
}

export function parseGlobalFlags(args: string[]): ParsedFlags {
  const remaining: string[] = [];
  let verbose = false;
  let summary = false;
  let ignoreLock = false;

  for (const arg of args) {
    if (arg === "--verbose") {
      verbose = true;
    } else if (arg === "--summary") {
      summary = true;
    } else if (arg === "--ignore-lock") {
      ignoreLock = true;
    } else {
      remaining.push(arg);
    }
  }

  return { remaining, verbose, summary, ignoreLock };
}

export function resolveLogLevel(flags: ParsedFlags): LogLevel {
  if (flags.verbose) return "verbose";
  if (flags.summary) return "summary";
  return "info";
}

export function validateGlobalFlags(flags: ParsedFlags): string | null {
  if (flags.verbose && flags.summary) {
    return "devflow: --verbose and --summary are mutually exclusive";
  }
  return null;
}
