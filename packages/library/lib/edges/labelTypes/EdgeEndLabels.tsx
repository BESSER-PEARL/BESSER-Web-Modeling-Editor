import { useMemo } from "react"
import { calculateDynamicEdgeLabels } from "@/utils/edgeUtils"
import { IPoint } from "../Connection"
import { useClassNotation } from "@/store/settingsStore"
import { toERCardinality } from "@/utils/multiplicity"

interface EdgeEndLabelsProps {
  data?: {
    sourceRole?: string | null
    targetRole?: string | null
    sourceMultiplicity?: string | null
    targetMultiplicity?: string | null
  }

  activePoints: IPoint[]
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  sourcePosition: string
  targetPosition: string
  textColor?: string
  /** How far the end marker reaches back along the line; the end's labels start just past it. */
  sourceMarkerLength?: number
  targetMarkerLength?: number
}

const HANDLE_DIRECTION: Record<string, IPoint> = {
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

/** Moves `from` by `length` towards `towards` (or along the handle's outward direction). */
const pastMarker = (
  from: IPoint,
  length: number,
  towards?: IPoint,
  position?: string
): IPoint => {
  if (!length) return from
  let dx = towards ? towards.x - from.x : HANDLE_DIRECTION[position ?? ""]?.x ?? 0
  let dy = towards ? towards.y - from.y : HANDLE_DIRECTION[position ?? ""]?.y ?? 0
  const norm = Math.hypot(dx, dy)
  if (!norm) return from
  dx /= norm
  dy /= norm
  return { x: from.x + dx * (length + 1), y: from.y + dy * (length + 1) }
}

export const EdgeEndLabels = ({
  data,
  activePoints,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  textColor = "var(--besser-primary-contrast, #000000)",
  sourceMarkerLength = 0,
  targetMarkerLength = 0,
}: EdgeEndLabelsProps) => {
  const sourceLabels = useMemo(() => {
    if (activePoints.length < 2) {
      const anchor = pastMarker(
        { x: sourceX, y: sourceY },
        sourceMarkerLength,
        undefined,
        sourcePosition
      )
      return calculateDynamicEdgeLabels(anchor.x, anchor.y, sourcePosition)
    }

    const sourcePoint = activePoints[0]
    const nextPoint = activePoints[1]
    const deltaX = nextPoint.x - sourcePoint.x
    const deltaY = nextPoint.y - sourcePoint.y

    let direction: string
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      direction = deltaX > 0 ? "right" : "left"
    } else {
      direction = deltaY > 0 ? "bottom" : "top"
    }
    const anchor = pastMarker(sourcePoint, sourceMarkerLength, nextPoint)
    return calculateDynamicEdgeLabels(anchor.x, anchor.y, direction)
  }, [activePoints, sourceX, sourceY, sourcePosition, sourceMarkerLength])

  const targetLabels = useMemo(() => {
    if (activePoints.length < 2) {
      const anchor = pastMarker(
        { x: targetX, y: targetY },
        targetMarkerLength,
        undefined,
        targetPosition
      )
      return calculateDynamicEdgeLabels(anchor.x, anchor.y, targetPosition)
    }

    const targetPoint = activePoints[activePoints.length - 1]
    const previousPoint = activePoints[activePoints.length - 2]
    const anchor = pastMarker(targetPoint, targetMarkerLength, previousPoint)
    return calculateDynamicEdgeLabels(anchor.x, anchor.y, targetPosition)
  }, [activePoints, targetX, targetY, targetPosition, targetMarkerLength])

  // Re-render multiplicities in the active notation. Data is always
  // stored in canonical UML "1..*" form; ER mode displays as "(1,N)".
  const classNotation = useClassNotation()
  const sourceMultiplicityDisplay =
    classNotation === "ER"
      ? toERCardinality(data?.sourceMultiplicity ?? undefined)
      : data?.sourceMultiplicity
  const targetMultiplicityDisplay =
    classNotation === "ER"
      ? toERCardinality(data?.targetMultiplicity ?? undefined)
      : data?.targetMultiplicity

  return (
    <>
      {/* Source Role Label */}
      {data?.sourceRole && (
        <text
          x={sourceLabels.roleX}
          y={sourceLabels.roleY}
          textAnchor={sourceLabels.roleTextAnchor}
          style={{
            fontSize: "16px",
            fill: textColor,
            userSelect: "none",
          }}
        >
          {data.sourceRole}
        </text>
      )}

      {/* Source Multiplicity Label */}
      {sourceMultiplicityDisplay && (
        <text
          x={sourceLabels.multiplicityX}
          y={sourceLabels.multiplicityY}
          textAnchor={sourceLabels.multiplicityTextAnchor}
          style={{
            fontSize: "16px",
            fill: textColor,
            userSelect: "none",
          }}
        >
          {sourceMultiplicityDisplay}
        </text>
      )}

      {/* Target Role Label */}
      {data?.targetRole && (
        <text
          x={targetLabels.roleX}
          y={targetLabels.roleY}
          textAnchor={targetLabels.roleTextAnchor}
          style={{
            fontSize: "16px",
            fill: textColor,
            userSelect: "none",
          }}
        >
          {data.targetRole}
        </text>
      )}

      {/* Target Multiplicity Label */}
      {targetMultiplicityDisplay && (
        <text
          x={targetLabels.multiplicityX}
          y={targetLabels.multiplicityY}
          textAnchor={targetLabels.multiplicityTextAnchor}
          style={{
            fontSize: "16px",
            fill: textColor,
            userSelect: "none",
          }}
        >
          {targetMultiplicityDisplay}
        </text>
      )}
    </>
  )
}
