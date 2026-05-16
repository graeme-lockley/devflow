import { assertEquals } from "@std/assert";
import {
  colorsEnabled,
  emphasise,
  formatTransitionFailurePlain,
  grey,
  logCliMessage,
  logError,
  logInfo,
  logPlain,
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

Deno.test("logPlain has no ANSI and is suppressed in summary mode", () => {
  resetLogLevel();
  setLogLevel("info");
  const out = captureStderr(() => logPlain("committed"));
  assertEquals(ANSI_RE.test(out), false);
  assertEquals(out, "committed");

  setLogLevel("summary");
  assertEquals(captureStderr(() => logPlain("committed")), "");
});

Deno.test("formatTransitionFailurePlain uses Error headline (req §11.5)", () => {
  const out = formatTransitionFailurePlain("transition failed", [
    { label: "card", value: "stories-000001" },
    { label: "phase", value: "preparing" },
    { label: "target", value: "planning" },
    { label: "script", value: "preparing-001-check-git-clean" },
    { label: "exit", value: "1" },
    { label: "log", value: ".devflow/.../output.log" },
  ]);
  assertEquals(out.startsWith("Error: transition failed"), true);
  assertEquals(out.includes("card: stories-000001"), true);
  assertEquals(out.includes("ERROR:"), false);
});

Deno.test("emphasise returns plain text when colour disabled", () => {
  assertEquals(emphasise("hello", false), "hello");
  assertEquals(grey("k:", false), "k:");
});

Deno.test("emphasise wraps text in bold ANSI when colour enabled", () => {
  assertEquals(emphasise("hello", true), "\x1b[1mhello\x1b[0m");
  assertEquals(grey("k:", true), "\x1b[90mk:\x1b[0m");
});

Deno.test("logCliMessage plain when stderr is not a TTY", () => {
  resetLogLevel();
  setLogLevel("info");
  if (Deno.stderr.isTerminal()) return;

  const out = captureStderr(() =>
    logCliMessage({
      kind: "success",
      command: "card advance",
      subject: "stories-000001",
      detail: 'already in phase "preparing"',
    })
  );
  assertEquals(ANSI_RE.test(out), false);
  assertEquals(
    out,
    'Success: card advance: stories-000001: already in phase "preparing"',
  );
});
