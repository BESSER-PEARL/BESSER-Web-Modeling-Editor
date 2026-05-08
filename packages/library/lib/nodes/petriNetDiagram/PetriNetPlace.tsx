import { NodeProps, type Node } from "@xyflow/react"
import { PetriNetPlaceSVG } from "@/components"
import { useRef } from "react"
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
  const svgWrapperRef = useRef<HTMLDivElement | null>(null)
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
        anchorEl={svgWrapperRef.current}
        elementId={id}
        type="PetriNetPlace"
      />
    </DefaultNodeWrapper>
  )
}
