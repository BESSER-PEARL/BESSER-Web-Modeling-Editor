/**
 * Where the drawer's "Describe your app" pill sits on the canvas's bottom row:
 * centred, but kept clear of the assistant's round button on its right, and
 * narrowed (its label truncates) when the space left is smaller than the pill.
 * Measured, because the label's width varies by language and the free space by
 * window size and the properties panel.
 */

type Span = { left: number; right: number };
type Box = Span & { top: number; bottom: number };

/** Space kept between the pill and what it must not cover. */
const GAP = 12;

export interface PillPlacementInput {
  /** The row the pill is laid out in (client coordinates). */
  row: Box;
  /** The pill's natural (unclamped) width. Its natural height is the row's. */
  pillWidth: number;
  /** The assistant button, or null when it is not shown. */
  obstacle: Box | null;
}

export interface PillPlacement {
  /** Offset from the row's left edge. */
  left: number;
  maxWidth: number;
}

export function placeDrawerPill({ row, pillWidth, obstacle }: PillPlacementInput): PillPlacement {
  const lo = row.left + GAP;
  let hi = row.right - GAP;
  const sameRow = obstacle && obstacle.top < row.bottom && obstacle.bottom > row.top;
  if (sameRow && obstacle.right > lo && obstacle.left < hi) hi = Math.min(hi, obstacle.left - GAP);
  const maxWidth = Math.max(0, Math.min(pillWidth, hi - lo));
  const centred = (row.left + row.right - maxWidth) / 2;
  return { left: Math.max(lo, Math.min(centred, hi - maxWidth)) - row.left, maxWidth };
}
