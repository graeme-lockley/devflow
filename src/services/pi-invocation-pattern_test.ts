import { assertEquals } from "@std/assert";

const LIVE_BOARD = ".devflow/boards/stories/scripts";
const TEMPLATE = "templates/stories/scripts";

const PI_ENTRY_SCRIPTS = [
  "preparing-002-do-create-story",
  "planning-003-do-planning",
  "building/steps/01-pi.sh",
  "verifying-002-do-validate",
  "finishing-002-do-finish",
];

const COMMIT_MESSAGE_SCRIPTS = [
  "planning.commit-message",
  "verifying.commit-message",
  "finishing.commit-message",
];

async function fileExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

async function isExecutable(path: string): Promise<boolean> {
  try {
    const stat = await Deno.stat(path);
    // Check if owner-executable bit is set (mode & 0o100)
    return (stat.mode !== null) && ((stat.mode & 0o100) !== 0);
  } catch {
    return false;
  }
}

async function readScript(path: string): Promise<string> {
  return await Deno.readTextFile(path);
}

Deno.test("lint-fix.ts and building-loop-feedback.sh exist in both trees", async () => {
  for (const name of ["lib/lint-fix.ts", "lib/building-loop-feedback.sh"]) {
    assertEquals(await fileExists(`${LIVE_BOARD}/${name}`), true);
    assertEquals(await fileExists(`${TEMPLATE}/${name}`), true);
  }
});

Deno.test("pi-render.sh exists and is executable in both trees", async () => {
  const liveRenderer = `${LIVE_BOARD}/lib/pi-render.sh`;
  const templateRenderer = `${TEMPLATE}/lib/pi-render.sh`;

  assertEquals(
    await fileExists(liveRenderer),
    true,
    `${liveRenderer} should exist`,
  );
  assertEquals(
    await fileExists(templateRenderer),
    true,
    `${templateRenderer} should exist`,
  );

  assertEquals(
    await isExecutable(liveRenderer),
    true,
    `${liveRenderer} should be executable`,
  );
  assertEquals(
    await isExecutable(templateRenderer),
    true,
    `${templateRenderer} should be executable`,
  );
});

Deno.test("pi entry scripts use --mode json and pipe through pi-render.sh in both trees", async () => {
  for (const script of PI_ENTRY_SCRIPTS) {
    const livePath = `${LIVE_BOARD}/${script}`;
    const templatePath = `${TEMPLATE}/${script}`;

    // Check both exist
    assertEquals(await fileExists(livePath), true, `${livePath} should exist`);
    assertEquals(
      await fileExists(templatePath),
      true,
      `${templatePath} should exist`,
    );

    // Check content
    const liveContent = await readScript(livePath);
    const templateContent = await readScript(templatePath);

    // Assert --mode json is present
    assertEquals(
      liveContent.includes("--mode json"),
      true,
      `${livePath} should contain --mode json`,
    );
    assertEquals(
      templateContent.includes("--mode json"),
      true,
      `${templatePath} should contain --mode json`,
    );

    // Assert pipes through pi-render.sh
    assertEquals(
      liveContent.includes("pi-render.sh"),
      true,
      `${livePath} should pipe through pi-render.sh`,
    );
    assertEquals(
      templateContent.includes("pi-render.sh"),
      true,
      `${templatePath} should pipe through pi-render.sh`,
    );

    // Assert uses pipefail
    assertEquals(
      liveContent.includes("set -o pipefail"),
      true,
      `${livePath} should use pipefail`,
    );
    assertEquals(
      templateContent.includes("set -o pipefail"),
      true,
      `${templatePath} should use pipefail`,
    );
  }
});

Deno.test("commit-message scripts do NOT use --mode json", async () => {
  for (const script of COMMIT_MESSAGE_SCRIPTS) {
    const livePath = `${LIVE_BOARD}/${script}`;
    const templatePath = `${TEMPLATE}/${script}`;

    // Only test if the file exists (some might not)
    if (await fileExists(livePath)) {
      const content = await readScript(livePath);
      // If it invokes pi, it should NOT use --mode json
      if (content.includes("pi ") || content.includes("pi-mono")) {
        assertEquals(
          content.includes("--mode json"),
          false,
          `${livePath} (commit-message) should NOT use --mode json`,
        );
      }
    }

    if (await fileExists(templatePath)) {
      const content = await readScript(templatePath);
      // If it invokes pi, it should NOT use --mode json
      if (content.includes("pi ") || content.includes("pi-mono")) {
        assertEquals(
          content.includes("--mode json"),
          false,
          `${templatePath} (commit-message) should NOT use --mode json`,
        );
      }
    }
  }
});

Deno.test("pi-render.sh fixture exists in both trees", async () => {
  const liveFixture = `${LIVE_BOARD}/lib/fixtures/pi-events.ndjson`;
  const templateFixture = `${TEMPLATE}/lib/fixtures/pi-events.ndjson`;

  assertEquals(
    await fileExists(liveFixture),
    true,
    `${liveFixture} should exist`,
  );
  assertEquals(
    await fileExists(templateFixture),
    true,
    `${templateFixture} should exist`,
  );
});
