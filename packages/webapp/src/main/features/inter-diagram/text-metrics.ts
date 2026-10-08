/**
 * Text-width estimates for the derivations. They run without a DOM, so they
 * cannot call the editor's `Text.size` (which measures with `getBBox` on the
 * live canvas). The editor's default font is 16 px; a bold glyph averages
 * about 9 px, so 10 px per character is a deliberate over-estimate: a box sized
 * with it always fits the name, and the editor's own auto-width (which takes
 * the larger of the stored and the measured width) keeps it.
 */
const BOLD_CHAR_PX = 10;
const REGULAR_CHAR_PX = 9;

export function estimateTextWidth(text: string, opts: { bold?: boolean; scale?: number } = {}): number {
  const perChar = opts.bold === false ? REGULAR_CHAR_PX : BOLD_CHAR_PX;
  return Math.ceil((text ?? '').length * perChar * (opts.scale ?? 1));
}

/** Round up to the editor's 10 px layout grid. */
export const ceilToGrid = (value: number, grid = 10): number => Math.ceil(value / grid) * grid;
