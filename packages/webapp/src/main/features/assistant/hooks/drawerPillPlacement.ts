/**
 * Where the drawer's "Describe your app" pill sits on the canvas's bottom row:
 * centred, but kept clear of the canvas controls bar on its left and the
 * assistant's round button on its right, and narrowed (its label truncates)
 * when the space between them is smaller than the pill. When even a narrowed
 * pill does not fit beside the controls bar (phones), it moves up a row, above
 * the bar. Measured, because the label's width varies by language and the free
 * space by window size and the properties panel.
 */

type Span = { left: number; right: number };
type Box = Span & { top: number; bottom: number };

/** Space kept between the pill and what it must not cover. */
const GAP = 12;
/** Narrowest useful pill: its icon and a few characters of the label. */
const MIN_WIDTH = 96;

export interface PillPlacementInput {
  /** The row the pill is laid out in (client coordinates). */
  row: Box;
  /** The pill's natural (unclamped) width. Its natural height is the row's. */
  pillWidth: number;
  /** Right edge of the canvas controls bar, or null when there is none. */
  controlsRight: number | null;
  /** The assistant button, or null when it is not shown. */
  obstacle: Box | null;
}

export interface PillPlacement {
  /** Offset from the row's left edge. */
  left: number;
  maxWidth: number;
  /** How far the pill is raised above its row (0 when it stays on it). */
  lift: number;
}

export function placeDrawerPill({ row, pillWidth, controlsRight, obstacle }: PillPlacementInput): PillPlacement {
  const beside = fit(row, Math.max(row.left, controlsRight ?? row.left) + GAP, pillWidth, obstacle);
  if (controlsRight === null || beside.maxWidth >= Math.min(pillWidth, MIN_WIDTH)) return { ...beside, lift: 0 };
  const lift = row.bottom - row.top + GAP;
  const raised = { ...row, top: row.top - lift, bottom: row.bottom - lift };
  return { ...fit(raised, row.left + GAP, pillWidth, obstacle), lift };
}

function fit(row: Box, lo: number, pillWidth: number, obstacle: Box | null): { left: number; maxWidth: number } {
  let hi = row.right - GAP;
  const sameRow = obstacle && obstacle.top < row.bottom && obstacle.bottom > row.top;
  if (sameRow && obstacle.right > lo && obstacle.left < hi) hi = Math.min(hi, obstacle.left - GAP);
  const maxWidth = Math.max(0, Math.min(pillWidth, hi - lo));
  const centred = (row.left + row.right - maxWidth) / 2;
  return { left: Math.max(lo, Math.min(centred, hi - maxWidth)) - row.left, maxWidth };
}
