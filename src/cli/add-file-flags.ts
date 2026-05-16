export interface AddCardFileArgs {
  cardId: string;
  sourcePath: string;
  overwrite: boolean;
}

export function parseAddCardFileArgs(args: string[]): AddCardFileArgs {
  let cardId = "";
  let sourcePath = "";
  let overwrite = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--overwrite") {
      overwrite = true;
    } else if (!cardId) {
      cardId = arg;
    } else if (!sourcePath) {
      sourcePath = arg;
    } else {
      throw new Error(`devflow card add-file: unexpected argument "${arg}"`);
    }
  }

  if (!cardId || !sourcePath) {
    throw new Error("devflow card add-file: card id and source path required");
  }

  return { cardId, sourcePath, overwrite };
}
