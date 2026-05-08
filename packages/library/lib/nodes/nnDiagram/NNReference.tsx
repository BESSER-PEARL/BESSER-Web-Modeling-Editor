import { NodeProps, NodeResizer, type Node } from "@xyflow/react"
import { useRef } from "react"
import { DefaultNodeWrapper } from "../wrappers"
import { useDiagramModifiable } from "@/hooks/useDiagramModifiable"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import { NodeToolbar } from "@/components/toolbars/NodeToolbar"
import { NNReferenceNodeProps } from "@/types"
import { LAYOUT } from "@/constants"
import { getCustomColorsFromData } from "@/utils/layoutUtils"

/**
 * SA-5 `NNReference`. v3 source:
 * `packages/editor/src/main/packages/nn-diagram/nn-reference/`. A
 * compact single-line node holding a reference to another layer (in
 * the same container) or a sibling container. The reference target is
 * stored on `data.referenceTarget` and edited via the inspector
 * dropdown.
 */
export function NNReference({
  id,
  width,
  height,
  data,
}: NodeProps<Node<NNReferenceNodeProps>>) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const isDiagramModifiable = useDiagramModifiable()

  if (!width || !height) return null

  const { fillColor, strokeColor, textColor } = getCustomColorsFromData(data)
  const refFill = !data.fillColor ? "#FFFDE7" : fillColor

  return (
    <DefaultNodeWrapper width={width} height={height} elementId={id}>
      <NodeToolbar elementId={id} />
      <NodeResizer
        isVisible={isDiagramModifiable}
        minWidth={100}
        minHeight={36}
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
            rx={4}
            ry={4}
            fill={refFill}
            stroke={strokeColor}
            strokeDasharray="4 2"
            strokeWidth={1.2}
          />
          <text
            x={width / 2}
            y={height / 2 + 5}
            textAnchor="middle"
            fontSize={LAYOUT.NAME_FONT_SIZE - 2}
            fill={textColor}
            fontStyle="italic"
          >
            {`→ ${data.name || data.referenceTarget || ""}`}
          </text>
        </svg>
      </div>
      <PopoverManager
        anchorEl={wrapperRef.current}
        elementId={id}
        type={"NNReference" as never}
      />
    </DefaultNodeWrapper>
  )
}
