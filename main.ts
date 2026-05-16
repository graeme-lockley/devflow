import { runCli } from "./src/cli/dispatch.ts";
import { registerSignalHandlersOnce } from "./src/services/signals.ts";

if (import.meta.main) {
  registerSignalHandlersOnce();
  const status = await runCli(Deno.args);
  Deno.exit(status);
}
