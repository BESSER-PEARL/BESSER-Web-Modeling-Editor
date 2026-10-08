/**
 * Pure decision helpers for the assistant drawer's drag gesture.
 *
 * Extracted from AssistantWorkspaceDrawer so the click / flick / position
 * snap logic can be unit-tested without a DOM or pointer events.
 */

/**
 * Movement (px) below which a press-release counts as a click (which toggles
 * the drawer) rather than a drag. Also absorbs jitter on the handle.
 */
export const DRAG_CLICK_THRESHOLD = 8;

/**
 * Release speed (px/ms) above which the drawer snaps in the direction of the
 * flick regardless of how far it travelled (Sonner/Vaul use ~0.11).
 */
export const FLICK_VELOCITY_THRESHOLD = 0.11;

/**
 * A finger that stopped before lifting carries no momentum: velocity measured
 * on the last move older than this (ms) is ignored at release.
 */
export const VELOCITY_STALE_MS = 100;

export interface DrawerReleaseInput {
  /** Largest |distance| (px) travelled from the press point. */
  moved: number;
  /** Velocity of the last move, px/ms, positive = toward open. */
  velocity: number;
  /** ms between the last pointermove and the release. */
  msSinceLastMove: number;
  /** Sheet offset at release (0 = fully open, closedOffset = fully closed). */
  offset: number;
  /** Offset of the fully-closed position (the full travel). */
  closedOffset: number;
  currentlyOpen: boolean;
}

/**
 * Resolve whether the drawer should end up open when a gesture finishes:
 *  - barely moved → a click, toggle;
 *  - a fast flick → follow the flick direction, however short;
 *  - otherwise → snap by position (open when past half the travel).
 */
export function resolveDrawerSnap({
  moved,
  velocity,
  msSinceLastMove,
  offset,
  closedOffset,
  currentlyOpen,
}: DrawerReleaseInput): boolean {
  if (moved < DRAG_CLICK_THRESHOLD) return !currentlyOpen;
  const releaseVelocity = msSinceLastMove > VELOCITY_STALE_MS ? 0 : velocity;
  if (Math.abs(releaseVelocity) > FLICK_VELOCITY_THRESHOLD) return releaseVelocity > 0;
  return offset < closedOffset / 2;
}
