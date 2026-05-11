import { NodeProps, NodeResizer, type Node } from "@xyflow/react"
import { useRef } from "react"
import { DefaultNodeWrapper } from "../wrappers"
import { useDiagramModifiable } from "@/hooks/useDiagramModifiable"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import { NodeToolbar } from "@/components/toolbars/NodeToolbar"
import { AgentRagElementNodeProps } from "@/types"
import { LAYOUT } from "@/constants"
import { getCustomColorsFromData } from "@/utils/layoutUtils"

/**
 * `AgentRagElement`. Cylinder-shaped database element. Mirrors v3
 * source at `agent-state-diagram/agent-rag-element/agent-rag-element-component.tsx`.
 *
 * The standalone RAG element is now name-only — the
 * DB-mode fields (`ragDatabaseName`, `dbCustomName`, `dbSelectionType`,
 * `dbQueryMode`, `dbOperation`, `dbSqlQuery`) were removed from this
 * node's typed shape. Those settings belong to the AgentState
 * `db_reply` reply mode (see `AgentStateEditPanel.tsx`). The cylinder
 * now renders only `data.name`.
 */
export function AgentRagElement({
  id,
  width,
  height,
  data,
}: NodeProps<Node<AgentRagElementNodeProps>>) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const isDiagramModifiable = useDiagramModifiable()

  if (!width || !height) return null

  const { fillColor, strokeColor, textColor } = getCustomColorsFromData(data)
  const { name } = data

  // Surface only the node `name`. DB-mode display
  // (dbCustomName/ragDatabaseName fallback) was removed — those fields
  // are no longer carried on the standalone RAG cylinder.
  const display = name

  // v3 cylinder geometry: top/bottom ellipses + sided rectangle.
  const ellipseHeight = Math.min(height * 0.3, 30)
  const radiusX = width / 2
  const radiusY = ellipseHeight / 2
  const topCenterY = radiusY
  const bottomCenterY = height - radiusY

  // v3 default fillColor was `#E8F0FF`. Apply whenever the user has not
  // explicitly chosen a fill colour (the helper falls back to
  // `var(--besser-background)`, so a literal "white" check never
  // matched newly-dropped nodes).
  const cylinderFill = !data.fillColor ? "#E8F0FF" : fillColor
  const cylinderStroke = strokeColor || "#668"

  return (
    <DefaultNodeWrapper width={width} height={height} elementId={id}>
      <NodeToolbar elementId={id} />
      <NodeResizer
        isVisible={isDiagramModifiable}
        minWidth={100}
        minHeight={80}
        handleStyle={{ width: 8, height: 8 }}
      />
      <div ref={wrapperRef}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          overflow="visible"
        >
          <rect
            x={0}
            y={radiusY}
            width={width}
            height={height - ellipseHeight}
            fill={cylinderFill}
            stroke={cylinderStroke}
          />
          <ellipse
            cx={radiusX}
            cy={topCenterY}
            rx={radiusX}
            ry={radiusY}
            fill={cylinderFill}
            stroke={cylinderStroke}
          />
          <ellipse
            cx={radiusX}
            cy={bottomCenterY}
            rx={radiusX}
            ry={radiusY}
            fill={cylinderFill}
            stroke={cylinderStroke}
          />
          <text
            x={width / 2}
            y={topCenterY + radiusY * 0.6}
            textAnchor="middle"
            fontSize={LAYOUT.NAME_FONT_SIZE - 2}
            fill={textColor}
            fontWeight="600"
          >
            RAG DB
          </text>
          <text
            x={width / 2}
            y={height - radiusY - 6}
            textAnchor="middle"
            fontSize={LAYOUT.NAME_FONT_SIZE}
            fill={textColor}
            dominantBaseline="middle"
          >
            {display}
          </text>
        </svg>
      </div>
      <PopoverManager
        anchorEl={wrapperRef.current}
        elementId={id}
        type={"AgentRagElement" as const}
      />
    </DefaultNodeWrapper>
  )
}
