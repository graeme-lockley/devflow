export function parseLockForceArgs(args: string[]): {
  target: string;
  force: boolean;
} {
  let target = "";
  let force = false;

  for (const arg of args) {
    if (arg === "--force") {
      force = true;
    } else if (!target) {
      target = arg;
    } else {
      throw new Error(`unexpected argument "${arg}"`);
    }
  }

  return { target, force };
}

export function parseLockForceArgsOptionalTarget(args: string[]): {
  target: string | undefined;
  force: boolean;
} {
  let target: string | undefined;
  let force = false;

  for (const arg of args) {
    if (arg === "--force") {
      force = true;
    } else if (target === undefined) {
      target = arg;
    } else {
      throw new Error(`unexpected argument "${arg}"`);
    }
  }

  return { target, force };
}
