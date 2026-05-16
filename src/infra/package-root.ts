const PACKAGE_ROOT = new URL("../../", import.meta.url);

/** Repository root where built-in templates/ live. */
export function devflowPackageRoot(): string {
  return decodeURIComponent(PACKAGE_ROOT.pathname);
}
