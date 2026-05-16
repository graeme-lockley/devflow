export type LogLevel = "info" | "verbose" | "summary";

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
