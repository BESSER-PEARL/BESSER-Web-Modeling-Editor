import { getBezierPath, Position } from "@xyflow/react"
import type { IPoint } from "./Connection"

const NORMAL: Record<Position, IPoint> = {
  [Position.Top]: { x: 0, y: -1 },
  [Position.Bottom]: { x: 0, y: 1 },
  [Position.Left]: { x: -1, y: 0 },
  [Position.Right]: { x: 1, y: 0 },
}

export interface CurvedPath {
  path: string
  /** Point on the curve half-way along it (label anchor). */
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
}

/**
 * Bézier stroke for curved (agent) transitions. A self-loop leaves and
 * re-enters the node outwards from its handles; React Flow's bézier would
 * collapse into a flat line along the border when both handles share a side.
 */
export const getCurvedPath = ({
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  selfLoop = false,
}: CurvedPathParams): CurvedPath => {
  if (!selfLoop) {
    const [path, labelX, labelY] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    })
    return { path, label: { x: labelX, y: labelY } }
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
  // Cubic bézier at t = 0.5.
  const label = {
    x: (sourceX + 3 * p1.x + 3 * p2.x + targetX) / 8,
    y: (sourceY + 3 * p1.y + 3 * p2.y + targetY) / 8,
  }
  return { path, label }
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
  floating: { source: { side: string }; target: { side: string } },
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
  }
}
