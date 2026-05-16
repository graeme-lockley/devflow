/** Console output levels and TTY colours (req §16.2, ADR-0011). */

export type LogLevel = "info" | "verbose" | "summary";

const ESC = "\x1b[";
const GREY = `${ESC}90m`;
const GREEN = `${ESC}32m`;
const RED = `${ESC}31m`;
const BOLD = `${ESC}1m`;
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

function isStdoutTTY(): boolean {
  try {
    return Deno.stdout.isTerminal();
  } catch {
    return false;
  }
}

/** True when stderr may use ANSI colour (req §16.2). */
export function colorsEnabled(): boolean {
  return isStderrTTY();
}

/**
 * True when stdout may use ANSI colour for formatted human output
 * (req §16.2, §16.4). Only commands not listed as machine-parseable
 * should consult this.
 */
export function colorsEnabledForStdout(): boolean {
  return isStdoutTTY();
}

/**
 * Wraps text in a bold ANSI sequence when colour is enabled, otherwise
 * returns text unchanged. Used to emphasise key tokens (req §16.2,
 * ADR-0011). `colour` defaults to the stderr TTY state because most
 * emphasis is used inside stderr diagnostics; pass an explicit value
 * for stdout formatters.
 */
export function emphasise(
  text: string,
  colour: boolean = colorsEnabled(),
): string {
  if (!colour) return text;
  return `${BOLD}${text}${RESET}`;
}

/** Wrap text in the grey ANSI sequence when colour is enabled. */
export function grey(text: string, colour: boolean = colorsEnabled()): string {
  if (!colour) return text;
  return `${GREY}${text}${RESET}`;
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

/** Default terminal colour (no ANSI styling); suppressed in summary mode. */
export function logPlain(message: string): void {
  if (activeLevel === "summary") return;
  writeStderr(message);
}

export function logSuccess(message: string): void {
  if (activeLevel === "summary") return;
  writeStderr(colorize(message, GREEN));
}

export function logError(message: string): void {
  writeStderr(colorize(message, RED));
}

export type CliMessageKind = "error" | "success" | "info";

export interface CliMessageOptions {
  kind: CliMessageKind;
  /** Subcommand context, e.g. `card advance`. */
  command: string;
  /** Card id, board name, or similar (shown in grey when coloured). */
  subject?: string;
  /** Remainder of the line (default terminal colour when coloured). */
  detail: string;
}

/**
 * Structured stderr line for user-facing CLI feedback (req §16.2).
 * Example: Success: card advance: stories-000001: already in phase "preparing"
 */
export function logCliMessage(options: CliMessageOptions): void {
  const { kind, command, subject, detail } = options;
  if (activeLevel === "summary" && kind === "info") return;

  const label = kind === "error"
    ? "Error"
    : kind === "success"
    ? "Success"
    : "Note";
  const labelColor = kind === "error" ? RED : kind === "success" ? GREEN : GREY;

  if (!colorsEnabled()) {
    let line = `${label}: ${command}`;
    if (subject) line += `: ${subject}`;
    line += `: ${detail}`;
    writeStderr(line);
    return;
  }

  let line = `${labelColor}${label}:${RESET} ${GREY}${command}:${RESET}`;
  if (subject) {
    line += ` ${GREY}${subject}:${RESET}`;
  }
  line += ` ${detail}`;
  writeStderr(line);
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

export interface TransitionFailureField {
  label: string;
  value: string;
}

/** Plain-text transition failure block (req §11.5); no ANSI. */
export function formatTransitionFailurePlain(
  headline: string,
  fields: TransitionFailureField[],
): string {
  const lines = [`Error: ${headline}`, ""];
  for (const { label, value } of fields) {
    lines.push(`${label}: ${value}`);
  }
  return lines.join("\n");
}

function transitionFailureFields(
  cardId: string,
  failure: {
    kind: "script" | "git";
    from: string;
    targetPhase: string;
    script?: string;
    exitCode?: number;
    gitError?: string;
    logPath: string;
  },
): { headline: string; fields: TransitionFailureField[] } {
  const headline = failure.kind === "git"
    ? "git commit failed"
    : "transition failed";
  const fields: TransitionFailureField[] = [
    { label: "card", value: cardId },
    { label: "phase", value: failure.from },
    { label: "target", value: failure.targetPhase },
  ];
  if (failure.kind === "script") {
    fields.push({ label: "script", value: failure.script! });
    fields.push({ label: "exit", value: String(failure.exitCode!) });
  } else {
    fields.push({ label: "git", value: failure.gitError! });
  }
  fields.push({ label: "log", value: failure.logPath });
  return { headline, fields };
}

/**
 * Transition failure block for card advance (req §11.5).
 * Error: (red) headline (default); label: (grey) value (default).
 */
export function logTransitionFailure(
  cardId: string,
  failure: {
    kind: "script" | "git";
    from: string;
    targetPhase: string;
    script?: string;
    exitCode?: number;
    gitError?: string;
    logPath: string;
  },
): void {
  const { headline, fields } = transitionFailureFields(cardId, failure);

  if (!colorsEnabled()) {
    writeStderr(formatTransitionFailurePlain(headline, fields));
    return;
  }

  writeStderr(`${RED}Error:${RESET} ${headline}`);
  writeStderr("");
  for (const { label, value } of fields) {
    writeStderr(`${GREY}${label}:${RESET} ${value}`);
  }
}
