import { NodeProps, type Node } from "@xyflow/react"
import { useRef } from "react"
import { DefaultNodeWrapper } from "../wrappers"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import { StateBodyNodeProps } from "@/types"
import { LAYOUT } from "@/constants"
import { getCustomColorsFromData } from "@/utils/layoutUtils"

/**
 * Fallback body row of a `State`. Visually identical to `StateBody` but
 * separated so v3's `fallbackBodies: string[]` round-trips cleanly. The
 * v3 fork put a divider line between body and fallback-body regions —
 * the parent `State.tsx` paints that divider (see the v3
 * `deviderPosition` field which v4 recomputes from layout).
 */
export function StateFallbackBody({
  id,
  width,
  height,
  data,
}: NodeProps<Node<StateBodyNodeProps>>) {
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
            fontStyle="italic"
            fill={textColor}
          >
            {name}
          </text>
        </svg>
      </div>
      <PopoverManager
        anchorEl={wrapperRef.current}
        elementId={id}
        type={"StateFallbackBody" as const}
      />
    </DefaultNodeWrapper>
  )
}
