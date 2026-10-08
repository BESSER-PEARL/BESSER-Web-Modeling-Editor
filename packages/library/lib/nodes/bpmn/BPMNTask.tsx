import { NodeProps, NodeResizer, type Node } from "@xyflow/react"
import { usePopoverAnchor } from "@/hooks/usePopoverAnchor"
import { DefaultNodeWrapper } from "../wrappers"
import { useHandleOnResize } from "@/hooks"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import { useDiagramModifiable } from "@/hooks/useDiagramModifiable"
import { BPMNTaskProps } from "@/types"
import { BPMNTaskNodeSVG } from "@/components"
import { agenticTaskMinHeight } from "@/components/svgs/nodes/bpmnDiagram/BPMNTaskNodeSVG"
import { NodeToolbar } from "@/components/toolbars/NodeToolbar"

export function BPMNTask({
  id,
  width,
  height,
  data,
  parentId,
}: NodeProps<Node<BPMNTaskProps>>) {
  const [svgWrapperEl, svgWrapperRef] = usePopoverAnchor<HTMLDivElement>()
  const { onResize } = useHandleOnResize(parentId)
  const isDiagramModifiable = useDiagramModifiable()

  if (!width || !height) {
    return null
  }

  return (
    <DefaultNodeWrapper width={width} height={height} elementId={id}>
      <NodeToolbar elementId={id} />

      <NodeResizer
        isVisible={isDiagramModifiable}
        onResize={onResize}
        // An agentic task keeps room for its bot and reflection markers.
        minHeight={Math.max(50, agenticTaskMinHeight(data))}
        minWidth={80}
        handleStyle={{ width: 8, height: 8 }}
      />
      <div ref={svgWrapperRef}>
        <BPMNTaskNodeSVG
          width={width}
          height={height}
          id={id}
          data={data}
          showAssessmentResults={!isDiagramModifiable}
        />
      </div>
      <PopoverManager
        anchorEl={svgWrapperEl}
        elementId={id}
        type="BPMNTask"
      />
    </DefaultNodeWrapper>
  )
}
