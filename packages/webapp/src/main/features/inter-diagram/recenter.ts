import type { Box } from './diagram-builder';

/**
 * Translate derived boxes (absolute coordinates) so their bounding-box midpoint
 * sits on the origin. The editor opens with the origin in view, so off-origin
 * content would open scrolled into empty space. One uniform shift keeps every
 * parent-relative offset. `layoutOnly` boxes widen the bounding box without
 * being moved (layout space of content that is not a canvas node). A no-op for
 * centred content.
 */
export function recenterOnOrigin(boxes: Box[], layoutOnly: Box[] = []): void {
  const all = [...boxes, ...layoutOnly];
  if (all.length === 0) return;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const b of all) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  const dx = -(minX + maxX) / 2;
  const dy = -(minY + maxY) / 2;
  if (dx === 0 && dy === 0) return;
  for (const b of boxes) {
    b.x += dx;
    b.y += dy;
  }
}
