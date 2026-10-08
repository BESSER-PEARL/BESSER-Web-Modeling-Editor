import { Point } from '../../../utils/geometry/point';

export type RelationshipLabelDirection = 'v' | 'h';

export interface RelationshipMidpoint {
  position: Point;
  direction: RelationshipLabelDirection;
}

/**
 * Geometric midpoint of a relationship polyline + the dominant local
 * axis at that point. Used to anchor edge labels (name, «stereotype»,
 * and the agentic bot icon).
 *
 * Extracted verbatim from the original inline algorithm in
 * uml-deployment-association-component.tsx so every edge component
 * shares one implementation.
 */
export function relationshipMidpoint(path: ReadonlyArray<{ x: number; y: number }>): RelationshipMidpoint {
  const points = path.map((p) => new Point(p.x, p.y));
  let position = new Point(0, 0);
  let direction: RelationshipLabelDirection = 'v';
  let distance =
    points.reduce(
      (length, point, i, pts) => (i + 1 < pts.length ? length + pts[i + 1].subtract(point).length : length),
      0,
    ) / 2;

  for (let index = 0; index < points.length - 1; index++) {
    const vector = points[index + 1].subtract(points[index]);
    if (vector.length > distance) {
      const norm = vector.normalize();
      direction = Math.abs(norm.x) > Math.abs(norm.y) ? 'h' : 'v';
      position = points[index].add(norm.scale(distance));
      break;
    }
    distance -= vector.length;
  }

  return { position, direction };
}

/**
 * SVG text-layout props for an edge label, given the local edge
 * direction. Keeps the label clear of the line: beside a vertical
 * segment, above a horizontal one. Matches the original `layoutText`
 * helper that lived in uml-deployment-association-component.tsx.
 */
export function relationshipLabelLayout(direction: RelationshipLabelDirection) {
  switch (direction) {
    case 'v':
      return { dx: 5, dominantBaseline: 'middle', textAnchor: 'start' as const };
    case 'h':
      return { dy: -5, dominantBaseline: 'text-after-edge', textAnchor: 'middle' as const };
  }
}
