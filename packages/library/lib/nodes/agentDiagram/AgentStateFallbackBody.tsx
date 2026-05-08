import { NodeProps, type Node } from "@xyflow/react"
import { useRef } from "react"
import { DefaultNodeWrapper } from "../wrappers"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import { AgentStateBodyNodeProps } from "@/types"
import { LAYOUT } from "@/constants"
import { getCustomColorsFromData } from "@/utils/layoutUtils"

/**
 * SA-4 `AgentStateFallbackBody`. Same wire shape as `AgentStateBody`
 * but rendered with a faintly different background to signal it as the
 * fallback region (mirrors v3's divider line + visual). Hangs off
 * `AgentState` via `parentId`.
 */
export function AgentStateFallbackBody({
  id,
  width,
  height,
  data,
}: NodeProps<Node<AgentStateBodyNodeProps>>) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  if (!width || !height) return null

  const { fillColor, textColor } = getCustomColorsFromData(data)
  const { name } = data

  return (
    <DefaultNodeWrapper
      width={width}
      height={height}
      elementId={id}
      hiddenHandles={[]}
    >
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
            stroke="none"
            opacity={0.85}
          />
          <line
            x1={0}
            x2={width}
            y1={0}
            y2={0}
            stroke="currentColor"
            strokeWidth={1}
            strokeDasharray="3 2"
            opacity={0.4}
          />
          <text
            x={10}
            y={height / 2 + 5}
            textAnchor="start"
            fontSize={LAYOUT.NAME_FONT_SIZE - 2}
            fill={textColor}
            fontStyle="italic"
          >
            {name}
          </text>
        </svg>
      </div>
      <PopoverManager
        anchorEl={wrapperRef.current}
        elementId={id}
        type={"AgentStateFallbackBody" as const}
      />
    </DefaultNodeWrapper>
  )
}
