/**
 * Orthogonal segment dragging for floating edges (pure).
 *
 * Every segment of a route can be dragged perpendicular to itself:
 *  - an inner segment moves its two bends (the route stays orthogonal);
 *  - the first / last segment slides its port along the node side, which
 *    pins that end (`{ side, t }`);
 *  - dragging a segment onto the line of a neighbour snaps and merges the
 *    two, removing bends — a route left without bends goes back to auto.
 */
import type { LayoutPoint, LayoutRect } from "./autoLayoutHandles"
import { nearestBorderPort, type PortSide, type PortSpec } from "./edgePorts"
import { simplifyOrthogonal } from "./orthogonalRouter"

/** Distance under which a dragged segment snaps onto a neighbour's line. */
export const SEGMENT_SNAP = 6
/** Segments shorter than this get no drag handle. */
export const MIN_DRAGGABLE_SEGMENT = 16

export interface SegmentHandle {
  x: number
  y: number
  /** Index of the segment: points[index] → points[index + 1]. */
  index: number
  horizontal: boolean
}

/** One drag handle in the middle of every segment long enough to grab. */
export const segmentHandles = (points: LayoutPoint[]): SegmentHandle[] => {
  const out: SegmentHandle[] = []
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i]
    const b = points[i + 1]
    if (Math.hypot(b.x - a.x, b.y - a.y) < MIN_DRAGGABLE_SEGMENT) continue
    out.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, index: i, horizontal: Math.abs(a.y - b.y) < 0.5 })
  }
  return out
}

export interface SegmentDragContext {
  sourceRect: LayoutRect
  targetRect: LayoutRect
  sourceSide: PortSide
  targetSide: PortSide
}

export interface SegmentDragResult {
  /** Route while dragging (unsimplified, for live preview). */
  preview: LayoutPoint[]
  /** Index of the dragged segment within `preview` (detours shift it). */
  movedIndex: number
  /** Stored interior route on release: [] = auto route. */
  storedPoints: LayoutPoint[]
  sourcePort?: PortSpec
  targetPort?: PortSpec
}

const sideSpan = (rect: LayoutRect, side: PortSide): [number, number] =>
  side === "left" || side === "right" ? [rect.y, rect.y + rect.height] : [rect.x, rect.x + rect.width]

/** Stub a detour keeps straight out of a port before turning. */
const DETOUR_STUB = 20

/** `v` (a coordinate across `side`) kept at least a stub outside the node. */
const outsideOf = (rect: LayoutRect, side: PortSide, v: number) => {
  switch (side) {
    case "top":
      return Math.min(v, rect.y - DETOUR_STUB)
    case "bottom":
      return Math.max(v, rect.y + rect.height + DETOUR_STUB)
    case "left":
      return Math.min(v, rect.x - DETOUR_STUB)
    default:
      return Math.max(v, rect.x + rect.width + DETOUR_STUB)
  }
}

/**
 * Moves segment `index` of `points` so that it runs along `coord` (y for a
 * horizontal segment, x for a vertical one). A segment that carries a port
 * slides it along the node side (pinning that end); dragged past the side it
 * leaves the port where it is and adds a detour instead (new bends).
 */
export const dragSegment = (
  points: LayoutPoint[],
  index: number,
  coord: number,
  ctx: SegmentDragContext
): SegmentDragResult => {
  const last = points.length - 1
  const a = points[index]
  const b = points[index + 1]
  const horizontal = Math.abs(a.y - b.y) < 0.5
  const get = (p: LayoutPoint) => (horizontal ? p.y : p.x)
  const withCoord = (p: LayoutPoint, c: number) => (horizontal ? { x: p.x, y: c } : { x: c, y: p.y })
  const touchesSource = index === 0
  const touchesTarget = index + 1 === last

  // Snap onto a neighbour's line: the segment between collapses (bend removed).
  let c = coord
  const snaps: number[] = []
  if (index - 1 >= 0) snaps.push(get(points[index - 1]))
  if (index + 2 <= last) snaps.push(get(points[index + 2]))
  for (const sn of snaps) {
    if (Math.abs(sn - c) <= SEGMENT_SNAP) {
      c = sn
      break
    }
  }

  // A first / last segment that runs along its node's side (degenerate
  // route): its port cannot slide off the side line, so the segment moves
  // outside the node and a perpendicular connector joins the port.
  const runsAlong = (side: PortSide) => horizontal === (side === "top" || side === "bottom")
  const parallelSource = touchesSource && runsAlong(ctx.sourceSide)
  const parallelTarget = touchesTarget && runsAlong(ctx.targetSide)
  if (parallelSource) c = outsideOf(ctx.sourceRect, ctx.sourceSide, c)
  if (parallelTarget) c = outsideOf(ctx.targetRect, ctx.targetSide, c)

  const margin = 4
  const within = (rect: LayoutRect, side: PortSide) => {
    const [lo, hi] = sideSpan(rect, side)
    return c >= lo + margin && c <= hi - margin
  }
  const len = Math.hypot(b.x - a.x, b.y - a.y)
  const roomForDetour = len > DETOUR_STUB * (touchesSource && touchesTarget ? 3 : 1.5)
  const slideSource =
    touchesSource && !parallelSource && (within(ctx.sourceRect, ctx.sourceSide) || !roomForDetour)
  const slideTarget =
    touchesTarget && !parallelTarget && (within(ctx.targetRect, ctx.targetSide) || !roomForDetour)
  const clampTo = (rect: LayoutRect, side: PortSide, v: number) => {
    const [lo, hi] = sideSpan(rect, side)
    return Math.min(hi - margin, Math.max(lo + margin, v))
  }

  const ux = len ? (b.x - a.x) / len : 0
  const uy = len ? (b.y - a.y) / len : 0
  const head: LayoutPoint[] = []
  const tail: LayoutPoint[] = []
  let aMoved: LayoutPoint
  let bMoved: LayoutPoint
  if (!touchesSource) aMoved = withCoord(a, c)
  else if (parallelSource) {
    head.push({ ...a })
    aMoved = withCoord(a, c)
  } else if (slideSource) aMoved = withCoord(a, clampTo(ctx.sourceRect, ctx.sourceSide, c))
  else {
    // Port stays; leave it straight for a stub, then turn onto the new line.
    const stub = { x: a.x + ux * DETOUR_STUB, y: a.y + uy * DETOUR_STUB }
    head.push({ ...a }, stub)
    aMoved = withCoord(stub, c)
  }
  if (!touchesTarget) bMoved = withCoord(b, c)
  else if (parallelTarget) {
    bMoved = withCoord(b, c)
    tail.push({ ...b })
  } else if (slideTarget) bMoved = withCoord(b, clampTo(ctx.targetRect, ctx.targetSide, c))
  else {
    const stub = { x: b.x - ux * DETOUR_STUB, y: b.y - uy * DETOUR_STUB }
    bMoved = withCoord(stub, c)
    tail.push(stub, { ...b })
  }
  // A segment sliding two ports with no common span cannot stay straight.
  if (slideSource && slideTarget && Math.abs(get(aMoved) - get(bMoved)) > 0.5) {
    aMoved = withCoord(a, get(a))
    bMoved = withCoord(b, get(b))
  }

  const moved = [
    ...points.slice(0, index).map((p) => ({ ...p })),
    ...head,
    aMoved,
    bMoved,
    ...tail,
    ...points.slice(index + 2).map((p) => ({ ...p })),
  ]
  const simplified = simplifyOrthogonal(moved)
  const result: SegmentDragResult = {
    preview: moved,
    movedIndex: index + head.length,
    storedPoints: simplified.length > 2 ? simplified : [],
  }
  if (slideSource) result.sourcePort = nearestBorderPort(ctx.sourceRect, moved[0])
  if (slideTarget) result.targetPort = nearestBorderPort(ctx.targetRect, moved[moved.length - 1])
  return result
}

/** Length kept free of an edge's interaction stroke at each end. */
export const PORT_CLEARANCE = 10

/** The route shortened by `by` px at both ends (segments too short are kept). */
export const trimRouteEnds = (points: LayoutPoint[], by: number): LayoutPoint[] => {
  if (points.length < 2) return points
  const out = points.map((p) => ({ ...p }))
  const trim = (i: number, j: number) => {
    const a = out[i]
    const b = out[j]
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    if (len <= by * 2.5) return
    a.x += ((b.x - a.x) / len) * by
    a.y += ((b.y - a.y) / len) * by
  }
  trim(0, 1)
  trim(out.length - 1, out.length - 2)
  return out
}
