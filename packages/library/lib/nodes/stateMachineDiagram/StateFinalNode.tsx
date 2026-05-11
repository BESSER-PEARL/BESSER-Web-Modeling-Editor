import { NodeProps, type Node } from "@xyflow/react"
import { useRef } from "react"
import { DefaultNodeWrapper, HandleId } from "../wrappers"
import { useDiagramModifiable } from "@/hooks/useDiagramModifiable"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import { NodeToolbar } from "@/components/toolbars/NodeToolbar"
import { StateMarkerNodeProps } from "@/types"
import { getCustomColorsFromData } from "@/utils/layoutUtils"

/**
 * Bullseye marking a state machine's terminal state. v3 source:
 * `uml-state-final-node-component.tsx`. Outer ring is hollow, inner
 * disk is solid. Defaults to 45×45.
 */
export function StateFinalNode({
  id,
  width,
  height,
  data,
}: NodeProps<Node<StateMarkerNodeProps>>) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  useDiagramModifiable()

  if (!width || !height) return null

  const { fillColor, strokeColor } = getCustomColorsFromData(data)
  const outerRadius = (Math.min(width, height) / 2) * 0.9
  const innerRadius = (Math.min(width, height) / 2) * 0.7
  const stroke = strokeColor || "var(--besser-primary-contrast, #000000)"

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
      {/* Marker nodes have no editable body — hide the
          pencil so the toolbar only exposes Delete. */}
      <NodeToolbar elementId={id} showEdit={false} />
      <div ref={wrapperRef}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          overflow="visible"
        >
          <title>Final State</title>
          <circle
            cx={width / 2}
            cy={height / 2}
            r={outerRadius}
            fill={fillColor || "white"}
            stroke={stroke}
            strokeWidth={1.5}
          />
          <circle
            cx={width / 2}
            cy={height / 2}
            r={innerRadius}
            fill={stroke}
            stroke="none"
          />
        </svg>
      </div>
      <PopoverManager
        anchorEl={wrapperRef.current}
        elementId={id}
        type={"StateFinalNode" as const}
      />
    </DefaultNodeWrapper>
  )
}
