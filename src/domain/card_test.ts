import { assertEquals } from "@std/assert";
import { formatCardId, parseCardId, resolveBoardFromCardId } from "./card.ts";
import { isSequenceExhausted, maxSequenceForWidth } from "./validate-board.ts";

Deno.test("formatCardId zero-pads per sequenceWidth (req §5.3)", () => {
  assertEquals(formatCardId("stories", 1, 6), "stories-000001");
  assertEquals(formatCardId("stories", 42, 6), "stories-000042");
  assertEquals(formatCardId("stories", 1, 4), "stories-0001");
});

Deno.test("parseCardId round-trips formatted IDs (req §6.1)", () => {
  const id = formatCardId("stories", 42, 6);
  const parsed = parseCardId(id, "stories");
  assertEquals(parsed, { idPrefix: "stories", sequence: 42, suffix: "000042" });
});

Deno.test("parseCardId rejects wrong prefix or non-numeric suffix", () => {
  assertEquals(parseCardId("other-000001", "stories"), null);
  assertEquals(parseCardId("stories-abc", "stories"), null);
  assertEquals(parseCardId("stories", "stories"), null);
});

Deno.test("resolveBoardFromCardId matches idPrefix (req §6.1)", () => {
  const boards = [
    { name: "stories", idPrefix: "stories" },
    { name: "bugs", idPrefix: "bugs" },
  ];
  assertEquals(resolveBoardFromCardId("stories-000001", boards), "stories");
  assertEquals(resolveBoardFromCardId("bugs-0001", boards), "bugs");
  assertEquals(resolveBoardFromCardId("unknown-000001", boards), null);
});

Deno.test("sequence exhaustion boundary (req §5.7)", () => {
  assertEquals(maxSequenceForWidth(6), 999999);
  assertEquals(isSequenceExhausted(999999, 6), false);
  assertEquals(isSequenceExhausted(1000000, 6), true);
});
