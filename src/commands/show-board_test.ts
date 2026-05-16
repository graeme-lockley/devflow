import { assertEquals } from "@std/assert";
import { initBoard } from "./init-board.ts";
import { createCard } from "./create-card.ts";
import {
  type BoardCardSummary,
  formatBoardCards,
  formatBoardShow,
  showBoard,
} from "./show-board.ts";
import { createBoardConfig } from "../domain/board.ts";
import { runCli } from "../cli/dispatch.ts";
import { withTempGitRepo } from "../../test/helpers/git-repo.ts";

const ANSI_RE = new RegExp(String.fromCharCode(27) + "\\[");

Deno.test("formatBoardShow stable output (colour off)", () => {
  const config = createBoardConfig("stories", ["todo", "done"], {
    now: new Date("2026-05-16T07:00:00.000Z"),
    sequenceWidth: 4,
  });
  const out = formatBoardShow(config, false);
  assertEquals(ANSI_RE.test(out), false);
  assertEquals(out.includes("name: stories"), true);
  assertEquals(out.includes("phases: todo, done"), true);
  assertEquals(out.includes("sequenceWidth: 4"), true);
});

Deno.test("formatBoardShow wraps labels in grey when colour on", () => {
  const config = createBoardConfig("stories", ["todo", "done"], {
    now: new Date("2026-05-16T07:00:00.000Z"),
    sequenceWidth: 4,
  });
  const out = formatBoardShow(config, true);
  assertEquals(out.includes("\x1b[90mname:\x1b[0m stories"), true);
  // value itself stays default (no ANSI before the value)
  assertEquals(out.includes("\x1b[90mphases:\x1b[0m todo, done"), true);
});

Deno.test("formatBoardCards: empty board prints (0) header only", () => {
  const out = formatBoardCards([], false);
  assertEquals(out, "Cards (0):\n");
});

Deno.test("formatBoardCards: aligned, sorted rows (colour off)", () => {
  const cards: BoardCardSummary[] = [
    { id: "stories-000002", title: "Second", phase: "planning" },
    { id: "stories-000001", title: "First", phase: "preparing" },
  ];
  const out = formatBoardCards(cards, false);
  const lines = out.trimEnd().split("\n");
  assertEquals(lines[0], "Cards (2):");
  assertEquals(lines[1], "  stories-000001  preparing  First");
  assertEquals(lines[2], "  stories-000002  planning   Second");
  assertEquals(ANSI_RE.test(out), false);
});

Deno.test("formatBoardCards header is grey when colour on", () => {
  const out = formatBoardCards([], true);
  assertEquals(out.startsWith("\x1b[90mCards\x1b[0m (0):"), true);
});

Deno.test("showBoard concatenates metadata and card list", async () => {
  await withTempGitRepo(async (dir) => {
    await initBoard("stories", ["todo", "done"], dir);
    await createCard("stories", "First", dir);
    await createCard("stories", "Second", dir);
    const out = await showBoard("stories", dir, false);
    assertEquals(out.includes("name: stories"), true);
    assertEquals(out.includes("Cards (2):"), true);
    assertEquals(out.includes("stories-000001"), true);
    assertEquals(out.includes("First"), true);
    assertEquals(out.includes("stories-000002"), true);
    assertEquals(ANSI_RE.test(out), false);
  });
});

Deno.test("showBoard empty board still shows Cards (0):", async () => {
  await withTempGitRepo(async (dir) => {
    await initBoard("stories", ["todo", "done"], dir);
    const out = await showBoard("stories", dir, false);
    assertEquals(out.includes("Cards (0):"), true);
  });
});

Deno.test("board show invalid board: plain stderr line when not a TTY", async () => {
  if (Deno.stderr.isTerminal()) return;
  await withTempGitRepo(async (dir) => {
    const chunks: string[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => {
      chunks.push(args.map(String).join(" "));
    };
    const cwd = Deno.cwd();
    try {
      Deno.chdir(dir);
      const code = await runCli(["board", "show", "storie"]);
      assertEquals(code, 1);
      const line = chunks.join("\n");
      assertEquals(ANSI_RE.test(line), false);
      assertEquals(
        line,
        'Error: board show: storie: board "storie" not found at .devflow/boards/storie/board.json',
      );
    } finally {
      console.error = original;
      Deno.chdir(cwd);
    }
  });
});

Deno.test("board show invalid board: emphasised path and name with TTY on", async () => {
  await withTempGitRepo(async (dir) => {
    const chunks: string[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => {
      chunks.push(args.map(String).join(" "));
    };
    const originalIsTerm = Deno.stderr.isTerminal.bind(Deno.stderr);
    (Deno.stderr as unknown as { isTerminal: () => boolean }).isTerminal = () =>
      true;
    const cwd = Deno.cwd();
    try {
      Deno.chdir(dir);
      const code = await runCli(["board", "show", "storie"]);
      assertEquals(code, 1);
      const line = chunks.join("\n");
      // red Error: label
      assertEquals(line.includes("\x1b[31mError:\x1b[0m"), true);
      // grey command + subject prefixes
      assertEquals(line.includes("\x1b[90mboard show:\x1b[0m"), true);
      assertEquals(line.includes("\x1b[90mstorie:\x1b[0m"), true);
      // bold sequences wrap name and path
      assertEquals(line.includes('"\x1b[1mstorie\x1b[0m"'), true);
      assertEquals(
        line.includes("\x1b[1m.devflow/boards/storie/board.json\x1b[0m"),
        true,
      );
    } finally {
      (Deno.stderr as unknown as { isTerminal: () => boolean }).isTerminal =
        originalIsTerm;
      console.error = original;
      Deno.chdir(cwd);
    }
  });
});
