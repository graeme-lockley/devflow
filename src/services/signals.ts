/** Signal handling per req §14.5 and ADR-0010. Interrupt history via transition.ts. */

const CHILD_WAIT_MS = 5000;

let registered = false;
let activeChild: Deno.ChildProcess | null = null;
let handlingSignal = false;
const signalListeners: Array<{ signal: Deno.Signal; handler: () => void }> = [];

type InterruptHandler = (signal: Deno.Signal) => Promise<void>;

let interruptHandler: InterruptHandler | null = null;

export function setInterruptHandler(handler: InterruptHandler): void {
  interruptHandler = handler;
}

export function setActiveChild(child: Deno.ChildProcess | null): void {
  activeChild = child;
}

async function waitForChildExit(
  child: Deno.ChildProcess,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const status = await child.status;
      return status.success !== undefined || status.code !== null;
    } catch {
      // Child still running
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
}

async function terminateChild(signal: Deno.Signal): Promise<void> {
  const child = activeChild;
  if (!child) return;

  try {
    child.kill(signal);
  } catch {
    // Process may already have exited
  }

  const exited = await waitForChildExit(child, CHILD_WAIT_MS);
  if (!exited) {
    try {
      child.kill("SIGKILL");
    } catch {
      // ignore
    }
    await waitForChildExit(child, 1000);
  }
  activeChild = null;
}

function exitCodeForSignal(signal: Deno.Signal): number {
  switch (signal) {
    case "SIGINT":
      return 130;
    case "SIGTERM":
      return 143;
    default:
      return 1;
  }
}

async function handleSignal(signal: Deno.Signal): Promise<void> {
  if (handlingSignal) return;
  handlingSignal = true;

  await terminateChild(signal);

  if (interruptHandler) {
    await interruptHandler(signal);
  }

  Deno.exit(exitCodeForSignal(signal));
}

export function registerSignalHandlersOnce(): void {
  if (registered) return;
  registered = true;

  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
    const handler = () => {
      handleSignal(signal);
    };
    try {
      Deno.addSignalListener(signal, handler);
      signalListeners.push({ signal, handler });
    } catch {
      // Signals may be unavailable in some test environments
    }
  }
}

/** Clears OS signal listeners (for tests). */
export function unregisterSignalHandlers(): void {
  for (const { signal, handler } of signalListeners) {
    try {
      Deno.removeSignalListener(signal, handler);
    } catch {
      // ignore
    }
  }
  signalListeners.length = 0;
  registered = false;
  handlingSignal = false;
  activeChild = null;
}

/** Test hook: run interrupt cleanup without exiting. */
export async function runInterruptCleanupForTest(
  signal: Deno.Signal,
): Promise<void> {
  await terminateChild(signal);
  if (interruptHandler) {
    await interruptHandler(signal);
  }
}
