/**
 * Continuous ("floating") edge ports: where each end of an edge attaches to
 * its node and how the edge is routed, computed from node geometry instead
 * of fixed handle slots (draw.io / tldraw style).
 *
 *  - An end is AUTO by default: it sits on the side of its node that faces
 *    the other end, and the auto ends sharing a side are spread along it,
 *    ordered by where their other end is (so they do not cross). Facing ends
 *    whose nodes overlap along that axis line up into a straight edge.
 *  - An end is PINNED when the edge stores `data.sourcePort` /
 *    `data.targetPort` = `{ side, t }` (t = 0..1 along the side).
 *  - Stored interior points of `data.points` are user bends and are kept;
 *    the ends attach where the first / last bend meets the node, with an
 *    orthogonal elbow when needed. Bends inside an end node are invalid and
 *    dropped (auto route).
 *  - Legacy `sourceHandle` / `targetHandle` ids are not positions any more;
 *    they only map to a side + ratio for serialisation (`handleIdToPort`).
 *  - Rects are the nodes' attachment boxes (`nodeShapes`); with a shape per
 *    node, ends land on the real outline (circle, diamond, rounded corner)
 *    along the side's normal, so routes stay orthogonal up to the shape.
 *
 * Pure, deterministic and DOM-free (tested in `edgePorts.test.ts`).
 */
import {
  chooseFacingSidesForRects,
  handleGeometry,
  type HandleSide,
  type LayoutPoint,
  type LayoutRect,
} from "./autoLayoutHandles"
import { GridIndex, routeOrthogonalEdges, simplifyOrthogonal } from "./orthogonalRouter"
import { cornerFraction, outlinePoint, type NodeShape } from "./nodeShapes"

export type PortSide = HandleSide

/**
 * Edge types rendered with floating ports: their route is computed live from
 * the node geometry, never stored.
 */
export const FLOATING_EDGE_TYPES: ReadonlySet<string> = new Set([
  "ClassAggregation",
  "ClassInheritance",
  "ClassRealization",
  "ClassComposition",
  "ClassBidirectional",
  "ClassUnidirectional",
  "ClassDependency",
  "ClassOCLLink",
  "ClassLinkRel",
  "CommentLink",
  "ObjectLink",
  "UserModelLink",
  "StateTransition",
  "AgentStateTransition",
  "AgentStateTransitionInit",
  "BPMNSequenceFlow",
  "BPMNMessageFlow",
  "BPMNAssociationFlow",
  "BPMNDataAssociationFlow",
  "NNNext",
  "NNComposition",
  "NNAssociation",
])

/** Floating edges drawn as curves between their ports (no orthogonal route). */
export const CURVED_EDGE_TYPES: ReadonlySet<string> = new Set([
  "AgentStateTransition",
  "AgentStateTransitionInit",
])

/** Persisted pinned port: side of the node and position along it (0..1). */
export interface PortSpec {
  side: PortSide
  t: number
}

export interface PortEnd {
  x: number
  y: number
  side: PortSide
  pinned: boolean
}

export interface PortEdgeInput {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
  /** Curved edge: ports only, no route and no bends (`points` = both ends). */
  curved?: boolean
  /** Stacked nodes connect top / bottom even when far apart sideways (BPMN message flows). */
  preferVertical?: boolean
  data?: {
    points?: LayoutPoint[] | null
    sourcePort?: unknown
    targetPort?: unknown
    /** `false`: stored points are an old auto route, not user bends. */
    isManuallyLayouted?: unknown
  } | null
}

export interface PortGeometry {
  source: PortEnd
  target: PortEnd
  /** Full orthogonal polyline, source port → target port. */
  points: LayoutPoint[]
  /** Whether the route keeps stored user bends. */
  hasBends: boolean
  /**
   * Curved edges sharing their two nodes: control-point offset that bows this
   * curve away from its siblings, and where its label sits (0..1 from the
   * source). Absent for a lone curve.
   */
  bow?: LayoutPoint
  labelAt?: number
}

const SIDES: readonly PortSide[] = ["top", "right", "bottom", "left"]
/** Length of the perpendicular stub a route leaves a port with. */
export const PORT_STUB = 20
/** Minimum distance between two ends spread on the same side. */
const MIN_PORT_GAP = 22
/** Corner clearance kept free of auto ends (circles / diamonds: a share of the side). */
const cornerMargin = (len: number, shape?: NodeShape) =>
  !shape || shape.kind === "rect" || shape.kind === "roundRect"
    ? Math.min(14, len * 0.2)
    : len * cornerFraction(shape)

const OPPOSITE: Record<PortSide, PortSide> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
}

const NORMAL: Record<PortSide, LayoutPoint> = {
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

const isVerticalSide = (side: PortSide) => side === "left" || side === "right"

/** Coordinate along a side's axis (x for top/bottom, y for left/right). */
const along = (side: PortSide, p: LayoutPoint) => (isVerticalSide(side) ? p.y : p.x)

/** [start, end] of a side along its axis. */
const sideRange = (rect: LayoutRect, side: PortSide): [number, number] =>
  isVerticalSide(side) ? [rect.y, rect.y + rect.height] : [rect.x, rect.x + rect.width]

/** Point on `side` of `rect` at axis coordinate `c`. */
const pointOnSide = (rect: LayoutRect, side: PortSide, c: number): LayoutPoint => {
  switch (side) {
    case "top":
      return { x: c, y: rect.y }
    case "bottom":
      return { x: c, y: rect.y + rect.height }
    case "left":
      return { x: rect.x, y: c }
    default:
      return { x: rect.x + rect.width, y: c }
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

const centerOf = (r: LayoutRect): LayoutPoint => ({
  x: r.x + r.width / 2,
  y: r.y + r.height / 2,
})

// ---------------------------------------------------------------------------
// Port specs: validation, legacy handle ids, nearest border point
// ---------------------------------------------------------------------------

/** Reads a stored `{ side, t }` port; anything malformed → undefined. */
export const readPort = (value: unknown): PortSpec | undefined => {
  if (!value || typeof value !== "object") return undefined
  const { side, t } = value as { side?: unknown; t?: unknown }
  if (typeof side !== "string" || !SIDES.includes(side as PortSide)) return undefined
  if (typeof t !== "number" || !Number.isFinite(t)) return undefined
  return { side: side as PortSide, t: clamp(t, 0, 1) }
}

/** Legacy handle id ("right-top", "bottom", "Left", …) → side + ratio. */
export const handleIdToPort = (handleId: string | null | undefined): PortSpec | undefined => {
  const g = handleGeometry(handleId)
  return g ? { side: g.side, t: g.fraction } : undefined
}

/**
 * The handle id stored for an end on `side` (the side's centre handle). Every
 * node wrapper renders it, so React Flow can always resolve the edge, and
 * converters / the backend get a valid, meaningful value.
 */
export const sideHandleId = (side: PortSide): string => side

/** Absolute point of a port spec on a rect. */
export const portPoint = (rect: LayoutRect, port: PortSpec): LayoutPoint => {
  const [a, b] = sideRange(rect, port.side)
  return pointOnSide(rect, port.side, a + (b - a) * port.t)
}

/** Distance from `p` to the outline of `rect` (0 on the border). */
export const distanceToBorder = (rect: LayoutRect, p: LayoutPoint): number => {
  const nearest = nearestBorderPort(rect, p)
  const q = portPoint(rect, nearest)
  return Math.hypot(p.x - q.x, p.y - q.y)
}

/** Port spec of the border point nearest to `p` (inside or outside the rect). */
export const nearestBorderPort = (rect: LayoutRect, p: LayoutPoint): PortSpec => {
  const cx = clamp(p.x, rect.x, rect.x + rect.width)
  const cy = clamp(p.y, rect.y, rect.y + rect.height)
  const inside = cx === p.x && cy === p.y
  const dist: Record<PortSide, number> = inside
    ? {
        top: p.y - rect.y,
        bottom: rect.y + rect.height - p.y,
        left: p.x - rect.x,
        right: rect.x + rect.width - p.x,
      }
    : {
        top: p.y < rect.y ? Math.hypot(p.x - cx, p.y - rect.y) : Infinity,
        bottom: p.y > rect.y + rect.height ? Math.hypot(p.x - cx, p.y - rect.y - rect.height) : Infinity,
        left: p.x < rect.x ? Math.hypot(p.x - rect.x, p.y - cy) : Infinity,
        right: p.x > rect.x + rect.width ? Math.hypot(p.x - rect.x - rect.width, p.y - cy) : Infinity,
      }
  let side: PortSide = "top"
  for (const s of SIDES) if (dist[s] < dist[side]) side = s
  const [a, b] = sideRange(rect, side)
  const c = isVerticalSide(side) ? cy : cx
  return { side, t: b > a ? clamp((c - a) / (b - a), 0, 1) : 0.5 }
}

/** Side of `rect` that faces the point `p`; undefined when `p` is inside. */
export const sideTowards = (rect: LayoutRect, p: LayoutPoint): PortSide | undefined => {
  const gaps: Record<PortSide, number> = {
    right: p.x - (rect.x + rect.width),
    left: rect.x - p.x,
    bottom: p.y - (rect.y + rect.height),
    top: rect.y - p.y,
  }
  let best: PortSide | undefined
  for (const s of SIDES) if (gaps[s] > 0 && (!best || gaps[s] > gaps[best])) best = s
  return best
}

// ---------------------------------------------------------------------------
// Routing helpers
// ---------------------------------------------------------------------------

const samePoint = (a: LayoutPoint, b: LayoutPoint) =>
  Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5

/** Inserts corners so consecutive points are axis-aligned (x first, then y). */
const orthogonalize = (pts: LayoutPoint[]): LayoutPoint[] => {
  const out: LayoutPoint[] = []
  for (const p of pts) {
    const last = out[out.length - 1]
    if (last && Math.abs(last.x - p.x) > 0.5 && Math.abs(last.y - p.y) > 0.5) {
      out.push({ x: p.x, y: last.y })
    }
    out.push(p)
  }
  return out
}

/**
 * Intermediate points leading from port `p` (on `side`) to point `b` with an
 * orthogonal path that leaves the port perpendicular to its side.
 */
const elbowTo = (p: LayoutPoint, side: PortSide, b: LayoutPoint): LayoutPoint[] => {
  const n = NORMAL[side]
  if (isVerticalSide(side)) {
    if ((b.x - p.x) * n.x > 0.5) return Math.abs(b.y - p.y) < 0.5 ? [] : [{ x: b.x, y: p.y }]
    const s = { x: p.x + n.x * PORT_STUB, y: p.y }
    return [s, { x: s.x, y: b.y }]
  }
  if ((b.y - p.y) * n.y > 0.5) return Math.abs(b.x - p.x) < 0.5 ? [] : [{ x: p.x, y: b.y }]
  const s = { x: p.x, y: p.y + n.y * PORT_STUB }
  return [s, { x: b.x, y: s.y }]
}

/** Axis-aligned segment strictly crossing the interior of `r`. */
const segmentCrossesRect = (a: LayoutPoint, b: LayoutPoint, r: LayoutRect): boolean => {
  const x0 = r.x + 1
  const x1 = r.x + r.width - 1
  const y0 = r.y + 1
  const y1 = r.y + r.height - 1
  if (Math.abs(a.y - b.y) < 0.5) {
    if (a.y <= y0 || a.y >= y1) return false
    return Math.max(a.x, b.x) > x0 && Math.min(a.x, b.x) < x1
  }
  if (Math.abs(a.x - b.x) < 0.5) {
    if (a.x <= x0 || a.x >= x1) return false
    return Math.max(a.y, b.y) > y0 && Math.min(a.y, b.y) < y1
  }
  return false
}

const routeCrosses = (pts: LayoutPoint[], rects: LayoutRect[]) => {
  for (let i = 0; i + 1 < pts.length; i++) {
    for (const r of rects) if (segmentCrossesRect(pts[i], pts[i + 1], r)) return true
  }
  return false
}

/**
 * Simple orthogonal connector between two ports: straight, Z (facing sides)
 * or L (perpendicular sides). Undefined when none of these shapes is clean.
 */
const simpleRoute = (
  s: LayoutPoint,
  ss: PortSide,
  t: LayoutPoint,
  ts: PortSide,
  zShift = 0
): LayoutPoint[] | undefined => {
  const ns = NORMAL[ss]
  const nt = NORMAL[ts]
  if (OPPOSITE[ss] === ts) {
    // Facing: the target must lie ahead of the source.
    if (isVerticalSide(ss)) {
      if ((t.x - s.x) * ns.x <= 0) return undefined
      if (Math.abs(s.y - t.y) < 0.5) return [s, { x: t.x, y: s.y }]
      const mx = (s.x + t.x) / 2 + zShift
      return [s, { x: mx, y: s.y }, { x: mx, y: t.y }, t]
    }
    if ((t.y - s.y) * ns.y <= 0) return undefined
    if (Math.abs(s.x - t.x) < 0.5) return [s, { x: s.x, y: t.y }]
    const my = (s.y + t.y) / 2 + zShift
    return [s, { x: s.x, y: my }, { x: t.x, y: my }, t]
  }
  if (ss === ts) {
    // U around both ends, `zShift` further out (nested parallel U's).
    const reach = PORT_STUB + Math.max(0, zShift)
    if (isVerticalSide(ss)) {
      const x = ns.x > 0 ? Math.max(s.x, t.x) + reach : Math.min(s.x, t.x) - reach
      return [s, { x, y: s.y }, { x, y: t.y }, t]
    }
    const y = ns.y > 0 ? Math.max(s.y, t.y) + reach : Math.min(s.y, t.y) - reach
    return [s, { x: s.x, y }, { x: t.x, y }, t]
  }
  if (isVerticalSide(ss) !== isVerticalSide(ts)) {
    const c = isVerticalSide(ss) ? { x: t.x, y: s.y } : { x: s.x, y: t.y }
    const aheadOfSource = isVerticalSide(ss) ? (c.x - s.x) * ns.x > 0 : (c.y - s.y) * ns.y > 0
    const outsideTarget = isVerticalSide(ts) ? (c.x - t.x) * nt.x > 0 : (c.y - t.y) * nt.y > 0
    if (aheadOfSource && outsideTarget) return [s, c, t]
  }
  return undefined
}

/** True when `outer` fully contains `inner` (a container such as a package). */
const containsRect = (outer: LayoutRect, inner: LayoutRect) =>
  outer.x <= inner.x &&
  outer.y <= inner.y &&
  outer.x + outer.width >= inner.x + inner.width &&
  outer.y + outer.height >= inner.y + inner.height

/** Node rects as route obstacles, indexed for "what is near this box" queries. */
export interface ObstacleSet {
  rects: LayoutRect[]
  index: GridIndex
}

export const obstacleSet = (rects: LayoutRect[]): ObstacleSet => {
  const index = new GridIndex(128)
  rects.forEach((r, i) => index.insert(i, r.x, r.y, r.x + r.width, r.y + r.height))
  return { rects, index }
}

type Box = [number, number, number, number]

/** Obstacles overlapping `box`, never an end node or a container of one. */
const nearby = (set: ObstacleSet, sRect: LayoutRect, tRect: LayoutRect, [x0, y0, x1, y1]: Box) =>
  set.index
    .query(x0, y0, x1, y1)
    .map((i) => set.rects[i])
    .filter(
      (r) =>
        r !== sRect &&
        r !== tRect &&
        !containsRect(r, sRect) &&
        !containsRect(r, tRect) &&
        !containsRect(sRect, r) &&
        !containsRect(tRect, r) &&
        r.x < x1 &&
        r.x + r.width > x0 &&
        r.y < y1 &&
        r.y + r.height > y0
    )

const boxOfPoints = (pts: LayoutPoint[], pad: number, into?: Box): Box => {
  const b: Box = into ?? [Infinity, Infinity, -Infinity, -Infinity]
  for (const p of pts) {
    b[0] = Math.min(b[0], p.x - pad)
    b[1] = Math.min(b[1], p.y - pad)
    b[2] = Math.max(b[2], p.x + pad)
    b[3] = Math.max(b[3], p.y + pad)
  }
  return b
}

const rectsKey = (rs: LayoutRect[]) => rs.map((r) => `${r.x},${r.y},${r.width},${r.height}`).join(";")

/**
 * Detour routes by their exact inputs: the two ports and end rects, the
 * obstacles in the first search window and those in the area the route and
 * its searches covered. A dragged node only re-routes the edges whose
 * inputs it touches; every other edge is a lookup.
 */
const routeCache = new Map<string, { points: LayoutPoint[]; area: Box; areaKey: string }>()
const ROUTE_CACHE_LIMIT = 5000

/** Clearance the router keeps around nodes (its default margin). */
const ROUTER_MARGIN = 14

/**
 * Auto route between two ports, detouring around other nodes when needed.
 * `zShift` moves the middle segment of a Z route (lanes of parallel edges).
 */
export const routeBetweenPorts = (
  s: LayoutPoint,
  ss: PortSide,
  t: LayoutPoint,
  ts: PortSide,
  sRect: LayoutRect,
  tRect: LayoutRect,
  obstacles: LayoutRect[] | ObstacleSet,
  zShift = 0
): LayoutPoint[] => {
  const set = Array.isArray(obstacles) ? obstacleSet(obstacles) : obstacles
  // Obstacles near the route only (keeps the router grid tiny).
  const pad = 160
  const others = nearby(set, sRect, tRect, [
    Math.min(s.x, t.x) - pad,
    Math.min(s.y, t.y) - pad,
    Math.max(s.x, t.x) + pad,
    Math.max(s.y, t.y) + pad,
  ])
  const simple = simpleRoute(s, ss, t, ts, zShift)
  // A U can run through an end node; the other shapes leave / enter it outward.
  if (simple && !routeCrosses(simple, others) && (ss !== ts || !routeCrosses(simple, [sRect, tRect]))) {
    return simplifyOrthogonal(simple)
  }

  const othersSet = new Set(others)
  const outside = (area: Box) => nearby(set, sRect, tRect, area).filter((r) => !othersSet.has(r))
  const key = [s.x, s.y, ss, t.x, t.y, ts, rectsKey([sRect, tRect]), rectsKey(others)].join("|")
  const cached = routeCache.get(key)
  if (cached && rectsKey(outside(cached.area)) === cached.areaKey) return cached.points.map((p) => ({ ...p }))

  const ends = containsRect(sRect, tRect) || containsRect(tRect, sRect) ? [] : [sRect, tRect]
  const request = { id: "r", source: { point: s, side: ss }, target: { point: t, side: ts } }
  // A detour can leave the first window: add any node it then crosses and
  // route again (a few passes at most).
  const extra: LayoutRect[] = []
  let area: Box = boxOfPoints([s, t], ROUTER_MARGIN + 1)
  let routed: LayoutPoint[] | undefined
  for (let pass = 0; pass < 3; pass++) {
    routed = routeOrthogonalEdges([...ends, ...others, ...extra], [request]).get("r")
    if (!routed || routed.length < 2) break
    area = boxOfPoints(routed, ROUTER_MARGIN + 1, area)
    const crossed = outside(area).filter((r) => !extra.includes(r) && routeCrosses(routed!, [r]))
    if (crossed.length === 0) break
    extra.push(...crossed)
    for (const r of crossed) area = boxOfPoints([{ x: r.x, y: r.y }, { x: r.x + r.width, y: r.y + r.height }], 1, area)
  }
  const points =
    routed && routed.length >= 2
      ? routed
      : // Clean orthogonal shape that leaves and enters both ports perpendicular.
        (routeOrthogonalEdges([], [request]).get("r") ?? simplifyOrthogonal(orthogonalize([s, t])))
  if (routeCache.size >= ROUTE_CACHE_LIMIT) routeCache.clear()
  routeCache.set(key, { points, area, areaKey: rectsKey(outside(area)) })
  return points
}

// ---------------------------------------------------------------------------
// Curved edges
// ---------------------------------------------------------------------------

/** React Flow's bézier control offset (`getBezierPath`, curvature 0.25). */
const controlOffset = (d: number) => (d >= 0 ? 0.5 * d : 0.25 * 25 * Math.sqrt(-d))

/** Control point React Flow's bézier uses for an end at `p` on `side` towards `q`. */
export const bezierControl = (p: LayoutPoint, side: PortSide, q: LayoutPoint): LayoutPoint => {
  switch (side) {
    case "left":
      return { x: p.x - controlOffset(p.x - q.x), y: p.y }
    case "right":
      return { x: p.x + controlOffset(q.x - p.x), y: p.y }
    case "top":
      return { x: p.x, y: p.y - controlOffset(p.y - q.y) }
    default:
      return { x: p.x, y: p.y + controlOffset(q.y - p.y) }
  }
}

const CURVE_SAMPLES = 24

/**
 * Cost of the curve leaving `sRect` on `ss` and entering `tRect` on `ts`
 * (side centres): nodes it runs through (heavily), then its length.
 */
const curveCost = (
  sRect: LayoutRect,
  ss: PortSide,
  tRect: LayoutRect,
  ts: PortSide,
  set: ObstacleSet
): number => {
  const s = portPoint(sRect, { side: ss, t: 0.5 })
  const t = portPoint(tRect, { side: ts, t: 0.5 })
  const c1 = bezierControl(s, ss, t)
  const c2 = bezierControl(t, ts, s)
  const pts: LayoutPoint[] = []
  for (let i = 0; i <= CURVE_SAMPLES; i++) {
    const u = i / CURVE_SAMPLES
    const v = 1 - u
    pts.push({
      x: v * v * v * s.x + 3 * v * v * u * c1.x + 3 * v * u * u * c2.x + u * u * u * t.x,
      y: v * v * v * s.y + 3 * v * v * u * c1.y + 3 * v * u * u * c2.y + u * u * u * t.y,
    })
  }
  let length = 0
  for (let i = 1; i < pts.length; i++) length += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
  const others = nearby(set, sRect, tRect, boxOfPoints(pts, 0))
  let crossed = 0
  for (const r of [...others, sRect, tRect]) {
    const own = r === sRect || r === tRect
    const hit = pts.some((p, i) => (!own || (i > 1 && i < CURVE_SAMPLES - 1)) && isInside(r, p))
    if (hit) crossed++
  }
  return crossed * 1e6 + length
}

const CURVE_SIDE_PAIRS: [PortSide, PortSide][] = [
  ["top", "top"],
  ["bottom", "bottom"],
  ["left", "left"],
  ["right", "right"],
  ["right", "top"],
  ["right", "bottom"],
  ["left", "top"],
  ["left", "bottom"],
  ["top", "right"],
  ["top", "left"],
  ["bottom", "right"],
  ["bottom", "left"],
]

/**
 * Sides for a curved edge: the facing sides unless that curve runs through a
 * node, then the clear pair with the shortest curve (an arc over or under).
 */
const clearCurveSides = (
  sRect: LayoutRect,
  tRect: LayoutRect,
  facingS: PortSide,
  facingT: PortSide,
  set: ObstacleSet
): [PortSide, PortSide] => {
  const facingCost = curveCost(sRect, facingS, tRect, facingT, set)
  if (facingCost < 1e6) return [facingS, facingT]
  let best: [PortSide, PortSide] = [facingS, facingT]
  let bestCost = facingCost
  for (const [ss, ts] of CURVE_SIDE_PAIRS) {
    const cost = curveCost(sRect, ss, tRect, ts, set)
    if (cost < bestCost) {
      best = [ss, ts]
      bestCost = cost
    }
  }
  return best
}

// ---------------------------------------------------------------------------
// Port assignment
// ---------------------------------------------------------------------------

interface EndState {
  edgeId: string
  end: "source" | "target"
  nodeId: string
  rect: LayoutRect
  shape?: NodeShape
  side: PortSide
  /** Assigned axis coordinate (fixed ends: final; auto ends: after spreading). */
  pos: number
  pinned: boolean
  auto: boolean
  /** Ordering key along the side (where the other end is). */
  key: number
  /** Order among ends with the same key (edges joining the same two nodes). */
  tie: number
  /** Axis coordinate that would make the edge straight, when there is one. */
  straight?: number
  /** Set on straight siblings between two nodes: spaced as assigned, not pushed apart. */
  bundle?: EdgeState[]
}

interface EdgeState {
  edge: PortEdgeInput
  sRect: LayoutRect
  tRect: LayoutRect
  bends: LayoutPoint[]
  source: EndState
  target: EndState
  /** Self-loops: index among the loops of the node (nested, not stacked). */
  loop: number
  /** Edges joining the same two nodes (either direction), by id; `rank` = own index. */
  pair: EdgeState[]
  rank: number
}

/** Corner distance of the innermost self-loop, and the step between loops. */
const LOOP_OFFSET = 30
const LOOP_STEP = 14

const isInside = (r: LayoutRect, p: LayoutPoint) =>
  p.x > r.x + 1 && p.x < r.x + r.width - 1 && p.y > r.y + 1 && p.y < r.y + r.height - 1

/** Interior stored points, or [] when there are none or they are invalid. */
const userBends = (edge: PortEdgeInput, sRect: LayoutRect, tRect: LayoutRect): LayoutPoint[] => {
  const pts = edge.data?.points
  // Routes saved by the fixed-handle renderer (templates, v3 imports) are
  // flagged as not manually laid out: the ends re-attach to facing sides.
  if (!Array.isArray(pts) || pts.length < 3 || edge.data?.isManuallyLayouted === false) return []
  const bends = pts
    .slice(1, -1)
    .filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))
    .map((p) => ({ x: p.x, y: p.y }))
  if (bends.length === 0) return []
  if (bends.some((b) => isInside(sRect, b) || isInside(tRect, b))) return []
  const first = bends[0]
  const last = bends[bends.length - 1]
  if (!sideTowards(sRect, first) || !sideTowards(tRect, last)) return []
  return bends
}

/** Below this spacing, a crowded free interval hands an end to a neighbour. */
const MIN_CROWDED_GAP = 6

/**
 * Spreads the auto ends of one node side. Fixed (pinned / bend-anchored)
 * ends split the side into free intervals; the auto ends keep their order
 * and are spread inside those intervals, so none lands on a fixed end or on
 * another auto end.
 */
const spreadSide = (
  ends: EndState[],
  fixed: number[],
  rect: LayoutRect,
  side: PortSide,
  shape?: NodeShape
) => {
  const [a, b] = sideRange(rect, side)
  const m = cornerMargin(b - a, shape)
  const lo = a + m
  const hi = b - m
  ends.sort(
    (p, q) => p.key - q.key || p.tie - q.tie || p.edgeId.localeCompare(q.edgeId) || p.end.localeCompare(q.end)
  )
  const n = ends.length
  if (n === 0) return
  const desired = ends.map((e, i) =>
    e.straight !== undefined ? clamp(e.straight, lo, hi) : lo + ((hi - lo) * (i + 1)) / (n + 1)
  )
  // Free intervals: the side minus a clearance around every fixed end.
  const clear = Math.max(n > 1 ? Math.min(MIN_PORT_GAP, (hi - lo) / (n - 1)) : 0, 12)
  let intervals: [number, number][] = []
  let start = lo
  for (const f of [...fixed].sort((p, q) => p - q)) {
    if (f - clear >= start) intervals.push([start, Math.min(hi, f - clear)])
    start = Math.max(start, f + clear)
  }
  if (start <= hi) intervals.push([start, hi])
  intervals = intervals.filter(([l, h]) => h >= l)
  if (intervals.length === 0) intervals = [[lo, hi]]

  // Interval per end: nearest to its desired position, never before the
  // previous end's (keeps the order).
  const K = intervals.length
  const nearest = (v: number) => {
    let best = 0
    let bestD = Infinity
    intervals.forEach(([l, h], k) => {
      const d = v < l ? l - v : v > h ? v - h : 0
      if (d < bestD) {
        bestD = d
        best = k
      }
    })
    return best
  }
  const slot = desired.map(nearest)
  for (let i = 1; i < n; i++) slot[i] = Math.max(slot[i], slot[i - 1])
  // A crowded interval passes its first / last end to the roomier neighbour.
  const count = () => {
    const c = new Array<number>(K).fill(0)
    for (const k of slot) c[k]++
    return c
  }
  const room = (k: number, c: number[]) => (intervals[k][1] - intervals[k][0]) / Math.max(1, c[k])
  for (let guard = 0; guard < n * K; guard++) {
    const c = count()
    const k = c.findIndex((ck, idx) => ck > 1 && (intervals[idx][1] - intervals[idx][0]) / (ck - 1) < MIN_CROWDED_GAP)
    if (k < 0) break
    const right = k + 1 < K ? room(k + 1, c) : -1
    const left = k > 0 ? room(k - 1, c) : -1
    if (right < 0 && left < 0) break
    if (right >= left) slot[slot.lastIndexOf(k)] = k + 1
    else slot[slot.indexOf(k)] = k - 1
  }

  for (let k = 0; k < K; k++) {
    const [l, h] = intervals[k]
    const idx = slot.flatMap((sk, i) => (sk === k ? [i] : []))
    const c = idx.length
    if (c === 0) continue
    const gap = c > 1 ? Math.min(MIN_PORT_GAP, (h - l) / (c - 1)) : 0
    const pos = idx.map((i) => clamp(desired[i], l, h))
    // Gap before end j: straight siblings keep their assigned spacing.
    const gapBefore = (j: number) => {
      const [p, q] = [ends[idx[j - 1]], ends[idx[j]]]
      const d = desired[idx[j]] - desired[idx[j - 1]]
      return p.bundle && p.bundle === q.bundle && d >= MIN_STRAIGHT_GAP ? Math.min(gap, d) : gap
    }
    for (let i = 1; i < c; i++) pos[i] = Math.max(pos[i], pos[i - 1] + gapBefore(i))
    pos[c - 1] = Math.min(pos[c - 1], h)
    for (let i = c - 2; i >= 0; i--) pos[i] = Math.min(pos[i], pos[i + 1] - gapBefore(i + 1))
    idx.forEach((i, j) => (ends[i].pos = Math.max(pos[j], l)))
  }
}

/** Closest two straight parallel edges get; below it they become Z lanes. */
const MIN_STRAIGHT_GAP = 8
/** Facing sides closer than this leave no visible route: try other sides. */
const MIN_FACING_GAP = PORT_STUB
/** Spacing of the middle segments of parallel Z routes, and their clearance. */
const LANE_GAP = 12
const LANE_MARGIN = 6
/** Control-point offset between sibling curves, and label stagger along them. */
const CURVE_BOW = 26
const LABEL_STAGGER = 0.22

const SIDE_PAIRS: [PortSide, PortSide][] = SIDES.flatMap((a) => SIDES.map((b): [PortSide, PortSide] => [a, b]))

/** Free distance between `side` of `s` and the facing side of `t` (negative: overlap). */
const sideGap = (s: LayoutRect, side: PortSide, t: LayoutRect): number => {
  switch (side) {
    case "right":
      return t.x - (s.x + s.width)
    case "left":
      return s.x - (t.x + t.width)
    case "bottom":
      return t.y - (s.y + s.height)
    default:
      return s.y - (t.y + t.height)
  }
}

/**
 * Sides for an edge with two free ends: the facing sides, unless they are
 * too close for a visible route (then an L, failing that a U around both),
 * or the edge prefers top / bottom between stacked nodes.
 */
const roomySides = (
  s: LayoutRect,
  t: LayoutRect,
  preferVertical: boolean,
  /** Edges joining the two nodes: an L must stay clean for the outermost ports. */
  siblings = 1
): { sourceSide: PortSide; targetSide: PortSide } => {
  let facing = chooseFacingSidesForRects(s, t)
  if (preferVertical) {
    if (sideGap(s, "bottom", t) > 0) facing = { sourceSide: "bottom", targetSide: "top" }
    else if (sideGap(s, "top", t) > 0) facing = { sourceSide: "top", targetSide: "bottom" }
  }
  const gap = sideGap(s, facing.sourceSide, t)
  if (gap < 0 || gap >= MIN_FACING_GAP) return facing
  let best: { sourceSide: PortSide; targetSide: PortSide } | undefined
  let bestCost = Infinity
  const spread = siblings > 1 ? [1 / (siblings + 1), siblings / (siblings + 1)] : [0.5]
  for (const [ss, ts] of SIDE_PAIRS) {
    if (OPPOSITE[ss] === ts) continue
    let cost = 0
    if (ss === ts) {
      const sp = portPoint(s, { side: ss, t: 0.5 })
      const tp = portPoint(t, { side: ts, t: 0.5 })
      cost = 1e4 + Math.abs(sp.x - tp.x) + Math.abs(sp.y - tp.y)
    } else {
      for (const fs of spread) {
        for (const ft of spread) {
          const sp = portPoint(s, { side: ss, t: fs })
          const tp = portPoint(t, { side: ts, t: ft })
          const c = isVerticalSide(ss) ? { x: tp.x, y: sp.y } : { x: sp.x, y: tp.y }
          const ahead = isVerticalSide(ss) ? (c.x - sp.x) * NORMAL[ss].x : (c.y - sp.y) * NORMAL[ss].y
          const outside = isVerticalSide(ts) ? (c.x - tp.x) * NORMAL[ts].x : (c.y - tp.y) * NORMAL[ts].y
          if (ahead < MIN_FACING_GAP || outside < MIN_FACING_GAP || routeCrosses([sp, c, tp], [s, t])) cost = Infinity
          else cost = Math.max(cost, ahead + outside)
        }
      }
      if (cost === Infinity) continue
    }
    if (cost < bestCost) {
      best = { sourceSide: ss, targetSide: ts }
      bestCost = cost
    }
  }
  return best ?? facing
}

/**
 * Diamonds (gateways, merge nodes): of several auto ends on one corner, those
 * whose partner lies beyond the node's extent move to the corner facing it,
 * so a split leaves from the top / bottom corners instead of one point.
 */
const splitDiamondCorners = (states: EdgeState[]) => {
  const corners = new Map<string, [EndState, EndState][]>()
  for (const st of states) {
    if (st.edge.source === st.edge.target || st.edge.curved || st.bends.length > 0) continue
    for (const [es, other] of [
      [st.source, st.target],
      [st.target, st.source],
    ]) {
      if (!es.auto || other.pinned || es.shape?.kind !== "diamond") continue
      const k = `${es.nodeId}|${es.side}`
      corners.set(k, [...(corners.get(k) ?? []), [es, other]])
    }
  }
  for (const ends of corners.values()) {
    if (ends.length < 2) continue
    for (const [es, other] of ends) {
      const oc = centerOf(other.rect)
      const [a, b] = sideRange(es.rect, es.side)
      const c = along(es.side, oc)
      if (c >= a && c <= b) continue
      es.side = isVerticalSide(es.side) ? (c < a ? "top" : "bottom") : c < a ? "left" : "right"
      es.key = along(es.side, oc)
    }
  }
}

/**
 * Offsets that keep edges between the same two nodes apart: the middle
 * segments of parallel Z routes on their own lanes (nested, so none
 * crosses), and sibling curves bowed apart with staggered labels.
 */
const bundleOffsets = (pairs: Map<string, EdgeState[]>) => {
  const zShift = new Map<EdgeState, number>()
  const curves = new Map<EdgeState, { bow: LayoutPoint; labelAt: number }>()
  const portOf = (es: EndState) => pointOnSide(es.rect, es.side, es.pos)
  for (const list of pairs.values()) {
    if (list.length < 2) continue
    const aId = list[0].edge.source < list[0].edge.target ? list[0].edge.source : list[0].edge.target
    const endA = (st: EdgeState) => (st.source.nodeId === aId ? st.source : st.target)
    const endB = (st: EdgeState) => (st.source.nodeId === aId ? st.target : st.source)
    const byPos = (p: EdgeState, q: EdgeState) => endA(p).pos - endA(q).pos || p.rank - q.rank

    const lanes = new Map<string, EdgeState[]>()
    for (const st of list) {
      if (st.edge.curved || st.bends.length > 0 || OPPOSITE[st.source.side] !== st.target.side) continue
      const delta = endB(st).pos - endA(st).pos
      if (Math.abs(delta) <= 0.5) continue
      const k = `${endA(st).side}|${Math.sign(delta)}`
      lanes.set(k, [...(lanes.get(k) ?? []), st])
    }
    for (const group of lanes.values()) {
      const n = group.length
      if (n < 2) continue
      group.sort(byPos)
      const a = endA(group[0])
      const b = endB(group[0])
      const pa = portOf(a)
      const pb = portOf(b)
      const across = isVerticalSide(a.side) ? Math.abs(pb.x - pa.x) : Math.abs(pb.y - pa.y)
      const lane = Math.min(LANE_GAP, (across - 2 * LANE_MARGIN) / (n - 1))
      if (lane < 3) continue
      // Heading towards larger coordinates, the first end turns furthest out.
      const dir = Math.sign(b.pos - a.pos) * (isVerticalSide(a.side) ? NORMAL[a.side].x : NORMAL[a.side].y)
      group.forEach((st, i) => zShift.set(st, ((n - 1) / 2 - i) * lane * dir))
    }

    // U routes on one side: the widest goes outermost.
    const us = list.filter((st) => !st.edge.curved && st.bends.length === 0 && st.source.side === st.target.side)
    if (us.length > 1) {
      us.sort((p, q) => Math.abs(p.source.pos - p.target.pos) - Math.abs(q.source.pos - q.target.pos) || p.rank - q.rank)
      us.forEach((st, i) => zShift.set(st, i * LANE_GAP))
    }

    const curved = list.filter((st) => st.edge.curved).sort(byPos)
    const n = curved.length
    if (n < 2) continue
    curved.forEach((st, i) => {
      const a = portOf(endA(st))
      const b = portOf(endB(st))
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
      let perp = { x: -(b.y - a.y) / len, y: (b.x - a.x) / len }
      // Bow the way the ends are ordered along A's side.
      if ((isVerticalSide(endA(st).side) ? perp.y : perp.x) < 0) perp = { x: -perp.x, y: -perp.y }
      const off = i - (n - 1) / 2
      const uA = clamp(0.5 + off * LABEL_STAGGER, 0.25, 0.75)
      curves.set(st, {
        bow: { x: Math.round(perp.x * off * CURVE_BOW * 10) / 10, y: Math.round(perp.y * off * CURVE_BOW * 10) / 10 },
        labelAt: endA(st) === st.source ? uA : 1 - uA,
      })
    })
  }
  return { zShift, curves }
}

/**
 * Computes, for every edge whose two ends are known rects, where its ends
 * attach and its orthogonal route. `obstacles` are all node rects (routes
 * detour around them).
 */
export const computePortGeometry = (
  rects: Map<string, LayoutRect>,
  edges: PortEdgeInput[],
  obstacles: LayoutRect[] = [...rects.values()],
  shapes?: ReadonlyMap<string, NodeShape>
): Map<string, PortGeometry> => {
  const states: EdgeState[] = []
  // Self-loops per node, by edge id (independent of the edge order).
  const loopIndex = new Map<string, number>()
  const loopsPerNode = new Map<string, string[]>()
  for (const edge of edges) {
    if (edge.source !== edge.target) continue
    const list = loopsPerNode.get(edge.source) ?? []
    list.push(edge.id)
    loopsPerNode.set(edge.source, list)
  }
  for (const list of loopsPerNode.values()) {
    list.sort((p, q) => p.localeCompare(q)).forEach((id, k) => loopIndex.set(id, k))
  }
  for (const edge of edges) {
    const sRect = rects.get(edge.source)
    const tRect = rects.get(edge.target)
    if (!sRect || !tRect) continue
    const selfLoop = edge.source === edge.target
    const bends = selfLoop || edge.curved ? [] : userBends(edge, sRect, tRect)
    const mk = (end: "source" | "target", nodeId: string, rect: LayoutRect): EndState => ({
      edgeId: edge.id,
      end,
      nodeId,
      rect,
      shape: shapes?.get(nodeId),
      side: "top",
      pos: 0,
      pinned: false,
      auto: true,
      key: 0,
      tie: 0,
    })
    const st: EdgeState = {
      edge,
      sRect,
      tRect,
      bends,
      source: mk("source", edge.source, sRect),
      target: mk("target", edge.target, tRect),
      loop: selfLoop ? (loopIndex.get(edge.id) ?? 0) : 0,
      pair: [],
      rank: 0,
    }
    for (const es of [st.source, st.target]) {
      const port = readPort(es.end === "source" ? edge.data?.sourcePort : edge.data?.targetPort)
      if (port) {
        es.side = port.side
        es.pos = along(port.side, portPoint(es.rect, port))
        es.pinned = true
        es.auto = false
      }
    }
    if (selfLoop) {
      // Loop off the top-right corner unless pinned; further loops nest outside.
      const step = st.loop * LOOP_STEP
      const sy = Math.min(sRect.y + Math.min(LOOP_OFFSET, sRect.height * 0.3) + step, sRect.y + sRect.height)
      const tx = Math.max(sRect.x + sRect.width - Math.min(LOOP_OFFSET, sRect.width * 0.3) - step, sRect.x)
      if (st.source.auto) Object.assign(st.source, { side: "right", auto: false, pos: sy })
      if (st.target.auto) Object.assign(st.target, { side: "top", auto: false, pos: tx })
    }
    states.push(st)
  }

  const set = obstacleSet(obstacles)

  // Edges joining the same two nodes (either direction), in a stable order.
  const pairs = new Map<string, EdgeState[]>()
  for (const st of states) {
    const { source: a, target: b } = st.edge
    if (a === b) continue
    const k = a < b ? `${a}\n${b}` : `${b}\n${a}`
    const list = pairs.get(k) ?? []
    list.push(st)
    pairs.set(k, list)
  }
  for (const list of pairs.values()) {
    list.sort((p, q) => p.edge.id.localeCompare(q.edge.id))
    list.forEach((st, r) => {
      st.pair = list
      st.rank = r
    })
  }

  // Sides of ends that follow a bend, or face the other node.
  for (const st of states) {
    if (st.edge.source === st.edge.target) continue
    const free = st.source.auto && st.target.auto && st.bends.length === 0 && !st.edge.curved
    const facing = free
      ? roomySides(st.sRect, st.tRect, !!st.edge.preferVertical, st.pair.length)
      : chooseFacingSidesForRects(st.sRect, st.tRect)
    if (st.edge.curved && st.source.auto && st.target.auto) {
      // A curve cannot detour: take the side pair whose curve stays clear.
      const best = clearCurveSides(st.sRect, st.tRect, facing.sourceSide, facing.targetSide, set)
      st.source.side = best[0]
      st.target.side = best[1]
      st.source.key = along(best[0], centerOf(st.tRect))
      st.target.key = along(best[1], centerOf(st.sRect))
      continue
    }
    for (const es of [st.source, st.target]) {
      if (!es.auto) continue
      const other = es === st.source ? st.target : st.source
      if (st.bends.length > 0) {
        const bend = es === st.source ? st.bends[0] : st.bends[st.bends.length - 1]
        es.side = sideTowards(es.rect, bend) ?? es.side
        es.key = along(es.side, bend)
        const [a, b] = sideRange(es.rect, es.side)
        const m = cornerMargin(b - a, es.shape)
        if (es.key >= a + m && es.key <= b - m) {
          // The bend lines up with the side: attach straight under it.
          es.auto = false
          es.pos = es.key
        } else {
          es.straight = clamp(es.key, a + m, b - m)
        }
        continue
      }
      if (other.pinned) {
        const op = pointOnSide(other.rect, other.side, other.pos)
        es.side = sideTowards(es.rect, op) ?? (es === st.source ? facing.sourceSide : facing.targetSide)
        es.key = along(es.side, op)
      } else {
        es.side = es === st.source ? facing.sourceSide : facing.targetSide
        es.key = along(es.side, centerOf(other.rect))
      }
    }
  }

  splitDiamondCorners(states)

  // Same-pair ends share a key: order them so the edges do not cross (same
  // order on facing sides, outermost with outermost on perpendicular ones).
  for (const st of states) {
    if (st.edge.source === st.edge.target) continue
    const a = st.edge.source < st.edge.target ? st.source : st.target
    const b = a === st.source ? st.target : st.source
    a.tie = st.rank
    if (OPPOSITE[a.side] === b.side) {
      b.tie = st.rank
    } else {
      const dirA = Math.sign(along(a.side, centerOf(b.rect)) - along(a.side, centerOf(a.rect))) || 1
      const dirB = Math.sign(along(b.side, centerOf(a.rect)) - along(b.side, centerOf(b.rect))) || 1
      b.tie = st.rank * dirA * dirB
    }
  }

  // Straight-line opportunity for facing ends without bends.
  for (const st of states) {
    // Curves keep their spread ends (a straight line is not their shape).
    if (st.edge.source === st.edge.target || st.bends.length > 0 || st.edge.curved) continue
    const { source: s, target: t } = st
    if (OPPOSITE[s.side] !== t.side || !(s.auto || t.auto)) continue
    const [sa, sb] = sideRange(s.rect, s.side)
    const [ta, tb] = sideRange(t.rect, t.side)
    const sm = cornerMargin(sb - sa, s.shape)
    const tm = cornerMargin(tb - ta, t.shape)
    const lo = Math.max(sa + sm, ta + tm)
    const hi = Math.min(sb - sm, tb - tm)
    if (hi < lo) continue
    if (s.auto && t.auto) {
      // Straight siblings between the same two nodes spread over the overlap
      // together (spread per side, they ended a few px apart: stair-steps).
      const endOn = (o: EdgeState, nodeId: string) => (o.source.nodeId === nodeId ? o.source : o.target)
      const siblings = st.pair.filter((o) => {
        const os = endOn(o, s.nodeId)
        const ot = endOn(o, t.nodeId)
        return o.bends.length === 0 && os.auto && ot.auto && os.side === s.side && ot.side === t.side
      })
      const m = siblings.length
      const gap = m > 1 ? Math.min(MIN_PORT_GAP, (hi - lo) / (m - 1)) : 0
      if (m > 1 && gap < MIN_STRAIGHT_GAP) continue
      s.straight = t.straight = (lo + hi) / 2 + (siblings.indexOf(st) - (m - 1) / 2) * gap
      if (m > 1) s.bundle = t.bundle = st.pair
    } else if (s.auto && t.pos >= lo && t.pos <= hi) {
      s.straight = t.pos
    } else if (t.auto && s.pos >= lo && s.pos <= hi) {
      t.straight = s.pos
    }
  }

  // Spread auto ends per node side (two passes: the second lines facing
  // auto ends up with where their partner landed).
  const groups = new Map<
    string,
    { rect: LayoutRect; side: PortSide; shape?: NodeShape; ends: EndState[]; fixed: number[] }
  >()
  for (const st of states) {
    for (const es of [st.source, st.target]) {
      const k = `${es.nodeId}|${es.side}`
      let g = groups.get(k)
      if (!g) {
        g = { rect: es.rect, side: es.side, shape: es.shape, ends: [], fixed: [] }
        groups.set(k, g)
      }
      if (es.auto) g.ends.push(es)
      else g.fixed.push(es.pos)
    }
  }
  for (const g of groups.values()) spreadSide(g.ends, g.fixed, g.rect, g.side, g.shape)
  let changed = false
  for (const st of states) {
    const { source: s, target: t } = st
    if (s.auto && t.auto && s.straight !== undefined && t.straight !== undefined && Math.abs(s.pos - t.pos) > 0.5) {
      // Meet where the more constrained end landed if the other side allows it.
      const [ta, tb] = sideRange(t.rect, t.side)
      const [sa, sb] = sideRange(s.rect, s.side)
      const tm = cornerMargin(tb - ta, t.shape)
      const sm = cornerMargin(sb - sa, s.shape)
      if (s.pos >= ta + tm && s.pos <= tb - tm) t.straight = s.pos
      else if (t.pos >= sa + sm && t.pos <= sb - sm) s.straight = t.pos
      changed = true
    }
  }
  if (changed) for (const g of groups.values()) spreadSide(g.ends, g.fixed, g.rect, g.side, g.shape)

  const { zShift, curves } = bundleOffsets(pairs)

  // Routes.
  const out = new Map<string, PortGeometry>()
  for (const st of states) {
    const sp = pointOnSide(st.sRect, st.source.side, st.source.pos)
    const tp = pointOnSide(st.tRect, st.target.side, st.target.pos)
    let points: LayoutPoint[]
    if (st.edge.curved) {
      points = [sp, tp]
    } else if (st.edge.source === st.edge.target) {
      const n = NORMAL[st.source.side]
      const nt = NORMAL[st.target.side]
      const reach = LOOP_OFFSET + st.loop * LOOP_STEP
      const a = { x: sp.x + n.x * reach, y: sp.y + n.y * reach }
      const c = { x: tp.x + nt.x * reach, y: tp.y + nt.y * reach }
      // Turn outside the node: keep going along the source normal first.
      const corner = n.x !== 0 ? { x: a.x, y: c.y } : { x: c.x, y: a.y }
      points = simplifyOrthogonal(orthogonalize([sp, a, corner, c, tp]))
    } else if (st.bends.length > 0) {
      const first = st.bends[0]
      const last = st.bends[st.bends.length - 1]
      const head = elbowTo(sp, st.source.side, first)
      const tail = elbowTo(tp, st.target.side, last).reverse()
      points = simplifyOrthogonal(orthogonalize([sp, ...head, ...st.bends, ...tail, tp]))
    } else {
      points = routeBetweenPorts(sp, st.source.side, tp, st.target.side, st.sRect, st.tRect, set, zShift.get(st))
    }
    if (points.length < 2 || !samePoint(points[0], sp)) points = [sp, ...points]
    if (!samePoint(points[points.length - 1], tp)) points = [...points, tp]
    // Onto the real outline: each end moves inward along its side's normal,
    // in line with the route's perpendicular first / last segment.
    const so = st.source.shape ? outlinePoint(st.source.shape, st.sRect, st.source.side, st.source.pos) : sp
    const to = st.target.shape ? outlinePoint(st.target.shape, st.tRect, st.target.side, st.target.pos) : tp
    if (!samePoint(so, sp) || !samePoint(to, tp)) {
      points = st.edge.curved ? [so, to] : simplifyOrthogonal([so, ...points, to])
    }
    out.set(st.edge.id, {
      source: { x: so.x, y: so.y, side: st.source.side, pinned: st.source.pinned },
      target: { x: to.x, y: to.y, side: st.target.side, pinned: st.target.pinned },
      points: points.map((p) => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 })),
      hasBends: st.bends.length > 0,
      ...curves.get(st),
    })
  }
  return out
}

/** Facing-side handle ids for a new edge between two rects. */
export const facingHandleIds = (
  source: LayoutRect,
  target: LayoutRect
): { sourceHandle: string; targetHandle: string } => {
  if (source === target || (source.x === target.x && source.y === target.y && source.width === target.width)) {
    return { sourceHandle: sideHandleId("right"), targetHandle: sideHandleId("top") }
  }
  const { sourceSide, targetSide } = chooseFacingSidesForRects(source, target)
  return { sourceHandle: sideHandleId(sourceSide), targetHandle: sideHandleId(targetSide) }
}
