/** Console output levels and TTY colours (req §16.2, ADR-0011). */

export type LogLevel = "info" | "verbose" | "summary";

const ESC = "\x1b[";
const GREY = `${ESC}90m`;
const GREEN = `${ESC}32m`;
const RED = `${ESC}31m`;
const RESET = `${ESC}0m`;

let activeLevel: LogLevel = "info";

export function setLogLevel(level: LogLevel): void {
  activeLevel = level;
  Deno.env.set("DEVFLOW_LOG_LEVEL", level);
}

export function getLogLevel(): LogLevel {
  return activeLevel;
}

export function resetLogLevel(): void {
  activeLevel = "info";
  try {
    Deno.env.delete("DEVFLOW_LOG_LEVEL");
  } catch {
    // ignore if env not set
  }
}

function isStderrTTY(): boolean {
  try {
    return Deno.stderr.isTerminal();
  } catch {
    return false;
  }
}

/** True when stderr may use ANSI colour (req §16.2). */
export function colorsEnabled(): boolean {
  return isStderrTTY();
}

function colorize(text: string, code: string): string {
  if (!colorsEnabled()) return text;
  return `${code}${text}${RESET}`;
}

function writeStderr(line: string): void {
  console.error(line);
}

export function logInfo(message: string): void {
  if (activeLevel === "summary") return;
  writeStderr(colorize(message, GREY));
}

export function logSuccess(message: string): void {
  if (activeLevel === "summary") return;
  writeStderr(colorize(message, GREEN));
}

export function logError(message: string): void {
  writeStderr(colorize(message, RED));
}

export function logVerbose(message: string): void {
  if (activeLevel !== "verbose") return;
  writeStderr(colorize(message, GREY));
}

/** Phase transition line for summary mode (req §16.2). */
export function logSummaryTransition(from: string, to: string): void {
  if (activeLevel !== "summary") return;
  writeStderr(`${from} → ${to}`);
}

/** Machine-parseable stdout — never includes ANSI (req §16.4). */
export function writeMachineStdout(text: string): void {
  const out = text.endsWith("\n") ? text : text + "\n";
  Deno.stdout.writeSync(new TextEncoder().encode(out));
}
