import { NodeProps, NodeResizer, type Node } from "@xyflow/react"
import { DefaultNodeWrapper } from "../wrappers"
import { useRef } from "react"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import { useDiagramModifiable } from "@/hooks/useDiagramModifiable"
import { BPMNPoolProps } from "@/types"
import { BPMNPoolNodeSVG } from "@/components"
import { NodeToolbar } from "@/components/toolbars/NodeToolbar"
import { useSwimlaneLayout } from "@/hooks/useSwimlaneLayout"

export function BPMNPool({
  id,
  width,
  height,
  data,
}: NodeProps<Node<BPMNPoolProps>>) {
  const svgWrapperRef = useRef<HTMLDivElement | null>(null)
  // A pool with swimlanes is lane-driven: resizing re-flows its lanes and
  // clamps its own height to the summed lane heights (develop's pool
  // render()). An empty pool resizes freely (floor only).
  const { onPoolResize } = useSwimlaneLayout()
  const isDiagramModifiable = useDiagramModifiable()

  if (!width || !height) {
    return null
  }

  return (
    <DefaultNodeWrapper width={width} height={height} elementId={id}>
      <NodeToolbar elementId={id} />

      <NodeResizer
        isVisible={isDiagramModifiable}
        onResize={onPoolResize(id)}
        minHeight={120}
        minWidth={200}
        handleStyle={{ width: 8, height: 8 }}
      />
      <div ref={svgWrapperRef}>
        <BPMNPoolNodeSVG
          width={width}
          height={height}
          id={id}
          data={data}
          showAssessmentResults={!isDiagramModifiable}
        />
      </div>
      <PopoverManager
        anchorEl={svgWrapperRef.current}
        elementId={id}
        type="BPMNPool"
      />
    </DefaultNodeWrapper>
  )
}
