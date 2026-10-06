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
import { routeOrthogonalEdges, simplifyOrthogonal } from "./orthogonalRouter"

export type PortSide = HandleSide

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
  data?: {
    points?: LayoutPoint[] | null
    sourcePort?: unknown
    targetPort?: unknown
  } | null
}

export interface PortGeometry {
  source: PortEnd
  target: PortEnd
  /** Full orthogonal polyline, source port → target port. */
  points: LayoutPoint[]
  /** Whether the route keeps stored user bends. */
  hasBends: boolean
}

const SIDES: readonly PortSide[] = ["top", "right", "bottom", "left"]
/** Length of the perpendicular stub a route leaves a port with. */
export const PORT_STUB = 20
/** Minimum distance between two ends spread on the same side. */
const MIN_PORT_GAP = 22
/** Corner clearance kept free of auto ends. */
const cornerMargin = (len: number) => Math.min(14, len * 0.2)

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
  ts: PortSide
): LayoutPoint[] | undefined => {
  const ns = NORMAL[ss]
  const nt = NORMAL[ts]
  if (OPPOSITE[ss] === ts) {
    // Facing: the target must lie ahead of the source.
    if (isVerticalSide(ss)) {
      if ((t.x - s.x) * ns.x <= 0) return undefined
      if (Math.abs(s.y - t.y) < 0.5) return [s, { x: t.x, y: s.y }]
      const mx = (s.x + t.x) / 2
      return [s, { x: mx, y: s.y }, { x: mx, y: t.y }, t]
    }
    if ((t.y - s.y) * ns.y <= 0) return undefined
    if (Math.abs(s.x - t.x) < 0.5) return [s, { x: s.x, y: t.y }]
    const my = (s.y + t.y) / 2
    return [s, { x: s.x, y: my }, { x: t.x, y: my }, t]
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

/** Auto route between two ports, detouring around other nodes when needed. */
export const routeBetweenPorts = (
  s: LayoutPoint,
  ss: PortSide,
  t: LayoutPoint,
  ts: PortSide,
  sRect: LayoutRect,
  tRect: LayoutRect,
  obstacles: LayoutRect[]
): LayoutPoint[] => {
  // Obstacles near the route only (keeps the router grid tiny), never a
  // container of either end.
  const pad = 160
  const bx0 = Math.min(s.x, t.x) - pad
  const bx1 = Math.max(s.x, t.x) + pad
  const by0 = Math.min(s.y, t.y) - pad
  const by1 = Math.max(s.y, t.y) + pad
  const others = obstacles.filter(
    (r) =>
      r !== sRect &&
      r !== tRect &&
      !containsRect(r, sRect) &&
      !containsRect(r, tRect) &&
      r.x < bx1 &&
      r.x + r.width > bx0 &&
      r.y < by1 &&
      r.y + r.height > by0
  )
  const simple = simpleRoute(s, ss, t, ts)
  if (simple && !routeCrosses(simple, others)) return simplifyOrthogonal(simple)
  const ends = containsRect(sRect, tRect) || containsRect(tRect, sRect) ? [] : [sRect, tRect]
  const routed = routeOrthogonalEdges([...ends, ...others], [
    { id: "r", source: { point: s, side: ss }, target: { point: t, side: ts } },
  ]).get("r")
  return routed && routed.length >= 2 ? routed : simplifyOrthogonal(orthogonalize([s, t]))
}

// ---------------------------------------------------------------------------
// Port assignment
// ---------------------------------------------------------------------------

interface EndState {
  edgeId: string
  end: "source" | "target"
  nodeId: string
  rect: LayoutRect
  side: PortSide
  /** Assigned axis coordinate (fixed ends: final; auto ends: after spreading). */
  pos: number
  pinned: boolean
  auto: boolean
  /** Ordering key along the side (where the other end is). */
  key: number
  /** Axis coordinate that would make the edge straight, when there is one. */
  straight?: number
}

interface EdgeState {
  edge: PortEdgeInput
  sRect: LayoutRect
  tRect: LayoutRect
  bends: LayoutPoint[]
  source: EndState
  target: EndState
}

const isInside = (r: LayoutRect, p: LayoutPoint) =>
  p.x > r.x + 1 && p.x < r.x + r.width - 1 && p.y > r.y + 1 && p.y < r.y + r.height - 1

/** Interior stored points, or [] when there are none or they are invalid. */
const userBends = (edge: PortEdgeInput, sRect: LayoutRect, tRect: LayoutRect): LayoutPoint[] => {
  const pts = edge.data?.points
  if (!Array.isArray(pts) || pts.length < 3) return []
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

/** Spreads the auto ends of one node side; fixed ends are obstacles. */
const spreadSide = (ends: EndState[], fixed: number[], rect: LayoutRect, side: PortSide) => {
  const [a, b] = sideRange(rect, side)
  const m = cornerMargin(b - a)
  const lo = a + m
  const hi = b - m
  ends.sort((p, q) => p.key - q.key || (p.edgeId + p.end).localeCompare(q.edgeId + q.end))
  const n = ends.length
  const gap = n > 1 ? Math.min(MIN_PORT_GAP, (hi - lo) / (n - 1)) : 0
  const pos = ends.map((e, i) =>
    e.straight !== undefined ? clamp(e.straight, lo, hi) : lo + ((hi - lo) * (i + 1)) / (n + 1)
  )
  for (let i = 1; i < n; i++) pos[i] = Math.max(pos[i], pos[i - 1] + gap)
  if (n > 0) pos[n - 1] = Math.min(pos[n - 1], hi)
  for (let i = n - 2; i >= 0; i--) pos[i] = Math.min(pos[i], pos[i + 1] - gap)
  for (let i = 0; i < n; i++) pos[i] = Math.max(pos[i], lo)
  // Keep clear of pinned / bend-anchored ends on the same side.
  const clear = Math.max(gap, 12)
  for (let i = 0; i < n; i++) {
    for (const f of fixed) {
      if (Math.abs(pos[i] - f) < clear) {
        const up = f + clear
        const down = f - clear
        pos[i] = up <= hi && (down < lo || Math.abs(up - pos[i]) <= Math.abs(down - pos[i])) ? up : Math.max(lo, down)
      }
    }
    ends[i].pos = pos[i]
  }
}

/**
 * Computes, for every edge whose two ends are known rects, where its ends
 * attach and its orthogonal route. `obstacles` are all node rects (routes
 * detour around them).
 */
export const computePortGeometry = (
  rects: Map<string, LayoutRect>,
  edges: PortEdgeInput[],
  obstacles: LayoutRect[] = [...rects.values()]
): Map<string, PortGeometry> => {
  const states: EdgeState[] = []
  for (const edge of edges) {
    const sRect = rects.get(edge.source)
    const tRect = rects.get(edge.target)
    if (!sRect || !tRect) continue
    const selfLoop = edge.source === edge.target
    const bends = selfLoop ? [] : userBends(edge, sRect, tRect)
    const mk = (end: "source" | "target", nodeId: string, rect: LayoutRect): EndState => ({
      edgeId: edge.id,
      end,
      nodeId,
      rect,
      side: "top",
      pos: 0,
      pinned: false,
      auto: true,
      key: 0,
    })
    const st: EdgeState = {
      edge,
      sRect,
      tRect,
      bends,
      source: mk("source", edge.source, sRect),
      target: mk("target", edge.target, tRect),
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
      // Loop off the top-right corner unless pinned.
      if (st.source.auto) Object.assign(st.source, { side: "right", auto: false, pos: sRect.y + Math.min(30, sRect.height * 0.3) })
      if (st.target.auto) Object.assign(st.target, { side: "top", auto: false, pos: sRect.x + sRect.width - Math.min(30, sRect.width * 0.3) })
    }
    states.push(st)
  }

  // Sides of ends that follow a bend, or face the other node.
  for (const st of states) {
    if (st.edge.source === st.edge.target) continue
    const facing = chooseFacingSidesForRects(st.sRect, st.tRect)
    for (const es of [st.source, st.target]) {
      if (!es.auto) continue
      const other = es === st.source ? st.target : st.source
      if (st.bends.length > 0) {
        const bend = es === st.source ? st.bends[0] : st.bends[st.bends.length - 1]
        es.side = sideTowards(es.rect, bend) ?? es.side
        es.key = along(es.side, bend)
        const [a, b] = sideRange(es.rect, es.side)
        const m = cornerMargin(b - a)
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
    // Straight-line opportunity for facing ends without bends.
    if (st.bends.length === 0) {
      const { source: s, target: t } = st
      if (OPPOSITE[s.side] === t.side && (s.auto || t.auto)) {
        const [sa, sb] = sideRange(s.rect, s.side)
        const [ta, tb] = sideRange(t.rect, t.side)
        const sm = cornerMargin(sb - sa)
        const tm = cornerMargin(tb - ta)
        const lo = Math.max(sa + sm, ta + tm)
        const hi = Math.min(sb - sm, tb - tm)
        if (hi >= lo) {
          if (s.auto && t.auto) {
            s.straight = t.straight = (lo + hi) / 2
          } else if (s.auto && t.pos >= lo && t.pos <= hi) {
            s.straight = t.pos
          } else if (t.auto && s.pos >= lo && s.pos <= hi) {
            t.straight = s.pos
          }
        }
      }
    }
  }

  // Spread auto ends per node side (two passes: the second lines facing
  // auto ends up with where their partner landed).
  const groups = new Map<string, { rect: LayoutRect; side: PortSide; ends: EndState[]; fixed: number[] }>()
  for (const st of states) {
    for (const es of [st.source, st.target]) {
      const k = `${es.nodeId}|${es.side}`
      let g = groups.get(k)
      if (!g) {
        g = { rect: es.rect, side: es.side, ends: [], fixed: [] }
        groups.set(k, g)
      }
      if (es.auto) g.ends.push(es)
      else g.fixed.push(es.pos)
    }
  }
  for (const g of groups.values()) spreadSide(g.ends, g.fixed, g.rect, g.side)
  let changed = false
  for (const st of states) {
    const { source: s, target: t } = st
    if (s.auto && t.auto && s.straight !== undefined && t.straight !== undefined && Math.abs(s.pos - t.pos) > 0.5) {
      // Meet where the more constrained end landed if the other side allows it.
      const [ta, tb] = sideRange(t.rect, t.side)
      const [sa, sb] = sideRange(s.rect, s.side)
      if (s.pos >= ta + cornerMargin(tb - ta) && s.pos <= tb - cornerMargin(tb - ta)) t.straight = s.pos
      else if (t.pos >= sa + cornerMargin(sb - sa) && t.pos <= sb - cornerMargin(sb - sa)) s.straight = t.pos
      changed = true
    }
  }
  if (changed) for (const g of groups.values()) spreadSide(g.ends, g.fixed, g.rect, g.side)

  // Routes.
  const out = new Map<string, PortGeometry>()
  for (const st of states) {
    const sp = pointOnSide(st.sRect, st.source.side, st.source.pos)
    const tp = pointOnSide(st.tRect, st.target.side, st.target.pos)
    let points: LayoutPoint[]
    if (st.edge.source === st.edge.target) {
      const n = NORMAL[st.source.side]
      const nt = NORMAL[st.target.side]
      const a = { x: sp.x + n.x * 30, y: sp.y + n.y * 30 }
      const c = { x: tp.x + nt.x * 30, y: tp.y + nt.y * 30 }
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
      points = routeBetweenPorts(sp, st.source.side, tp, st.target.side, st.sRect, st.tRect, obstacles)
    }
    if (points.length < 2 || !samePoint(points[0], sp)) points = [sp, ...points]
    if (!samePoint(points[points.length - 1], tp)) points = [...points, tp]
    out.set(st.edge.id, {
      source: { x: sp.x, y: sp.y, side: st.source.side, pinned: st.source.pinned },
      target: { x: tp.x, y: tp.y, side: st.target.side, pinned: st.target.pinned },
      points: points.map((p) => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 })),
      hasBends: st.bends.length > 0,
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
