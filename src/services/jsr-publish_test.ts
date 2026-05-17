import { assertEquals } from "@std/assert";

Deno.test("deno publish --dry-run includes templates", async () => {
  const cmd = new Deno.Command("deno", {
    args: ["publish", "--dry-run", "--allow-dirty"],
    stdout: "piped",
    stderr: "piped",
  });

  const { stdout, stderr } = await cmd.output();
  const output = new TextDecoder().decode(stdout) +
    new TextDecoder().decode(stderr);

  // Assert key template files are in the publish list
  assertEquals(
    output.includes("templates/stories/assets/story.template.md"),
    true,
  );
  assertEquals(
    output.includes("templates/stories/scripts/preparing-002-do-create-story"),
    true,
  );
  assertEquals(
    output.includes("templates/stories/scripts/finishing-005-check-tests"),
    true,
  );
});
