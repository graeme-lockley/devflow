export interface CardListArgs {
  boardName: string;
  phase?: string;
}

export function parseCardListArgs(args: string[]): CardListArgs {
  let boardName = "";
  let phase: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--phase") {
      const value = args[i + 1];
      if (!value) {
        throw new Error("devflow card list: --phase requires a value");
      }
      phase = value;
      i++;
    } else if (!boardName) {
      boardName = arg;
    } else {
      throw new Error(`devflow card list: unexpected argument "${arg}"`);
    }
  }

  if (!boardName) {
    throw new Error("devflow card list: board name required");
  }

  return { boardName, phase };
}
