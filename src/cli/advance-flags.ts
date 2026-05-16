export interface ParsedAdvanceArgs {
  cardId: string;
  targetPhase: string;
  force: boolean;
  skip: string[];
}

/**
 * Shape validation regex for skip tokens:
 * - Accepts <phase>-<sequence> e.g. "planning-003"
 * - Accepts full <phase>-<sequence>-<action-name> e.g. "planning-003-do-planning"
 * - Phase: lowercase letter followed by lowercase letters or digits
 * - Sequence: exactly 3 digits
 * - Action name (optional): lowercase letter or digit followed by lowercase letters, digits, or hyphens
 */
const SKIP_TOKEN_SHAPE = /^[a-z][a-z0-9]*-[0-9]{3}(-[a-z0-9][a-z0-9-]*)?$/;

/**
 * Normalizes a skip token to <phase>-<sequence> format.
 * Accepts both "planning-003" and "planning-003-do-planning", returns "planning-003".
 */
function normalizeSkipToken(token: string): string {
  const match = token.match(/^([a-z][a-z0-9]*-[0-9]{3})/);
  return match ? match[1] : token;
}

export function parseAdvanceArgs(positional: string[]): ParsedAdvanceArgs {
  let force = false;
  const skipTokens: string[] = [];
  const args: string[] = [];

  for (let i = 0; i < positional.length; i++) {
    const arg = positional[i];

    if (arg === "--force") {
      force = true;
    } else if (arg === "--skip") {
      // Next arg is the value
      if (i + 1 >= positional.length) {
        throw new Error("--skip requires a value");
      }
      i++;
      skipTokens.push(positional[i]);
    } else if (arg.startsWith("--skip=")) {
      // --skip=value form
      const value = arg.slice(7);
      if (!value) {
        throw new Error("--skip requires a value");
      }
      skipTokens.push(value);
    } else {
      args.push(arg);
    }
  }

  // Parse comma-separated skip values and validate shape
  const skip: string[] = [];
  const seen = new Set<string>();

  for (const token of skipTokens) {
    const parts = token.split(",").map((s) => s.trim()).filter((s) => s);
    for (const part of parts) {
      if (!SKIP_TOKEN_SHAPE.test(part)) {
        throw new Error(
          `invalid --skip token "${part}": must match <phase>-<sequence> or <phase>-<sequence>-<action-name> (e.g. "planning-003" or "planning-003-do-planning")`,
        );
      }
      const normalized = normalizeSkipToken(part);
      if (!seen.has(normalized)) {
        seen.add(normalized);
        skip.push(normalized);
      }
    }
  }

  const [cardId = "", targetPhase = ""] = args;
  return { cardId, targetPhase, force, skip };
}
