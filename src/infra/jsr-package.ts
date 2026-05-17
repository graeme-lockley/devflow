/** Parsed JSR package coordinate from a module URL (e.g. jsr.io/@kestrel/devflow/0.1.0/...). */
export interface JsrPackageRef {
  scope: string;
  name: string;
  version: string;
}

export function parseJsrPackageRef(moduleUrl: string): JsrPackageRef | null {
  const m = moduleUrl.match(
    /jsr\.io\/@([^/]+)\/([^/]+)\/(\d+\.\d+\.\d+)/,
  );
  if (!m) return null;
  return { scope: m[1], name: m[2], version: m[3] };
}

/** On-disk cache for JSR-published template trees (not shipped with module downloads). */
export function jsrTemplateCacheRoot(ref: JsrPackageRef): string {
  const denoDir = Deno.env.get("DENO_DIR") ??
    `${Deno.env.get("HOME") ?? ""}/.cache/deno`;
  return `${denoDir}/devflow/jsr/@${ref.scope}/${ref.name}/${ref.version}`;
}

export function jsrRegistryBase(ref: JsrPackageRef): string {
  return `https://jsr.io/@${ref.scope}/${ref.name}/${ref.version}`;
}
