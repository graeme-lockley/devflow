export interface ParsedCommand {
  object: string;
  verb: string;
  positional: string[];
}

const SYNONYMS: Record<string, { object: string; verb: string }> = {
  "init-board": { object: "board", verb: "init" },
};

/**
 * Normalizes argv (after global flags removed) to object + verb + positional args.
 */
export function parseCommand(args: string[]): ParsedCommand | null {
  if (args.length === 0) return null;

  const [first, second, ...rest] = args;

  const synonym = SYNONYMS[first];
  if (synonym) {
    return {
      object: synonym.object,
      verb: synonym.verb,
      positional: second !== undefined ? [second, ...rest] : rest,
    };
  }

  if (second === undefined) {
    return null;
  }

  return {
    object: first,
    verb: second,
    positional: rest,
  };
}
