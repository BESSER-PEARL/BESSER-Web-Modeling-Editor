import { NodeProps, type Node } from "@xyflow/react"
import { useRef } from "react"
import { DefaultNodeWrapper } from "../wrappers"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import { UserModelAttributeNodeProps } from "@/types"
import { LAYOUT } from "@/constants"
import { getCustomColorsFromData } from "@/utils/layoutUtils"

/**
 * `UserModelAttribute`. Stand-alone attribute row when v3 fixtures
 * stored attributes as separate elements (rare; the migrator collapses
 * them onto the owner `UserModelName.attributes` array).
 *
 * This component exists for legacy round-trip — when a v3 fixture has a
 * `UserModelAttribute` element without an owner, it shows up here. The
 * primary editing surface is the parent's `UserModelNameEditPanel` which
 * edits the attributes inline.
 */
export function UserModelAttribute({
  id,
  width,
  height,
  data,
}: NodeProps<Node<UserModelAttributeNodeProps>>) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  if (!width || !height) return null

  const { fillColor, textColor } = getCustomColorsFromData(data)
  const { name, attributeType, attributeOperator } = data

  const display = attributeType
    ? `${name}: ${attributeType}`
    : attributeOperator
      ? `${name} ${attributeOperator}`
      : name

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
            {display}
          </text>
        </svg>
      </div>
      <PopoverManager
        anchorEl={wrapperRef.current}
        elementId={id}
        type={"UserModelAttribute" as const}
      />
    </DefaultNodeWrapper>
  )
}
