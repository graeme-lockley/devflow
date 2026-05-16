import type { BoardConfig } from "../domain/board.ts";
import { loadBoardConfig } from "../domain/board.ts";
import { loadCardState } from "../domain/card.ts";
import { listCards } from "./list-cards.ts";
import { colorsEnabledForStdout, grey } from "../services/console.ts";

export interface BoardCardSummary {
  id: string;
  title: string;
  phase: string;
}

/**
 * Format board metadata block. When `colour` is true, field labels are
 * rendered in grey and values default colour (req §16.2). When false,
 * output is plain text byte-identical to the historical format.
 */
export function formatBoardShow(
  config: BoardConfig,
  colour: boolean = colorsEnabledForStdout(),
): string {
  const fields: Array<[string, string]> = [
    ["name", config.name],
    ["idPrefix", config.idPrefix],
    ["phases", config.phases.join(", ")],
    ["blockedPhase", config.blockedPhase],
    ["nextSequence", String(config.nextSequence)],
    ["sequenceWidth", String(config.sequenceWidth)],
    ["createdAt", config.createdAt],
    ["updatedAt", config.updatedAt],
  ];
  const lines = fields.map(([k, v]) => `${grey(`${k}:`, colour)} ${v}`);
  return lines.join("\n") + "\n";
}

/**
 * Format the per-board card list as aligned columns:
 *   <card-id>  <phase>  <title>
 * Always emits a `Cards (N):` header; rows omitted when N=0.
 */
export function formatBoardCards(
  cards: BoardCardSummary[],
  colour: boolean = colorsEnabledForStdout(),
): string {
  const sorted = [...cards].sort((a, b) => a.id.localeCompare(b.id));
  const header = `${grey("Cards", colour)} (${sorted.length}):`;
  if (sorted.length === 0) return header + "\n";

  const idWidth = sorted.reduce((m, c) => Math.max(m, c.id.length), 0);
  const phaseWidth = sorted.reduce((m, c) => Math.max(m, c.phase.length), 0);
  const rows = sorted.map((c) =>
    `  ${c.id.padEnd(idWidth)}  ${c.phase.padEnd(phaseWidth)}  ${c.title}`
  );
  return [header, ...rows].join("\n") + "\n";
}

export async function showBoard(
  boardName: string,
  repoRoot: string,
  colour: boolean = colorsEnabledForStdout(),
): Promise<string> {
  const config = await loadBoardConfig(repoRoot, boardName);
  const ids = await listCards(boardName, repoRoot);
  const cards: BoardCardSummary[] = [];
  for (const id of ids) {
    try {
      const state = await loadCardState(repoRoot, boardName, id);
      cards.push({ id: state.id, title: state.title, phase: state.phase });
    } catch {
      // Skip cards with unreadable state — `board validate` is the
      // proper place to surface these problems.
    }
  }
  return formatBoardShow(config, colour) + "\n" +
    formatBoardCards(cards, colour);
}
