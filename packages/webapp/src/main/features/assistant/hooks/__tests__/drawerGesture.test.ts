import { describe, it, expect } from 'vitest';
import {
  DRAG_CLICK_THRESHOLD,
  FLICK_VELOCITY_THRESHOLD,
  VELOCITY_STALE_MS,
  resolveDrawerSnap,
  type DrawerReleaseInput,
} from '../drawerGesture';

const CLOSED = 600;

const release = (overrides: Partial<DrawerReleaseInput>): DrawerReleaseInput => ({
  moved: 100,
  velocity: 0,
  msSinceLastMove: 16,
  offset: CLOSED / 2,
  closedOffset: CLOSED,
  currentlyOpen: true,
  ...overrides,
});

describe('resolveDrawerSnap', () => {
  it('toggles on a click (moved under the threshold)', () => {
    expect(resolveDrawerSnap(release({ moved: 0, currentlyOpen: false }))).toBe(true);
    expect(resolveDrawerSnap(release({ moved: DRAG_CLICK_THRESHOLD - 1, currentlyOpen: true }))).toBe(false);
  });

  it('a click toggles even with a stray velocity reading', () => {
    expect(resolveDrawerSnap(release({ moved: 2, velocity: 2, currentlyOpen: true }))).toBe(false);
  });

  it('a fast downward flick closes even when the sheet barely left the top', () => {
    // Old behaviour locked the direction from the first 8px; the flick must win
    // on speed alone, wherever the sheet is.
    expect(resolveDrawerSnap(release({ moved: 30, offset: 30, velocity: -0.5 }))).toBe(false);
  });

  it('a fast upward flick opens even from near the closed position', () => {
    expect(
      resolveDrawerSnap(release({ moved: 30, offset: CLOSED - 30, velocity: 0.5, currentlyOpen: false })),
    ).toBe(true);
  });

  it('a slow drag snaps by position: past half the travel opens, otherwise closes', () => {
    const slow = FLICK_VELOCITY_THRESHOLD / 2;
    expect(resolveDrawerSnap(release({ offset: CLOSED * 0.4, velocity: -slow }))).toBe(true);
    expect(resolveDrawerSnap(release({ offset: CLOSED * 0.6, velocity: slow }))).toBe(false);
  });

  it('a drag that reverses direction snaps by where it ends, not where it started', () => {
    // Started dragging down (toward closed) then came back up slowly near the top.
    expect(resolveDrawerSnap(release({ moved: 200, offset: 40, velocity: 0.05 }))).toBe(true);
  });

  it('ignores a stale velocity when the finger paused before lifting', () => {
    expect(
      resolveDrawerSnap(release({ offset: CLOSED * 0.2, velocity: -1, msSinceLastMove: VELOCITY_STALE_MS + 1 })),
    ).toBe(true);
  });
});
