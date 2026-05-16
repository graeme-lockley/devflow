const IDENTIFIER_PATTERN = /^[a-z][a-z0-9_]*$/;

const RESERVED_PHASE_NAMES = new Set(["blocked"]);

/** Validates a board or phase name per spec §5.2. */
export function validateIdentifier(
  name: string,
  kind: "board" | "phase",
): string | null {
  const label = kind === "board" ? "board" : "phase";

  if (name.length === 0) {
    return `${label} name must not be empty`;
  }

  if (!IDENTIFIER_PATTERN.test(name)) {
    return `invalid ${label} name "${name}": must match ^[a-z][a-z0-9_]*$`;
  }

  if (kind === "phase" && RESERVED_PHASE_NAMES.has(name)) {
    return `phase name "${name}" is reserved`;
  }

  return null;
}
