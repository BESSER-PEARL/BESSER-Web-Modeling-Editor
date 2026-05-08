import { NodeProps, NodeResizer, type Node } from "@xyflow/react"
import { useRef } from "react"
import { DefaultNodeWrapper } from "../wrappers"
import { useHandleOnResize } from "@/hooks"
import { useDiagramModifiable } from "@/hooks/useDiagramModifiable"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import { NodeToolbar } from "@/components/toolbars/NodeToolbar"
import { NNContainerNodeProps } from "@/types"
import { LAYOUT } from "@/constants"
import { getCustomColorsFromData } from "@/utils/layoutUtils"

/**
 * SA-5 `NNContainer` — parent node for a sequential layer stack. v3
 * source: `packages/editor/src/main/packages/nn-diagram/nn-container/`.
 * Children attach via React Flow `parentId = container.id`. The
 * container's `data` carries the model name and (optionally) an
 * `entryLayerId` indicating which layer is the input side.
 *
 * Visual: large rounded rectangle with a header bar and a thin border.
 * Layers are rendered as separate React-Flow nodes inside the container
 * so the user can drag-resize / reorder them with native React-Flow
 * interactions.
 */
export function NNContainer({
  id,
  width,
  height,
  data,
  parentId,
}: NodeProps<Node<NNContainerNodeProps>>) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const { onResize } = useHandleOnResize(parentId)
  const isDiagramModifiable = useDiagramModifiable()

  if (!width || !height) return null

  const { fillColor, strokeColor, textColor } = getCustomColorsFromData(data)
  const { name } = data
  const containerFill = fillColor === "white" ? "#F5F5F5" : fillColor
  const cornerRadius = 8
  const headerHeight = LAYOUT.DEFAULT_HEADER_HEIGHT

  return (
    <DefaultNodeWrapper width={width} height={height} elementId={id}>
      <NodeToolbar elementId={id} />
      <NodeResizer
        isVisible={isDiagramModifiable}
        onResize={onResize}
        minWidth={200}
        minHeight={140}
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
            fill={containerFill}
            stroke={strokeColor}
            strokeWidth={LAYOUT.LINE_WIDTH}
          />
          <text
            x={width / 2}
            y={26}
            textAnchor="middle"
            fontSize={LAYOUT.NAME_FONT_SIZE}
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
        type={"NNContainer" as never}
      />
    </DefaultNodeWrapper>
  )
}
