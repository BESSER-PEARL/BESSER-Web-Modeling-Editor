import { NodeProps, NodeResizer, type Node } from "@xyflow/react"
import { useRef } from "react"
import { DefaultNodeWrapper } from "../wrappers"
import { useDiagramModifiable } from "@/hooks/useDiagramModifiable"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import { NodeToolbar } from "@/components/toolbars/NodeToolbar"
import { useDiagramStore } from "@/store/context"
import { NNReferenceNodeProps } from "@/types"
import { LAYOUT } from "@/constants"
import { getCustomColorsFromData } from "@/utils/layoutUtils"

/**
 * `NNReference`. v3 source:
 * `v3 source: nn-diagram/nn-reference/`. A
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
  // Render the REFERENCED container's name (look it up live). v3 parity:
  // the NNReference card displays "→ <container name>", not its own
  // internal label. Falls back to `data.name` only when the reference is
  // unset or its target node has been deleted.
  const referencedName = useDiagramStore((s) => {
    if (!data.referenceTarget) return null
    const target = s.nodes.find((n) => n.id === data.referenceTarget)
    if (!target) return null
    return ((target.data as { name?: string }) ?? {}).name ?? null
  })
  const labelText = referencedName || data.name || "reference"

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
            pointerEvents="visiblePainted"
          />
          <text
            x={width / 2}
            y={height / 2 + 5}
            textAnchor="middle"
            fontSize={LAYOUT.NAME_FONT_SIZE - 2}
            fill={textColor}
            fontStyle="italic"
            pointerEvents="none"
          >
            {`→ ${labelText}`}
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
