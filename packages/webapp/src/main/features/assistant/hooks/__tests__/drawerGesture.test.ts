import { describe, it, expect } from 'vitest';
import {
  DRAG_DIRECTION_THRESHOLD,
  lockDragDirection,
  resolveDrawerSnap,
} from '../drawerGesture';

describe('lockDragDirection', () => {
  it('stays a click (0) while movement is under the threshold', () => {
    expect(lockDragDirection(0, 0)).toBe(0);
    expect(lockDragDirection(DRAG_DIRECTION_THRESHOLD - 1, 0)).toBe(0);
    expect(lockDragDirection(-(DRAG_DIRECTION_THRESHOLD - 1), 0)).toBe(0);
  });

  it('locks +1 (open) once dragged down past the threshold', () => {
    expect(lockDragDirection(DRAG_DIRECTION_THRESHOLD, 0)).toBe(1);
    expect(lockDragDirection(40, 0)).toBe(1);
  });

  it('locks -1 (close) once dragged up past the threshold', () => {
    expect(lockDragDirection(-DRAG_DIRECTION_THRESHOLD, 0)).toBe(-1);
    expect(lockDragDirection(-40, 0)).toBe(-1);
  });

  it('keeps the first locked direction even if the drag reverses (flick-and-settle)', () => {
    // Locked down, then the finger drifts back up — direction must not flip.
    expect(lockDragDirection(-30, 1)).toBe(1);
    // Locked up, then drifts back down.
    expect(lockDragDirection(30, -1)).toBe(-1);
  });

  it('honours a custom threshold', () => {
    expect(lockDragDirection(9, 0, 20)).toBe(0);
    expect(lockDragDirection(20, 0, 20)).toBe(1);
  });
});

describe('resolveDrawerSnap', () => {
  it('toggles on a click (direction 0)', () => {
    expect(resolveDrawerSnap(0, false)).toBe(true); // closed → open
    expect(resolveDrawerSnap(0, true)).toBe(false); // open → closed
  });

  it('a downward drag always resolves to open, regardless of current state', () => {
    expect(resolveDrawerSnap(1, false)).toBe(true);
    expect(resolveDrawerSnap(1, true)).toBe(true);
  });

  it('an upward drag always resolves to closed, regardless of current state', () => {
    expect(resolveDrawerSnap(-1, false)).toBe(false);
    expect(resolveDrawerSnap(-1, true)).toBe(false);
  });
});
