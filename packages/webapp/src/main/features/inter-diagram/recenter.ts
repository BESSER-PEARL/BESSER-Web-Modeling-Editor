import type { UMLModel } from '@besser/wme';

/**
 * Translate a derived model so its bounding-box midpoint sits on the origin.
 * The editor sizes the canvas symmetrically around (0,0) and the scroll
 * container opens at the top left, so off-origin content opens scrolled into
 * empty space. Element bounds are absolute here, so one uniform shift keeps
 * every parent-relative offset; relationships (bounds and path) move by the
 * same delta so edges stay attached. A no-op for centred content.
 */
export function recenterModelOnOrigin(out: UMLModel): void {
  const els = Object.values(out.elements);
  if (els.length === 0) return;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const { bounds: b } of els) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  const dx = -(minX + maxX) / 2;
  const dy = -(minY + maxY) / 2;
  if (dx === 0 && dy === 0) return;
  for (const { bounds: b } of els) {
    b.x += dx;
    b.y += dy;
  }
  for (const rel of Object.values(out.relationships)) {
    rel.bounds.x += dx;
    rel.bounds.y += dy;
    for (const p of rel.path) {
      p.x += dx;
      p.y += dy;
    }
  }
}
