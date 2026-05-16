export interface ParsedAdvanceArgs {
  cardId: string;
  targetPhase: string;
  force: boolean;
}

export function parseAdvanceArgs(positional: string[]): ParsedAdvanceArgs {
  let force = false;
  const args: string[] = [];

  for (const arg of positional) {
    if (arg === "--force") {
      force = true;
    } else {
      args.push(arg);
    }
  }

  const [cardId = "", targetPhase = ""] = args;
  return { cardId, targetPhase, force };
}
