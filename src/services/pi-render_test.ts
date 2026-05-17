import { assertEquals } from "@std/assert";

Deno.test("pi-render.sh bash tests pass", async () => {
  const testScript = "./templates/stories/scripts/lib/pi-render_test.sh";

  const cmd = new Deno.Command(testScript, {
    stdout: "piped",
    stderr: "piped",
  });

  const { code, stdout, stderr } = await cmd.output();

  const stdoutText = new TextDecoder().decode(stdout);
  const stderrText = new TextDecoder().decode(stderr);

  // Log output for debugging
  if (code !== 0) {
    console.log("STDOUT:", stdoutText);
    console.error("STDERR:", stderrText);
  }

  assertEquals(code, 0, "pi-render_test.sh should exit 0");
});
