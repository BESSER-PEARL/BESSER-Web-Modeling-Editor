import { NodeProps, NodeResizer, type Node } from "@xyflow/react"
import { useRef } from "react"
import { DefaultNodeWrapper } from "../wrappers"
import { useHandleOnResize } from "@/hooks"
import { useDiagramModifiable } from "@/hooks/useDiagramModifiable"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import { NodeToolbar } from "@/components/toolbars/NodeToolbar"
import { StateObjectNodeProps } from "@/types"
import { LAYOUT } from "@/constants"
import { getCustomColorsFromData } from "@/utils/layoutUtils"

/**
 * Object reference node inside a state machine. v3 source:
 * `uml-state-object-node-component.tsx`.
 *
 * Spec open question 4 resolution: this node carries a `classId` link to
 * a sibling ClassDiagram (matches `ObjectName.classId`). The
 * inspector renders a class-picker driven by
 * `diagramBridge.getAvailableClasses()`; the canvas shows just the
 * instance name in bold (matching the v3 multiline visual).
 */
export function StateObjectNode({
  id,
  width,
  height,
  data,
  parentId,
}: NodeProps<Node<StateObjectNodeProps>>) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const { onResize } = useHandleOnResize(parentId)
  const isDiagramModifiable = useDiagramModifiable()

  if (!width || !height) return null

  const { fillColor, strokeColor, textColor } = getCustomColorsFromData(data)
  const { name, className } = data
  const label = className ? `${name}: ${className}` : name

  return (
    <DefaultNodeWrapper width={width} height={height} elementId={id}>
      <NodeToolbar elementId={id} />
      <NodeResizer
        isVisible={isDiagramModifiable}
        onResize={onResize}
        minWidth={60}
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
          />
          <text
            x={width / 2}
            y={height / 2 + 5}
            textAnchor="middle"
            fontSize={LAYOUT.NAME_FONT_SIZE}
            fontWeight="bold"
            fill={textColor}
          >
            {label}
          </text>
        </svg>
      </div>
      <PopoverManager
        anchorEl={wrapperRef.current}
        elementId={id}
        type={"StateObjectNode" as const}
      />
    </DefaultNodeWrapper>
  )
}
