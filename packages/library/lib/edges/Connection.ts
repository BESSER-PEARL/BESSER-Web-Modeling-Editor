// connection.ts
/**
 * This file provides a simplified connection path computation.
 * It calculates port positions based solely on a node's width and height.
 */

import { EDGES, INTERFACE } from "@/constants"
import { Position } from "@xyflow/react"

export interface IPoint {
  x: number
  y: number
}

export interface NodeBounds {
  x: number
  y: number
  width: number
  height: number
}

export function getPortsForElement(
  bounds: NodeBounds
): Record<Position, IPoint> {
  return {
    [Position.Top]: { x: bounds.width / 2, y: 0 },
    [Position.Right]: { x: bounds.width, y: bounds.height / 2 },
    [Position.Bottom]: { x: bounds.width / 2, y: bounds.height },
    [Position.Left]: { x: 0, y: bounds.height / 2 },
  }
}

export function computeOverlap(
  range1: [number, number],
  range2: [number, number]
): [number, number] | null {
  const [from1, to1] = range1
  const [from2, to2] = range2

  const largerFrom = Math.max(from1, from2)
  const smallerTo = Math.min(to1, to2)

  return largerFrom <= smallerTo ? [largerFrom, smallerTo] : null
}

export function pointsToSvgPath(points: IPoint[]): string {
  if (points.length === 0) return ""
  // Round coordinates to whole pixels for pixel-perfect rendering
  const pathCommands = [
    `M ${Math.round(points[0].x)} ${Math.round(points[0].y)}`,
  ]

  for (let i = 1; i < points.length; i++) {
    pathCommands.push(`L ${Math.round(points[i].x)} ${Math.round(points[i].y)}`)
  }
  return pathCommands.join(" ")
}

/**
 * Render a point sequence as a smooth Catmull-Rom spline (cubic béziers
 * through every point) instead of straight segments. Used by the Agent
 * diagram so transitions read as flowing connections — no sharp right
 * angles — matching the agent flow-card nodes. Falls back to a straight
 * path for fewer than 3 points.
 */
export function pointsToSmoothSvgPath(points: IPoint[]): string {
  if (points.length < 3) return pointsToSvgPath(points)
  const p = points
  const d: string[] = [`M ${Math.round(p[0].x)} ${Math.round(p[0].y)}`]
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i]
    const p1 = p[i]
    const p2 = p[i + 1]
    const p3 = p[i + 2] ?? p[i + 1]
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d.push(
      `C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ` +
        `${cp2x.toFixed(1)} ${cp2y.toFixed(1)} ` +
        `${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
    )
  }
  return d.join(" ")
}
export function tryFindStraightPath(
  source: {
    position: { x: number; y: number }
    width: number
    height: number
    direction: Position
  },
  target: {
    position: { x: number; y: number }
    width: number
    height: number
    direction: Position
  },
  targetPadding: number,
  handleCoords?: {
    sourceX: number
    sourceY: number
    targetX: number
    targetY: number
  }
): IPoint[] | null {
  // Offset determines how far the straight path extends:
  // - Standard markers (MARKER_PADDING = -3): no extra offset
  // - Interface markers (padding = -INTERFACE.RADIUS = -15): offset by interface radius
  // - Other cases: default offset
  const offset =
    targetPadding === EDGES.MARKER_PADDING
      ? 0
      : targetPadding === -INTERFACE.RADIUS
        ? INTERFACE.RADIUS
        : 15
  const OVERLAP_THRESHOLD = 40

  // Maximum allowed misalignment (in pixels) between actual handle positions
  // on the axis perpendicular to the path direction. If handles are offset
  // more than this (e.g. "right-top" vs "left-bottom"), a straight 2-point
  // path would render as a diagonal, so we bail out and let the caller use
  // getSmoothStepPath which produces proper orthogonal bends.
  const HANDLE_ALIGNMENT_TOLERANCE = 10

  const sourceHandleEdge = source.direction
  const targetHandleEdge = target.direction

  // Right -> Left case
  if (
    sourceHandleEdge === Position.Right &&
    targetHandleEdge === Position.Left &&
    target.position.x >= source.position.x + source.width
  ) {
    // If actual handle Y-coordinates are misaligned, skip straight path
    if (
      handleCoords &&
      Math.abs(handleCoords.sourceY - handleCoords.targetY) >
        HANDLE_ALIGNMENT_TOLERANCE
    ) {
      return null
    }

    const overlapY = computeOverlap(
      [
        source.position.y,
        source.position.y + Math.max(OVERLAP_THRESHOLD, source.height),
      ],
      [
        target.position.y,
        target.position.y + Math.max(OVERLAP_THRESHOLD, target.height),
      ]
    )

    if (overlapY !== null && overlapY[1] - overlapY[0] >= OVERLAP_THRESHOLD) {
      const middleY = (overlapY[0] + overlapY[1]) / 2
      const start: IPoint = {
        x: source.position.x + source.width,
        y: middleY,
      }
      const end: IPoint = {
        x: target.position.x - offset,
        y: middleY,
      }
      return [start, end]
    }
  }

  // Left -> Right case
  if (
    sourceHandleEdge === Position.Left &&
    targetHandleEdge === Position.Right &&
    source.position.x >= target.position.x + target.width
  ) {
    // If actual handle Y-coordinates are misaligned, skip straight path
    if (
      handleCoords &&
      Math.abs(handleCoords.sourceY - handleCoords.targetY) >
        HANDLE_ALIGNMENT_TOLERANCE
    ) {
      return null
    }

    const overlapY = computeOverlap(
      [
        source.position.y,
        source.position.y + Math.max(OVERLAP_THRESHOLD, source.height),
      ],
      [
        target.position.y,
        target.position.y + Math.max(OVERLAP_THRESHOLD, target.height),
      ]
    )

    if (overlapY !== null && overlapY[1] - overlapY[0] >= OVERLAP_THRESHOLD) {
      const middleY = (overlapY[0] + overlapY[1]) / 2
      const start: IPoint = {
        x: source.position.x,
        y: middleY,
      }

      const end: IPoint = {
        x: target.position.x + target.width + offset,
        y: middleY,
      }
      return [start, end]
    }
  }

  // Bottom -> Top case
  if (
    sourceHandleEdge === Position.Bottom &&
    targetHandleEdge === Position.Top &&
    target.position.y >= source.position.y + source.height
  ) {
    // If actual handle X-coordinates are misaligned, skip straight path
    if (
      handleCoords &&
      Math.abs(handleCoords.sourceX - handleCoords.targetX) >
        HANDLE_ALIGNMENT_TOLERANCE
    ) {
      return null
    }

    const overlapX = computeOverlap(
      [source.position.x, source.position.x + source.width],
      [target.position.x, target.position.x + target.width]
    )

    if (overlapX !== null && overlapX[1] - overlapX[0] >= OVERLAP_THRESHOLD) {
      const middleX = (overlapX[0] + overlapX[1]) / 2
      const start: IPoint = {
        x: middleX,
        y: source.position.y + source.height,
      }

      const end: IPoint = {
        x: middleX,
        y: target.position.y - offset,
      }
      return [start, end]
    }
  }

  // Top -> Bottom case
  if (
    sourceHandleEdge === Position.Top &&
    targetHandleEdge === Position.Bottom &&
    source.position.y >= target.position.y + target.height
  ) {
    // If actual handle X-coordinates are misaligned, skip straight path
    if (
      handleCoords &&
      Math.abs(handleCoords.sourceX - handleCoords.targetX) >
        HANDLE_ALIGNMENT_TOLERANCE
    ) {
      return null
    }

    const overlapX = computeOverlap(
      [source.position.x, source.position.x + source.width],
      [target.position.x, target.position.x + target.width]
    )

    if (overlapX !== null && overlapX[1] - overlapX[0] >= OVERLAP_THRESHOLD) {
      const middleX = (overlapX[0] + overlapX[1]) / 2
      const start: IPoint = {
        x: middleX,
        y: source.position.y,
      }

      const end: IPoint = {
        x: middleX,
        y: target.position.y + target.height + offset,
      }
      return [start, end]
    }
  }

  return null
}
