export interface InitBoardOptions {
  sequenceWidth?: number;
  template?: string;
}

export interface ParsedInitArgs {
  phaseNames: string[];
  options: InitBoardOptions;
}

export function parseInitArgs(args: string[]): ParsedInitArgs {
  const phaseNames: string[] = [];
  const options: InitBoardOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--sequence-width") {
      const value = args[++i];
      if (value === undefined) {
        throw new Error("board init: --sequence-width requires a value");
      }
      const width = Number(value);
      if (!Number.isInteger(width)) {
        throw new Error(
          `board init: --sequence-width must be an integer, got "${value}"`,
        );
      }
      options.sequenceWidth = width;
      continue;
    }
    if (arg === "--template") {
      const value = args[++i];
      if (value === undefined) {
        throw new Error("board init: --template requires a value");
      }
      options.template = value;
      continue;
    }
    if (arg.startsWith("--")) {
      throw new Error(`board init: unknown flag ${arg}`);
    }
    phaseNames.push(arg);
  }

  return { phaseNames, options };
}

export function validateSequenceWidth(width: number): void {
  if (!Number.isInteger(width) || width < 1 || width > 12) {
    throw new Error("sequenceWidth must be an integer from 1 to 12");
  }
}
