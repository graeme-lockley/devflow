import { runCli } from "./src/cli.ts";

if (import.meta.main) {
  const status = await runCli(Deno.args);
  Deno.exit(status);
}
