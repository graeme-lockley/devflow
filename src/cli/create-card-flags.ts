export interface ParsedCreateCardArgs {
  boardName: string;
  title: string;
  description?: string;
}

interface RawCreateCardArgs {
  boardName: string;
  title: string;
  description?: string;
  descriptionFile?: string;
}

function parseRaw(args: string[]): RawCreateCardArgs {
  let boardName = "";
  let title = "";
  let description: string | undefined;
  let descriptionFile: string | undefined;
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--description") {
      const value = args[i + 1];
      if (value === undefined) {
        throw new Error(
          "devflow card create: --description requires a value",
        );
      }
      if (description !== undefined) {
        throw new Error(
          "devflow card create: --description may only be specified once",
        );
      }
      description = value;
      i++;
    } else if (arg === "--description-file") {
      const value = args[i + 1];
      if (value === undefined) {
        throw new Error(
          "devflow card create: --description-file requires a path",
        );
      }
      if (descriptionFile !== undefined) {
        throw new Error(
          "devflow card create: --description-file may only be specified once",
        );
      }
      descriptionFile = value;
      i++;
    } else {
      positional.push(arg);
    }
  }

  if (description !== undefined && descriptionFile !== undefined) {
    throw new Error(
      "devflow card create: --description and --description-file are mutually exclusive",
    );
  }

  if (positional.length < 2) {
    throw new Error("devflow card create: board name and title required");
  }
  if (positional.length > 2) {
    throw new Error(
      `devflow card create: unexpected argument "${positional[2]}"`,
    );
  }
  boardName = positional[0];
  title = positional[1];

  return { boardName, title, description, descriptionFile };
}

/**
 * Parses `card create` CLI arguments.
 *
 * File I/O for `--description-file` happens here, deliberately **before**
 * the command acquires the board lock or increments `nextSequence`, so a
 * bad input can never burn a sequence value or leave a partial card
 * directory (see req §6.2 atomicity).
 */
export async function parseCreateCardArgs(
  args: string[],
): Promise<ParsedCreateCardArgs> {
  const raw = parseRaw(args);

  let description: string | undefined;
  if (raw.description !== undefined) {
    if (raw.description.replace(/\n+$/, "").length === 0) {
      throw new Error(
        "devflow card create: --description value is empty",
      );
    }
    description = raw.description;
  } else if (raw.descriptionFile !== undefined) {
    let contents: string;
    try {
      contents = await Deno.readTextFile(raw.descriptionFile);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      throw new Error(
        `devflow card create: cannot read --description-file ${raw.descriptionFile}: ${message}`,
      );
    }
    if (contents.replace(/\n+$/, "").length === 0) {
      throw new Error(
        `devflow card create: --description-file ${raw.descriptionFile} is empty`,
      );
    }
    description = contents;
  }

  return { boardName: raw.boardName, title: raw.title, description };
}
