import { NodeProps, type Node } from "@xyflow/react"
import { useRef } from "react"
import { DefaultNodeWrapper, HandleId } from "../wrappers"
import { useDiagramModifiable } from "@/hooks/useDiagramModifiable"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import { NodeToolbar } from "@/components/toolbars/NodeToolbar"
import { StateMarkerNodeProps } from "@/types"
import { getCustomColorsFromData } from "@/utils/layoutUtils"

/**
 * Filled circle marking the entry point of a state machine. v3 source:
 * `uml-state-initial-node-component.tsx`. Defaults to 45×45; the v3
 * fork hid corner / mid handles so transitions only attach to the four
 * cardinal sides — same here.
 */
export function StateInitialNode({
  id,
  width,
  height,
  data,
}: NodeProps<Node<StateMarkerNodeProps>>) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  useDiagramModifiable()

  if (!width || !height) return null

  const { fillColor } = getCustomColorsFromData(data)
  const radius = Math.min(width, height) / 2

  return (
    <DefaultNodeWrapper
      width={width}
      height={height}
      elementId={id}
      hiddenHandles={[
        HandleId.TopLeft,
        HandleId.TopRight,
        HandleId.RightTop,
        HandleId.RightBottom,
        HandleId.BottomRight,
        HandleId.BottomLeft,
        HandleId.LeftBottom,
        HandleId.LeftTop,
      ]}
    >
      <NodeToolbar elementId={id} />
      <div ref={wrapperRef}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          overflow="visible"
        >
          <title>Initial State</title>
          <circle
            cx={width / 2}
            cy={height / 2}
            r={radius}
            fill={fillColor || "var(--besser-primary-contrast, #000000)"}
            stroke="none"
          />
        </svg>
      </div>
      <PopoverManager
        anchorEl={wrapperRef.current}
        elementId={id}
        type={"StateInitialNode" as const}
      />
    </DefaultNodeWrapper>
  )
}
