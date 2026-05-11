import { NodeProps, NodeResizer, type Node } from "@xyflow/react"
import { useRef } from "react"
import { DefaultNodeWrapper } from "../wrappers"
import { useHandleOnResize } from "@/hooks"
import { useDiagramModifiable } from "@/hooks/useDiagramModifiable"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import { NodeToolbar } from "@/components/toolbars/NodeToolbar"
import { StateNodeProps } from "@/types"
import { LAYOUT } from "@/constants"
import { getCustomColorsFromData } from "@/utils/layoutUtils"

/**
 * `State` parent. Children (StateBody / StateFallbackBody / StateCodeBlock)
 * use React Flow `parentId` and lay themselves out inside this container.
 * The header carries only the state name (the v3 BESSER metamodel does
 * not surface a stereotype on State).
 */
export function State({
  id,
  width,
  height,
  data,
  parentId,
}: NodeProps<Node<StateNodeProps>>) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const { onResize } = useHandleOnResize(parentId)
  const isDiagramModifiable = useDiagramModifiable()

  if (!width || !height) return null

  const { fillColor, strokeColor, textColor } = getCustomColorsFromData(data)
  const { name, italic, underline } = data
  const cornerRadius = 8
  const headerHeight = LAYOUT.DEFAULT_HEADER_HEIGHT

  return (
    <DefaultNodeWrapper width={width} height={height} elementId={id}>
      <NodeToolbar elementId={id} />
      <NodeResizer
        isVisible={isDiagramModifiable}
        onResize={onResize}
        minWidth={120}
        minHeight={60}
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
            rx={cornerRadius}
            ry={cornerRadius}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={LAYOUT.LINE_WIDTH}
          />
          <text
            x={width / 2}
            y={26}
            textAnchor="middle"
            fontSize={LAYOUT.NAME_FONT_SIZE}
            fontStyle={italic ? "italic" : undefined}
            textDecoration={underline ? "underline" : undefined}
            fontWeight="600"
            fill={textColor}
          >
            {name}
          </text>
          <line
            x1={0}
            x2={width}
            y1={headerHeight}
            y2={headerHeight}
            stroke={strokeColor}
            strokeWidth={1}
          />
        </svg>
      </div>
      <PopoverManager
        anchorEl={wrapperRef.current}
        elementId={id}
        type={"State" as const}
      />
    </DefaultNodeWrapper>
  )
}
