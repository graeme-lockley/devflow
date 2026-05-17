import {
  jsrRegistryBase,
  jsrTemplateCacheRoot,
  parseJsrPackageRef,
} from "./jsr-package.ts";

interface VersionManifest {
  manifest: Record<string, { size: number; checksum: string }>;
}

const JSON_ACCEPT = "application/json";

function templateManifestPrefix(templateName: string): string {
  return `/templates/${templateName}/`;
}

async function isTemplateCacheComplete(cacheDir: string): Promise<boolean> {
  return (
    (await isDirectory(`${cacheDir}/scripts`)) &&
    (await isDirectory(`${cacheDir}/skills`))
  );
}

function shouldChmodScript(relativePath: string): boolean {
  if (!relativePath.startsWith("scripts/")) return false;
  const base = relativePath.split("/").pop() ?? "";
  if (base.endsWith(".md") || base.endsWith(".json") || base.endsWith(".txt")) {
    return false;
  }
  return true;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: JSON_ACCEPT } });
  if (!res.ok) {
    throw new Error(`JSR registry ${res.status}: ${url}`);
  }
  return (await res.json()) as T;
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { headers: { Accept: "*/*" } });
  if (!res.ok) {
    throw new Error(`JSR download ${res.status}: ${url}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * Downloads built-in templates from the JSR registry when they are not present
 * next to the package on disk (Deno only caches imported modules, not publish.include assets).
 */
export async function ensureJsrBuiltinTemplateDir(
  templateName: string,
  moduleUrl: string,
): Promise<string> {
  const pkg = parseJsrPackageRef(moduleUrl);
  if (!pkg) {
    throw new Error(
      `template "${templateName}" not found (not running from a JSR package URL)`,
    );
  }

  const cacheDir = `${jsrTemplateCacheRoot(pkg)}/templates/${templateName}`;
  if (
    await isDirectory(cacheDir) && await isTemplateCacheComplete(cacheDir)
  ) {
    return cacheDir;
  }
  if (await isDirectory(cacheDir)) {
    await Deno.remove(cacheDir, { recursive: true });
  }

  const metaUrl = `${jsrRegistryBase(pkg)}_meta.json`;
  let meta: VersionManifest;
  try {
    meta = await fetchJson<VersionManifest>(metaUrl);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `template "${templateName}" not found: could not load JSR manifest (${msg}). ` +
        `Run devflow with --allow-net=jsr.io`,
    );
  }

  const prefix = templateManifestPrefix(templateName);
  const paths = Object.keys(meta.manifest)
    .filter((p) => p.startsWith(prefix))
    .sort();

  if (paths.length === 0) {
    throw new Error(
      `template "${templateName}" not found on JSR @${pkg.scope}/${pkg.name}@${pkg.version}`,
    );
  }

  const base = jsrRegistryBase(pkg);
  for (const manifestPath of paths) {
    const relative = manifestPath.slice(prefix.length);
    const dest = `${cacheDir}/${relative}`;
    const parent = dest.substring(0, dest.lastIndexOf("/"));
    if (parent.length > 0) {
      await Deno.mkdir(parent, { recursive: true });
    }
    const bytes = await fetchBytes(`${base}${manifestPath}`);
    await Deno.writeFile(dest, bytes);
    if (shouldChmodScript(relative)) {
      await Deno.chmod(dest, 0o755);
    }
  }

  if (!(await isTemplateCacheComplete(cacheDir))) {
    await Deno.remove(cacheDir, { recursive: true });
    throw new Error(
      `template "${templateName}" download incomplete (missing scripts/ or skills/)`,
    );
  }

  return cacheDir;
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    const stat = await Deno.stat(path);
    return stat.isDirectory;
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return false;
    throw e;
  }
}
