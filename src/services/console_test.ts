import { assertEquals } from "@std/assert";
import {
  colorsEnabled,
  logError,
  logInfo,
  logSuccess,
  logSummaryTransition,
  logVerbose,
  resetLogLevel,
  setLogLevel,
  writeMachineStdout,
} from "./console.ts";

const ANSI_RE = new RegExp(String.fromCharCode(27) + "\\[");

function captureStderr(fn: () => void): string {
  const chunks: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    chunks.push(args.map(String).join(" "));
  };
  try {
    fn();
    return chunks.join("\n");
  } finally {
    console.error = original;
  }
}

function captureStdout(fn: () => void): string {
  const chunks: Uint8Array[] = [];
  const originalWrite = Deno.stdout.writeSync.bind(Deno.stdout);
  Deno.stdout.writeSync = (buf: Uint8Array) => {
    chunks.push(buf);
    return buf.length;
  };
  try {
    fn();
    const len = chunks.reduce((n, c) => n + c.length, 0);
    const buf = new Uint8Array(len);
    let off = 0;
    for (const c of chunks) {
      buf.set(c, off);
      off += c.length;
    }
    return new TextDecoder().decode(buf);
  } finally {
    Deno.stdout.writeSync = originalWrite;
  }
}

Deno.test("colorsEnabled is false when stderr is not a TTY", () => {
  // In deno test, stderr is typically not a TTY
  assertEquals(colorsEnabled(), Deno.stderr.isTerminal());
});

Deno.test("logInfo/logSuccess/logError emit no ANSI when not a TTY", () => {
  resetLogLevel();
  setLogLevel("info");
  if (Deno.stderr.isTerminal()) return;

  const info = captureStderr(() => logInfo("hello"));
  const success = captureStderr(() => logSuccess("done"));
  const err = captureStderr(() => logError("fail"));
  assertEquals(ANSI_RE.test(info), false);
  assertEquals(ANSI_RE.test(success), false);
  assertEquals(ANSI_RE.test(err), false);
  assertEquals(info, "hello");
  assertEquals(success, "done");
  assertEquals(err, "fail");
});

Deno.test("logVerbose only prints in verbose mode", () => {
  resetLogLevel();
  setLogLevel("info");
  assertEquals(captureStderr(() => logVerbose("hidden")), "");

  setLogLevel("verbose");
  const out = captureStderr(() => logVerbose("shown"));
  assertEquals(out.includes("shown"), true);
});

Deno.test("logSummaryTransition only prints in summary mode", () => {
  resetLogLevel();
  setLogLevel("info");
  assertEquals(captureStderr(() => logSummaryTransition("a", "b")), "");

  setLogLevel("summary");
  const out = captureStderr(() =>
    logSummaryTransition("unplanned", "planning")
  );
  assertEquals(out, "unplanned → planning");
});

Deno.test("writeMachineStdout has no ANSI codes", () => {
  const out = captureStdout(() => writeMachineStdout("stories-000001"));
  assertEquals(ANSI_RE.test(out), false);
  assertEquals(out, "stories-000001\n");
});

Deno.test("logInfo suppressed in summary mode", () => {
  resetLogLevel();
  setLogLevel("summary");
  assertEquals(captureStderr(() => logInfo("grey")), "");
});
