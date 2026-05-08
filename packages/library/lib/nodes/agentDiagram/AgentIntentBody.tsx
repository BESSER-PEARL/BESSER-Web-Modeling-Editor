import { NodeProps, type Node } from "@xyflow/react"
import { useRef } from "react"
import { DefaultNodeWrapper } from "../wrappers"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import { AgentIntentBodyNodeProps } from "@/types"
import { LAYOUT } from "@/constants"
import { getCustomColorsFromData } from "@/utils/layoutUtils"

/**
 * SA-4 `AgentIntentBody`. One training-utterance row under an
 * `AgentIntent` parent. Same single-line-label rendering as
 * `AgentStateBody`, but kept as its own component so the inspector
 * registry can route to a dedicated panel (training phrases mode).
 */
export function AgentIntentBody({
  id,
  width,
  height,
  data,
}: NodeProps<Node<AgentIntentBodyNodeProps>>) {
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
          />
          <text
            x={10}
            y={height / 2 + 5}
            textAnchor="start"
            fontSize={LAYOUT.NAME_FONT_SIZE - 2}
            fill={textColor}
          >
            {name}
          </text>
        </svg>
      </div>
      <PopoverManager
        anchorEl={wrapperRef.current}
        elementId={id}
        type={"AgentIntentBody" as const}
      />
    </DefaultNodeWrapper>
  )
}
