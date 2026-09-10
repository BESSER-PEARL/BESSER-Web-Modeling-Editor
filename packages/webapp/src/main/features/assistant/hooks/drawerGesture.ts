/**
 * Pure decision helpers for the assistant drawer's handle gesture.
 *
 * Extracted from AssistantWorkspaceDrawer so the click-vs-drag and
 * direction-snap logic can be unit-tested without a DOM or pointer events.
 */

/**
 * Movement (px) below which a handle press-release counts as a click (which
 * toggles the drawer) rather than a drag. Past it the gesture locks a direction
 * and snaps that way, so the user never has to drag the full distance. It also
 * guards an accidental scroll/jitter on the handle from reading as a drag.
 */
export const DRAG_DIRECTION_THRESHOLD = 8;

/**
 * Lock the snap direction from the running drag distance, taken from the start
 * of the gesture. Returns the committed direction (+1 = dragged down → open,
 * -1 = dragged up → close) once |distance| first crosses the threshold. Once a
 * non-zero direction is locked it sticks (so a flick that settles back still
 * snaps by its initial intent); 0 means "still a click".
 *
 * @param dragDistance signed px from the gesture's start (positive = downward)
 * @param current      the direction locked so far (0 until the threshold hits)
 * @param threshold    px that must be crossed to count as a directional drag
 */
export function lockDragDirection(
  dragDistance: number,
  current: number,
  threshold: number = DRAG_DIRECTION_THRESHOLD,
): number {
  if (current !== 0) return current;
  if (Math.abs(dragDistance) < threshold) return 0;
  return dragDistance > 0 ? 1 : -1;
}

/**
 * Resolve whether the drawer should end up open when a gesture finishes.
 * A locked direction of 0 means the gesture was a click, so it toggles the
 * current state; otherwise downward (+1) opens and upward (-1) closes,
 * regardless of how far the user actually dragged.
 */
export function resolveDrawerSnap(direction: number, currentlyOpen: boolean): boolean {
  if (direction === 0) return !currentlyOpen;
  return direction > 0;
}
