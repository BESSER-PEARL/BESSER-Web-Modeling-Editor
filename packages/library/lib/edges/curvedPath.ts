import { Position } from "@xyflow/react"
import type { IPoint } from "./Connection"
import { bezierControl, type PortSide } from "@/utils/edgePorts"

const NORMAL: Record<Position, IPoint> = {
  [Position.Top]: { x: 0, y: -1 },
  [Position.Bottom]: { x: 0, y: 1 },
  [Position.Left]: { x: -1, y: 0 },
  [Position.Right]: { x: 1, y: 0 },
}

export interface CurvedPath {
  path: string
  /** Point on the curve at `labelAt` (default half-way): label anchor. */
  label: IPoint
}

export interface CurvedPathParams {
  sourceX: number
  sourceY: number
  sourcePosition: Position
  targetX: number
  targetY: number
  targetPosition: Position
  selfLoop?: boolean
  /** Offset added to both control points (bows a curve away from its siblings). */
  bow?: IPoint
  /** Where the label sits along the curve, 0..1 from the source. */
  labelAt?: number
}

/** Point of a cubic bézier at `u`. */
const cubicAt = (p0: IPoint, p1: IPoint, p2: IPoint, p3: IPoint, u: number): IPoint => {
  const v = 1 - u
  return {
    x: v * v * v * p0.x + 3 * v * v * u * p1.x + 3 * v * u * u * p2.x + u * u * u * p3.x,
    y: v * v * v * p0.y + 3 * v * v * u * p1.y + 3 * v * u * u * p2.y + u * u * u * p3.y,
  }
}

/**
 * Bézier stroke for curved (agent) transitions: React Flow's bézier (same
 * control points), optionally bowed. A self-loop leaves and re-enters the
 * node outwards from its handles; React Flow's bézier would collapse into a
 * flat line along the border when both handles share a side.
 */
export const getCurvedPath = ({
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  selfLoop = false,
  bow,
  labelAt = 0.5,
}: CurvedPathParams): CurvedPath => {
  const s = { x: sourceX, y: sourceY }
  const t = { x: targetX, y: targetY }
  if (!selfLoop) {
    const c1 = bezierControl(s, sourcePosition as PortSide, t)
    const c2 = bezierControl(t, targetPosition as PortSide, s)
    if (bow) {
      c1.x += bow.x
      c1.y += bow.y
      c2.x += bow.x
      c2.y += bow.y
    }
    const path = `M${sourceX},${sourceY} C${c1.x},${c1.y} ${c2.x},${c2.y} ${targetX},${targetY}`
    return { path, label: cubicAt(s, c1, c2, t, labelAt) }
  }

  const ns = NORMAL[sourcePosition] ?? NORMAL[Position.Right]
  const nt = NORMAL[targetPosition] ?? NORMAL[Position.Top]
  const gap = Math.hypot(targetX - sourceX, targetY - sourceY)
  const reach = Math.min(140, 50 + gap * 0.35)
  const p1 = { x: sourceX + ns.x * reach, y: sourceY + ns.y * reach }
  const p2 = { x: targetX + nt.x * reach, y: targetY + nt.y * reach }
  if (gap < 1) {
    // Same handle: open the loop sideways so it has a width.
    const spread = reach * 0.6
    p1.x += -ns.y * spread
    p1.y += ns.x * spread
    p2.x -= -nt.y * spread
    p2.y -= nt.x * spread
  }
  const path = `M ${sourceX},${sourceY} C ${p1.x},${p1.y} ${p2.x},${p2.y} ${targetX},${targetY}`
  return { path, label: cubicAt(s, p1, p2, t, 0.5) }
}

/** Half height of a 12px middle label, and the clearance kept around it. */
const LABEL_HALF_HEIGHT = 8
const LABEL_CLEARANCE = 6

/**
 * Anchor of a centred label at `p` (on a curve from `s` to `t`) moved beside
 * the line when its box would reach the arrowhead (`markerLength` back from
 * `t`) or the source port: on a short edge the label sat on the arrow.
 */
export const labelClearOfEnds = (
  p: IPoint,
  s: IPoint,
  t: IPoint,
  labelWidth: number,
  markerLength: number
): IPoint => {
  const dx = t.x - s.x
  const dy = t.y - s.y
  const len = Math.hypot(dx, dy)
  if (len < 1) return p
  const ux = dx / len
  const uy = dy / len
  // Label half extent along / across the chord.
  const alongHalf = Math.abs(ux) * (labelWidth / 2) + Math.abs(uy) * LABEL_HALF_HEIGHT
  const toTarget = (t.x - p.x) * ux + (t.y - p.y) * uy
  const fromSource = (p.x - s.x) * ux + (p.y - s.y) * uy
  if (toTarget >= alongHalf + markerLength + LABEL_CLEARANCE && fromSource >= alongHalf + LABEL_CLEARANCE) return p
  // Beside the line: right of a vertical chord, above a horizontal one.
  let nx = -uy
  let ny = ux
  if (nx < -0.01 || (Math.abs(nx) <= 0.01 && ny > 0)) {
    nx = -nx
    ny = -ny
  }
  const acrossHalf = Math.abs(nx) * (labelWidth / 2) + Math.abs(ny) * LABEL_HALF_HEIGHT
  const d = acrossHalf + LABEL_CLEARANCE
  return { x: p.x + nx * d, y: p.y + ny * d }
}

/** Side a polyline leaves `p` through, towards `q` (its first segment). */
const sideTowards = (p: IPoint, q: IPoint): Position | undefined => {
  const dx = q.x - p.x
  const dy = q.y - p.y
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return undefined
  return Math.abs(dx) >= Math.abs(dy)
    ? dx > 0
      ? Position.Right
      : Position.Left
    : dy > 0
      ? Position.Bottom
      : Position.Top
}

/**
 * Curve parameters for a floating edge: its two ends on the node outlines and
 * the sides they leave through. `points` are the live ends (the reconnect
 * preview while an end is dragged, whose end segments give the sides).
 */
export const curveEnds = (
  points: IPoint[],
  floating: { source: { side: string }; target: { side: string }; bow?: IPoint; labelAt?: number },
  selfLoop: boolean
): CurvedPathParams => {
  const s = points[0]
  const t = points[points.length - 1]
  const preview = points.length > 2
  return {
    sourceX: s.x,
    sourceY: s.y,
    sourcePosition: (preview && sideTowards(s, points[1])) || (floating.source.side as Position),
    targetX: t.x,
    targetY: t.y,
    targetPosition: (preview && sideTowards(t, points[points.length - 2])) || (floating.target.side as Position),
    selfLoop,
    // A dragged end has left its bundle.
    bow: preview ? undefined : floating.bow,
    labelAt: preview ? undefined : floating.labelAt,
  }
}
