import { NodeProps, type Node } from "@xyflow/react"
import { usePopoverAnchor } from "@/hooks/usePopoverAnchor"
import { PetriNetPlaceSVG } from "@/components"
import { PetriNetPlaceProps } from "@/types"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import { useDiagramModifiable } from "@/hooks/useDiagramModifiable"
import { DefaultNodeWrapper, HandleId } from "../wrappers"
import { NodeToolbar } from "@/components/toolbars/NodeToolbar"

export function PetriNetPlace({
  id,
  width,
  height,
  data,
}: NodeProps<Node<PetriNetPlaceProps>>) {
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
        <PetriNetPlaceSVG
          width={width}
          height={height}
          id={id}
          showAssessmentResults={!isDiagramModifiable}
          data={data}
        />
      </div>

      <PopoverManager
        anchorEl={svgWrapperEl}
        elementId={id}
        type="PetriNetPlace"
      />
    </DefaultNodeWrapper>
  )
}
