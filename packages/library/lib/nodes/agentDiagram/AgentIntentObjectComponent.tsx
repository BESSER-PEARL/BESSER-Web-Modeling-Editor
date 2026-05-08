import { NodeProps, NodeResizer, type Node } from "@xyflow/react"
import { useRef } from "react"
import { DefaultNodeWrapper } from "../wrappers"
import { useDiagramModifiable } from "@/hooks/useDiagramModifiable"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import { NodeToolbar } from "@/components/toolbars/NodeToolbar"
import { AgentIntentObjectComponentNodeProps } from "@/types"
import { LAYOUT } from "@/constants"
import { getCustomColorsFromData } from "@/utils/layoutUtils"

/**
 * SA-4 `AgentIntentObjectComponent`. Stand-alone slot/entity row used to
 * bind an entity to the intent. v3 source:
 * `agent-state-diagram/agent-intent-object-component/`. The visual is a
 * thin labelled rectangle; the inspector edits `entity` / `slot` /
 * `value` from `data`.
 */
export function AgentIntentObjectComponent({
  id,
  width,
  height,
  data,
}: NodeProps<Node<AgentIntentObjectComponentNodeProps>>) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const isDiagramModifiable = useDiagramModifiable()

  if (!width || !height) return null

  const { fillColor, strokeColor, textColor } = getCustomColorsFromData(data)
  const { name, entity, slot } = data

  // Visible label: `slot:entity` (or just `name` if either is absent).
  const display =
    slot && entity ? `${slot}: ${entity}` : entity || slot || name

  return (
    <DefaultNodeWrapper width={width} height={height} elementId={id}>
      <NodeToolbar elementId={id} />
      <NodeResizer
        isVisible={isDiagramModifiable}
        minWidth={100}
        minHeight={30}
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
            y={0}
            width={width}
            height={height}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={LAYOUT.LINE_WIDTH}
            rx={4}
          />
          <text
            x={width / 2}
            y={height / 2 + 5}
            textAnchor="middle"
            fontSize={LAYOUT.NAME_FONT_SIZE - 2}
            fill={textColor}
          >
            {display}
          </text>
        </svg>
      </div>
      <PopoverManager
        anchorEl={wrapperRef.current}
        elementId={id}
        type={"AgentIntentObjectComponent" as const}
      />
    </DefaultNodeWrapper>
  )
}
