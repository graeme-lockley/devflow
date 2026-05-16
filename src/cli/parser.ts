export interface ParsedCommand {
  object: string;
  verb: string;
  positional: string[];
}

const SYNONYMS: Record<string, { object: string; verb: string }> = {
  "init-board": { object: "board", verb: "init" },
  "list-boards": { object: "board", verb: "list" },
  "show-board": { object: "board", verb: "show" },
  "validate-board": { object: "board", verb: "validate" },
  "create-card": { object: "card", verb: "create" },
  "list-cards": { object: "card", verb: "list" },
  "show-card": { object: "card", verb: "show" },
  "card-dir": { object: "card", verb: "dir" },
  "rename-card": { object: "card", verb: "rename" },
  "add-card-file": { object: "card", verb: "add-file" },
  "validate-card": { object: "card", verb: "validate" },
  "block-card": { object: "card", verb: "block" },
  "unblock-card": { object: "card", verb: "unblock" },
  "get-variable": { object: "variable", verb: "get" },
  "set-variable": { object: "variable", verb: "set" },
  "release-lock": { object: "lock", verb: "release" },
  "release-board-lock": { object: "lock", verb: "release-board" },
  "release-repo-lock": { object: "lock", verb: "release-repo" },
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
