import { describe, expect, it } from 'vitest';
import { PILL_AT, bezier, placePills } from '../lineage/lineageLook';
import type { PillSpec } from '../lineage/lineageLook';

/** A connector as the canvas draws it: from a source row's right edge to a target row's left edge. */
const connector = (sy: number, ty: number, width = 28): PillSpec => {
  const [sx, tx] = [0, 128];
  const bend = Math.max(40, (tx - sx) / 2);
  return { at: (t) => ({ x: bezier(sx, sx + bend, tx - bend, tx, t), y: bezier(sy, sy, ty, ty, t) }), width, height: 17 };
};

type Box = { left: number; right: number; top: number; bottom: number };
const boxOf = (spec: PillSpec, at: { x: number; y: number }): Box => ({
  left: at.x - spec.width / 2, right: at.x + spec.width / 2, top: at.y - spec.height / 2, bottom: at.y + spec.height / 2,
});
const overlapping = (specs: PillSpec[], places: Array<{ x: number; y: number }>) => {
  const boxes = specs.map((spec, i) => boxOf(spec, places[i]));
  const pairs: string[] = [];
  boxes.forEach((a, i) => boxes.slice(i + 1).forEach((b, j) => {
    if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) pairs.push(`${i}/${i + j + 1}`);
  }));
  return pairs;
};

describe('lineage pill placement', () => {
  it('keeps the pills of connectors converging on one row apart', () => {
    // Live: seven bundles from the Library diagram's elements ran into classes.py; their ×N pills, all at the
    // same point near the file, covered each other (20 overlapping pairs on the canvas).
    const specs = [0, 20, 40, 60, 80, 100, 120].map((sy) => connector(sy, 60));
    expect(overlapping(specs, specs.map((s) => s.at(PILL_AT))).length).toBeGreaterThan(0); // where they were
    const places = placePills(specs);
    expect(overlapping(specs, places)).toEqual([]);
    // Each pill stays on its own connector.
    places.forEach((place, i) => {
      const onCurve = Array.from({ length: 101 }, (_, k) => specs[i].at(k / 100)).some((p) => Math.hypot(p.x - place.x, p.y - place.y) < 0.01);
      expect(onCurve).toBe(true);
    });
  });

  it('leaves a pill with room where it always was', () => {
    const lone = connector(0, 100);
    expect(placePills([lone])).toEqual([lone.at(PILL_AT)]);
  });
});
