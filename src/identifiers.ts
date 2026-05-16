/** Validates a name used as a single path segment (board or column). */
export function validatePathSegment(
  name: string,
  kind: "board" | "column",
): string | null {
  const label = kind === "board" ? "board" : "column";

  if (name.length === 0) {
    return `${label} name must not be empty`;
  }
  if (name === "." || name === "..") {
    return `invalid ${label} name "${name}"`;
  }
  if (name.includes("/") || name.includes("\\")) {
    return `invalid ${label} name "${name}": must not contain / or \\`;
  }
  return null;
}
