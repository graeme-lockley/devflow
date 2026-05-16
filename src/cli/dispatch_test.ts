import { assertEquals } from "@std/assert";
import { runCli, USAGE } from "./dispatch.ts";

/** Capture stdout during a runCli call. */
function captureStdout(fn: () => Promise<number>): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  const stdoutChunks: Uint8Array[] = [];
  const stderrChunks: string[] = [];

  const originalStdoutWrite = Deno.stdout.writeSync.bind(Deno.stdout);
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;

  Deno.stdout.writeSync = (buf: Uint8Array) => {
    stdoutChunks.push(buf.slice()); // copy buffer
    return buf.length;
  };

  console.log = (...args: unknown[]) => {
    const text = args.map(String).join(" ");
    // When console.log is used to write to stdout, we redirect to our capture
    const encoder = new TextEncoder();
    const buf = encoder.encode(text + "\n");
    stdoutChunks.push(buf);
  };

  console.error = (...args: unknown[]) => {
    stderrChunks.push(args.map(String).join(" "));
  };

  return fn().then((exitCode) => {
    Deno.stdout.writeSync = originalStdoutWrite;
    console.log = originalConsoleLog;
    console.error = originalConsoleError;

    const stdoutLen = stdoutChunks.reduce((n, c) => n + c.length, 0);
    const stdoutBuf = new Uint8Array(stdoutLen);
    let off = 0;
    for (const c of stdoutChunks) {
      stdoutBuf.set(c, off);
      off += c.length;
    }
    const stdout = new TextDecoder().decode(stdoutBuf);
    const stderr = stderrChunks.join("\n");

    return { stdout, stderr, exitCode };
  });
}

Deno.test("runCli with no args prints usage and exits 0", async () => {
  const { stdout, stderr, exitCode } = await captureStdout(() => runCli([]));
  assertEquals(stdout, USAGE.trimEnd() + "\n");
  assertEquals(stderr, "");
  assertEquals(exitCode, 0);
});

Deno.test("runCli with 'help' command prints usage and exits 0", async () => {
  const { stdout, stderr, exitCode } = await captureStdout(() =>
    runCli(["help"])
  );
  assertEquals(stdout, USAGE.trimEnd() + "\n");
  assertEquals(stderr, "");
  assertEquals(exitCode, 0);
});

Deno.test("runCli with --help flag prints usage and exits 0", async () => {
  const { stdout, stderr, exitCode } = await captureStdout(() =>
    runCli(["--help"])
  );
  assertEquals(stdout, USAGE.trimEnd() + "\n");
  assertEquals(stderr, "");
  assertEquals(exitCode, 0);
});

Deno.test("runCli with -h flag prints usage and exits 0", async () => {
  const { stdout, stderr, exitCode } = await captureStdout(() =>
    runCli(["-h"])
  );
  assertEquals(stdout, USAGE.trimEnd() + "\n");
  assertEquals(stderr, "");
  assertEquals(exitCode, 0);
});

Deno.test("runCli with unknown command shows error without USAGE (NO_COLOR)", async () => {
  Deno.env.set("NO_COLOR", "1");
  try {
    const { stdout, stderr, exitCode } = await captureStdout(() =>
      runCli(["totally-unknown"])
    );
    assertEquals(stdout, "");
    assertEquals(
      stderr,
      'Error: devflow: unknown command "totally-unknown"',
    );
    assertEquals(stderr.includes("USAGE"), false);
    assertEquals(stderr.includes("Usage:"), false);
    assertEquals(exitCode !== 0, true);
  } finally {
    Deno.env.delete("NO_COLOR");
  }
});

Deno.test("runCli with unknown object:verb shows error without USAGE (NO_COLOR)", async () => {
  Deno.env.set("NO_COLOR", "1");
  try {
    const { stdout, stderr, exitCode } = await captureStdout(() =>
      runCli(["board", "frob"])
    );
    assertEquals(stdout, "");
    assertEquals(stderr, 'Error: devflow: unknown command "board frob"');
    assertEquals(stderr.includes("USAGE"), false);
    assertEquals(stderr.includes("Usage:"), false);
    assertEquals(exitCode !== 0, true);
  } finally {
    Deno.env.delete("NO_COLOR");
  }
});

Deno.test("runCli with missing board name shows error without USAGE (NO_COLOR)", async () => {
  Deno.env.set("NO_COLOR", "1");
  try {
    const { stdout, stderr, exitCode } = await captureStdout(() =>
      runCli(["board", "init"])
    );
    assertEquals(stdout, "");
    assertEquals(
      stderr,
      "Error: devflow board init: board name required",
    );
    assertEquals(stderr.includes("USAGE"), false);
    assertEquals(stderr.includes("Usage:"), false);
    assertEquals(exitCode !== 0, true);
  } finally {
    Deno.env.delete("NO_COLOR");
  }
});

Deno.test("runCli with missing card id shows error without USAGE (NO_COLOR)", async () => {
  Deno.env.set("NO_COLOR", "1");
  try {
    const { stdout, stderr, exitCode } = await captureStdout(() =>
      runCli(["card", "show"])
    );
    assertEquals(stdout, "");
    assertEquals(stderr, "Error: devflow card show: card id required");
    assertEquals(stderr.includes("USAGE"), false);
    assertEquals(stderr.includes("Usage:"), false);
    assertEquals(exitCode !== 0, true);
  } finally {
    Deno.env.delete("NO_COLOR");
  }
});

Deno.test("runCli with conflicting flags shows error without USAGE (NO_COLOR)", async () => {
  Deno.env.set("NO_COLOR", "1");
  try {
    const { stdout, stderr, exitCode } = await captureStdout(() =>
      runCli(["--verbose", "--summary", "validate"])
    );
    assertEquals(stdout, "");
    assertEquals(
      stderr,
      "Error: devflow: --verbose and --summary are mutually exclusive",
    );
    assertEquals(stderr.includes("USAGE"), false);
    assertEquals(stderr.includes("Usage:"), false);
    assertEquals(exitCode !== 0, true);
  } finally {
    Deno.env.delete("NO_COLOR");
  }
});

Deno.test("runCli with unknown command shows ANSI when colours enabled", async () => {
  // This test only checks structure when stderr is a TTY; in test env it's not,
  // so we just verify the plain text version is correct
  if (Deno.stderr.isTerminal()) {
    const { stdout, stderr, exitCode } = await captureStdout(() =>
      runCli(["totally-unknown"])
    );
    assertEquals(stdout, "");
    // Should contain ANSI escape codes for Error label in red
    assertEquals(stderr.includes("\x1b[31mError:\x1b[0m"), true);
    assertEquals(stderr.includes("devflow:"), true);
    assertEquals(stderr.includes('unknown command "totally-unknown"'), true);
    assertEquals(exitCode !== 0, true);
  } else {
    // In non-TTY (test environment), should be plain text
    const { stderr } = await captureStdout(() => runCli(["totally-unknown"]));
    assertEquals(
      stderr,
      'Error: devflow: unknown command "totally-unknown"',
    );
  }
});

Deno.test("runCli with --skip and --force shows error (NO_COLOR)", async () => {
  Deno.env.set("NO_COLOR", "1");
  try {
    const { stdout, stderr, exitCode } = await captureStdout(() =>
      runCli([
        "card",
        "advance",
        "test-000001",
        "building",
        "--skip",
        "planning-003",
        "--force",
      ])
    );
    assertEquals(stdout, "");
    // Format is "Error: command: subject: detail" (no extra colon)
    assertEquals(
      stderr,
      "Error: card advance: test-000001: --skip and --force cannot be combined",
    );
    assertEquals(exitCode, 1);
  } finally {
    Deno.env.delete("NO_COLOR");
  }
});
