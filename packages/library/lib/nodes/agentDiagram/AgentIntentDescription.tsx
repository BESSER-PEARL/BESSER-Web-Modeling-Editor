import { NodeProps, type Node } from "@xyflow/react"
import { useRef } from "react"
import { DefaultNodeWrapper } from "../wrappers"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import { AgentIntentDescriptionNodeProps } from "@/types"
import { LAYOUT } from "@/constants"
import { getCustomColorsFromData } from "@/utils/layoutUtils"

/**
 * SA-4 `AgentIntentDescription`. Single-line description block under the
 * intent header; mirrors v3's `AgentIntentDescriptionComponent`. Renders
 * the `name` field with a `"Description: "` prefix at draw time so the
 * stored data stays clean.
 */
export function AgentIntentDescription({
  id,
  width,
  height,
  data,
}: NodeProps<Node<AgentIntentDescriptionNodeProps>>) {
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
            fontWeight="normal"
          >
            {`Description: ${name}`}
          </text>
        </svg>
      </div>
      <PopoverManager
        anchorEl={wrapperRef.current}
        elementId={id}
        type={"AgentIntentDescription" as const}
      />
    </DefaultNodeWrapper>
  )
}
