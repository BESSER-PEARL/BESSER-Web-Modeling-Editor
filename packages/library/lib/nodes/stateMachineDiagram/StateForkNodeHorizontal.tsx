import { NodeProps, NodeResizer, type Node } from "@xyflow/react"
import { useRef } from "react"
import { DefaultNodeWrapper, HandleId } from "../wrappers"
import { useHandleOnResize } from "@/hooks"
import { useDiagramModifiable } from "@/hooks/useDiagramModifiable"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import { NodeToolbar } from "@/components/toolbars/NodeToolbar"
import { StateMarkerNodeProps } from "@/types"
import { getCustomColorsFromData } from "@/utils/layoutUtils"

/**
 * Horizontal fork bar. Default size 60×20 (fixed height, resizable width)
 * — matches v3 `UMLStateForkNodeHorizontal.defaultWidth/Height`.
 */
export function StateForkNodeHorizontal({
  id,
  width,
  height,
  data,
  parentId,
}: NodeProps<Node<StateMarkerNodeProps>>) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const { onResize } = useHandleOnResize(parentId)
  const isDiagramModifiable = useDiagramModifiable()

  if (!width || !height) return null

  const { strokeColor, fillColor } = getCustomColorsFromData(data)
  const fill = fillColor || strokeColor

  return (
    <DefaultNodeWrapper
      width={width}
      height={height}
      elementId={id}
      hiddenHandles={[
        HandleId.TopLeft,
        HandleId.TopRight,
        HandleId.BottomLeft,
        HandleId.BottomRight,
      ]}
      className="horizontally-not-resizable"
    >
      <NodeToolbar elementId={id} />
      <NodeResizer
        isVisible={isDiagramModifiable}
        onResize={onResize}
        minHeight={20}
        maxHeight={20}
        minWidth={60}
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
            fill={fill}
            stroke="none"
          />
        </svg>
      </div>
      <PopoverManager
        anchorEl={wrapperRef.current}
        elementId={id}
        type={"StateForkNodeHorizontal" as const}
      />
    </DefaultNodeWrapper>
  )
}
