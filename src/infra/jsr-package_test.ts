import { assertEquals } from "@std/assert";
import {
  jsrRegistryBase,
  jsrTemplateCacheRoot,
  parseJsrPackageRef,
} from "./jsr-package.ts";

Deno.test("parseJsrPackageRef extracts scope, name, and version", () => {
  const ref = parseJsrPackageRef(
    "https://jsr.io/@kestrel/devflow/0.1.0/src/services/templates.ts",
  );
  assertEquals(ref, {
    scope: "kestrel",
    name: "devflow",
    version: "0.1.0",
  });
});

Deno.test("parseJsrPackageRef returns null for local file URLs", () => {
  assertEquals(
    parseJsrPackageRef("file:///Users/me/devflow/src/infra/package-root.ts"),
    null,
  );
});

Deno.test("jsrRegistryBase and cache root use package ref", () => {
  const ref = { scope: "kestrel", name: "devflow", version: "0.1.1" };
  assertEquals(
    jsrRegistryBase(ref),
    "https://jsr.io/@kestrel/devflow/0.1.1",
  );
  assertEquals(
    jsrTemplateCacheRoot(ref).endsWith(
      "/devflow/jsr/@kestrel/devflow/0.1.1",
    ),
    true,
  );
});
