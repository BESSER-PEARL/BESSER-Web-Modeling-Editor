import type { IPoint } from "@/edges/Connection"

/**
 * Edge-midpoint anchor for labels that sit at the middle of a relationship
 * (deployment / component «stereotype», the agentic bot icon), ported from
 * develop's `relationship-midpoint.ts`.
 *
 * Inside an edge component the step / straight edge hooks already measure the
 * same thing on the rendered path: `edgeData.pathMiddlePosition` is the point
 * at half the path length and `edgeData.isMiddlePathHorizontal` its local
 * axis. Use `relationshipLabelDirection(isMiddlePathHorizontal)` with those.
 * `relationshipMidpoint` computes it from route points (`edgeData.activePoints`,
 * stored `data.points`) without a DOM, e.g. for export or tests.
 *
 * Middle *name* labels have their own obstacle-aware placement
 * (`edges/labelTypes/middleLabelPlacement.ts`); this is not a replacement.
 */

export type RelationshipLabelDirection = "v" | "h"

export interface RelationshipMidpoint {
  position: IPoint
  direction: RelationshipLabelDirection
}

/**
 * Point at half the polyline length and the dominant axis of the segment it
 * falls on. A zero-length path yields its first point (develop returned the
 * origin), an empty one the origin; both with direction `v`.
 */
export function relationshipMidpoint(points: ReadonlyArray<IPoint>): RelationshipMidpoint {
  let remaining = 0
  for (let i = 0; i + 1 < points.length; i++) {
    remaining += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y)
  }
  remaining /= 2

  for (let i = 0; i + 1 < points.length; i++) {
    const dx = points[i + 1].x - points[i].x
    const dy = points[i + 1].y - points[i].y
    const length = Math.hypot(dx, dy)
    if (length > remaining) {
      const nx = dx / length
      const ny = dy / length
      return {
        position: { x: points[i].x + nx * remaining, y: points[i].y + ny * remaining },
        direction: Math.abs(nx) > Math.abs(ny) ? "h" : "v",
      }
    }
    remaining -= length
  }
  return { position: points[0] ? { x: points[0].x, y: points[0].y } : { x: 0, y: 0 }, direction: "v" }
}

/** Direction from the edge hooks' `isMiddlePathHorizontal`. */
export const relationshipLabelDirection = (isMiddlePathHorizontal: boolean): RelationshipLabelDirection =>
  isMiddlePathHorizontal ? "h" : "v"

export type RelationshipLabelLayout =
  | { dx: number; dominantBaseline: "middle"; textAnchor: "start" }
  | { dy: number; dominantBaseline: "text-after-edge"; textAnchor: "middle" }

/**
 * SVG `<text>` props that keep a midpoint label clear of the line: beside a
 * vertical segment, above a horizontal one. Spread onto a `<text>` placed at
 * `relationshipMidpoint(...).position`.
 */
export function relationshipLabelLayout(direction: RelationshipLabelDirection): RelationshipLabelLayout {
  return direction === "v"
    ? { dx: 5, dominantBaseline: "middle", textAnchor: "start" }
    : { dy: -5, dominantBaseline: "text-after-edge", textAnchor: "middle" }
}
