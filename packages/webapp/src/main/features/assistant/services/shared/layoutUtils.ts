/**
 * Default layout grid constants shared between converters and services.
 * Single source of truth -- do not duplicate these values elsewhere.
 */

/** Number of columns in the layout grid. */
export const LAYOUT_COLUMNS = 3;

/** Horizontal distance between column origins. */
export const LAYOUT_H_GAP = 360;

/** Vertical distance between row origins. */
export const LAYOUT_V_GAP = 280;

/** Default X-origin for the layout grid. */
export const LAYOUT_START_X = -940;

/** Default Y-origin for the layout grid. */
export const LAYOUT_START_Y = -600;

/** Calculate grid position for element at the given index. */
export function calculateGridPosition(index: number): { x: number; y: number } {
  const col = index % LAYOUT_COLUMNS;
  const row = Math.floor(index / LAYOUT_COLUMNS);
  return {
    x: LAYOUT_START_X + col * LAYOUT_H_GAP,
    y: LAYOUT_START_Y + row * LAYOUT_V_GAP,
  };
}
