import { useStore, type InternalNode } from "@xyflow/react"
import { IPoint } from "../Connection"
import {
  estimateMiddleLabelWidth,
  placeMiddleLabel,
  type LabelRect,
} from "./middleLabelPlacement"
import { internalNodeRect } from "@/utils/nodeShapes"

interface EdgeMiddleLabelsProps {
  label?: string | null
  pathMiddlePosition: IPoint
  isMiddlePathHorizontal: boolean
  sourcePoint?: IPoint
  targetPoint?: IPoint
  showRelationshipLabels?: boolean
  isUseCasePath?: boolean
  isPetriNet?: boolean // New prop to identify PetriNet edges
  textColor: string
  /** Route points: the label goes on a segment that can hold it, clear of nodes. */
  points?: IPoint[]
  /** Centre the label on `pathMiddlePosition` (curved edges). */
  centered?: boolean
}

/** Labels longer than this are cut with an ellipsis; the full text is the tooltip. */
export const MAX_MIDDLE_LABEL_CHARS = 32

export const truncateLabel = (label: string, max = MAX_MIDDLE_LABEL_CHARS) =>
  label.length > max ? `${label.slice(0, max - 1).trimEnd()}…` : label

const nodeRects = (
  lookup: ReadonlyMap<string, InternalNode>
): LabelRect[] =>
  [...lookup.values()].filter((n) => !n.hidden).map(internalNodeRect)

export const EdgeMiddleLabels = ({
  label,
  pathMiddlePosition,
  isMiddlePathHorizontal,
  sourcePoint,
  targetPoint,
  showRelationshipLabels = false,
  isUseCasePath = false,
  isPetriNet = false,
  textColor,
  points,
  centered = false,
}: EdgeMiddleLabelsProps) => {
  const nodeLookup = useStore((state) => state.nodeLookup)

  if (isPetriNet && label === "1") return null

  if (!label || !showRelationshipLabels) return null

  // Calculate position and rotation for the label
  let x: number
  let y: number
  let rotation = 0
  let textAnchor: "start" | "middle" | "end" = "middle"
  let dominantBaseline: "auto" | "middle" | "hanging" = "middle"

  if (isUseCasePath && sourcePoint && targetPoint) {
    const dx = targetPoint.x - sourcePoint.x
    const dy = targetPoint.y - sourcePoint.y
    const angle = Math.atan2(dy, dx) * (180 / Math.PI)
    rotation = angle > 90 || angle < -90 ? angle + 180 : angle

    const offsetDistance = 15
    const perpX = -dy
    const perpY = dx
    const perpLength = Math.sqrt(perpX * perpX + perpY * perpY)

    if (perpLength > 0) {
      const normalizedPerpX = perpX / perpLength
      const normalizedPerpY = perpY / perpLength
      x = (sourcePoint.x + targetPoint.x) / 2 + normalizedPerpX * offsetDistance
      y = (sourcePoint.y + targetPoint.y) / 2 + normalizedPerpY * offsetDistance
    } else {
      x = (sourcePoint.x + targetPoint.x) / 2
      y = (sourcePoint.y + targetPoint.y) / 2
    }
  } else if (centered) {
    // The halo keeps the text readable on top of the stroke.
    x = pathMiddlePosition.x
    y = pathMiddlePosition.y
  } else {
    const placement =
      points && points.length >= 2
        ? placeMiddleLabel(
            points,
            estimateMiddleLabelWidth(truncateLabel(label)),
            nodeRects(nodeLookup)
          )
        : null
    const LABEL_GAP = 10
    if (placement) {
      ;({ x, y, textAnchor, dominantBaseline } = placement)
    } else if (isMiddlePathHorizontal) {
      // Horizontal edge: place label above the line
      x = pathMiddlePosition.x
      y = pathMiddlePosition.y - LABEL_GAP
      dominantBaseline = "auto"
    } else {
      // Vertical edge: place label to the left of the line with gap
      x = pathMiddlePosition.x - LABEL_GAP
      y = pathMiddlePosition.y
      textAnchor = "end"
    }
  }

  const shown = truncateLabel(label)

  return (
    <text
      x={x}
      y={y}
      textAnchor={textAnchor}
      dominantBaseline={dominantBaseline}
      style={{
        fontSize: "12px",
        fontWeight: 700,
        fill: textColor,
        userSelect: "none",
        // Clicks bubble to the React Flow edge: select / double-click to edit.
        pointerEvents: "visiblePainted",
        cursor: "pointer",
      }}
      transform={rotation !== 0 ? `rotate(${rotation} ${x} ${y})` : undefined}
      className="besser-edge-label besser-edge-middle-label nodrag nopan"
      data-testid="edge-middle-label"
    >
      {shown !== label && <title>{label}</title>}
      {shown}
    </text>
  )
}
