import { NodeProps, type Node } from "@xyflow/react"
import { usePopoverAnchor } from "@/hooks/usePopoverAnchor"
import { DefaultNodeWrapper } from "../wrappers"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import { StateBodyNodeProps } from "@/types"
import { LAYOUT } from "@/constants"
import { getCustomColorsFromData } from "@/utils/layoutUtils"

/**
 * Child of `State` (via React Flow `parentId`). Single-line label sitting
 * in the body region of the parent state; v3 stored these as separate
 * `StateBody` elements with `owner` pointing to the parent — v4 keeps
 * the same separation but threads it through React Flow's `parentId`.
 */
export function StateBody({
  id,
  width,
  height,
  data,
}: NodeProps<Node<StateBodyNodeProps>>) {
  const [wrapperEl, wrapperRef] = usePopoverAnchor<HTMLDivElement>()

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
        anchorEl={wrapperEl}
        elementId={id}
        type={"StateBody" as const}
      />
    </DefaultNodeWrapper>
  )
}
