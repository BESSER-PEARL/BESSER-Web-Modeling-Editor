import { describe, expect, it } from 'vitest';
import { placeDrawerPill } from '../drawerPillPlacement';

// Live geometry. The old CSS assumed a pill at most 200 px wide (a hardcoded
// 100 px half-width): the German / French / Catalan labels made it wider, so
// at 1440 it covered the controls bar's minimap button, and at 1280 with the
// properties panel open the assistant button covered the pill's end.
const rowAt = (left: number, right: number) => ({ left, right, top: 846, bottom: 882 });

describe('placeDrawerPill', () => {
  it('stays centred when it fits clear of everything', () => {
    const row = rowAt(192, 1440);
    const { left, maxWidth } = placeDrawerPill({ row, pillWidth: 190, controlsRight: 560, obstacle: null });
    expect(maxWidth).toBe(190);
    expect(row.left + left + maxWidth / 2).toBeCloseTo((192 + 1440) / 2);
  });

  it('moves right of the controls bar instead of covering it (long German label at 1440)', () => {
    const row = rowAt(192, 1440);
    const { left, maxWidth } = placeDrawerPill({ row, pillWidth: 330, controlsRight: 900, obstacle: null });
    expect(row.left + left).toBeGreaterThanOrEqual(900 + 12);
    expect(maxWidth).toBe(330);
  });

  it('keeps clear of the assistant button and narrows to fit (1280, properties panel open)', () => {
    const row = rowAt(192, 960);
    const robot = { left: 895, right: 939, top: 842, bottom: 886 };
    const { left, maxWidth } = placeDrawerPill({ row, pillWidth: 190, controlsRight: 740, obstacle: robot });
    expect(row.left + left).toBeGreaterThanOrEqual(740 + 12);
    expect(row.left + left + maxWidth).toBeLessThanOrEqual(895 - 12);
    expect(maxWidth).toBeLessThan(190);
  });

  it('ignores the assistant button when it sits on another row (phones)', () => {
    const row = rowAt(0, 390);
    const robot = { left: 336, right: 380, top: 742, bottom: 786 };
    const { maxWidth } = placeDrawerPill({ row, pillWidth: 150, controlsRight: null, obstacle: robot });
    expect(maxWidth).toBe(150);
  });
});
