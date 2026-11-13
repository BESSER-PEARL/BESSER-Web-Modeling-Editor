import { NodeProps, type Node } from "@xyflow/react"
import { usePopoverAnchor } from "@/hooks/usePopoverAnchor"
import { DefaultNodeWrapper, HandleId } from "../wrappers"
import { DefaultNodeProps } from "@/types"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import { useDiagramModifiable } from "@/hooks/useDiagramModifiable"
import { ActivityInitialNodeSVG } from "@/components/svgs/nodes"
import { NodeToolbar } from "@/components/toolbars/NodeToolbar"

export function ActivityInitialNode({
  id,
  width,
  height,
}: NodeProps<Node<DefaultNodeProps>>) {
  const [svgWrapperEl, svgWrapperRef] = usePopoverAnchor<HTMLDivElement>()

  const isDiagramModifiable = useDiagramModifiable()

  if (!width || !height) {
    return null
  }
  return (
    <DefaultNodeWrapper
      elementId={id}
      width={width}
      height={height}
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
      <div ref={svgWrapperRef}>
        <ActivityInitialNodeSVG
          width={width}
          height={height}
          id={id}
          showAssessmentResults={!isDiagramModifiable}
        />
      </div>

      <PopoverManager
        anchorEl={svgWrapperEl}
        elementId={id}
        type="default"
      />
    </DefaultNodeWrapper>
  )
}
