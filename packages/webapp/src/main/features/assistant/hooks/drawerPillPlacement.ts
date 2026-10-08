/**
 * Where the drawer's "Describe your app" pill sits on the canvas's bottom row:
 * centred, but kept clear of the canvas controls bar on its left and the
 * assistant's round button on its right, and narrowed (its label truncates)
 * when the space between them is smaller than the pill. Measured, because the
 * label's width varies by language and the free space by window size and the
 * properties panel.
 */

type Span = { left: number; right: number };
type Box = Span & { top: number; bottom: number };

/** Space kept between the pill and what it must not cover. */
const GAP = 12;

export interface PillPlacementInput {
  /** The row the pill is laid out in (client coordinates). */
  row: Box;
  /** The pill's natural (unclamped) width. */
  pillWidth: number;
  /** Right edge of the canvas controls bar, or null when there is none. */
  controlsRight: number | null;
  /** The assistant button, or null when it is not shown. */
  obstacle: Box | null;
}

/** The pill's offset from the row's left edge and its maximum width. */
export function placeDrawerPill({ row, pillWidth, controlsRight, obstacle }: PillPlacementInput): {
  left: number;
  maxWidth: number;
} {
  const lo = Math.max(row.left, controlsRight ?? row.left) + GAP;
  let hi = row.right - GAP;
  const sameRow = obstacle && obstacle.top < row.bottom && obstacle.bottom > row.top;
  if (sameRow && obstacle.right > lo && obstacle.left < hi) hi = Math.min(hi, obstacle.left - GAP);
  const maxWidth = Math.max(0, Math.min(pillWidth, hi - lo));
  const centred = (row.left + row.right - maxWidth) / 2;
  return { left: Math.max(lo, Math.min(centred, hi - maxWidth)) - row.left, maxWidth };
}
