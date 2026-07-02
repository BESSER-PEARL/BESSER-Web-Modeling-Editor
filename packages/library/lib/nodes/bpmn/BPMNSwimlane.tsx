import { NodeProps, NodeResizer, type Node } from "@xyflow/react"
import { DefaultNodeWrapper } from "../wrappers"
import { useRef } from "react"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import { useDiagramModifiable } from "@/hooks/useDiagramModifiable"
import { BPMNSwimlaneProps } from "@/types"
import { BPMNSwimlaneNodeSVG } from "@/components"
import { NodeToolbar } from "@/components/toolbars/NodeToolbar"
import { useSwimlaneLayout, SWIMLANE_MIN_HEIGHT } from "@/hooks/useSwimlaneLayout"

/**
 * A swimlane — a Pool subdivision. Modeled on BPMNPool but:
 *  - not draggable (set at creation time in the drop / lane-insert action,
 *    not here — this component only renders);
 *  - vertically resizable only: `shouldResize` rejects any horizontal
 *    delta, since the lane width is pool-driven (`pool.width - HEADER`);
 *  - resizing re-flows the owning pool via `useSwimlaneLayout`.
 *
 * Renaming a lane happens through the Pool's lane-list UI
 * (`BPMNPoolEditPopover`), mirroring develop's bpmn-pool-update.tsx; the
 * per-lane popover maps to `DefaultNodeEditPopover` as a minimal fallback.
 */
export function BPMNSwimlane({
  id,
  width,
  height,
  data,
  parentId,
}: NodeProps<Node<BPMNSwimlaneProps>>) {
  const svgWrapperRef = useRef<HTMLDivElement | null>(null)
  const isDiagramModifiable = useDiagramModifiable()
  const { onLaneResize } = useSwimlaneLayout()

  if (!width || !height) {
    return null
  }

  return (
    <DefaultNodeWrapper width={width} height={height} elementId={id}>
      <NodeToolbar elementId={id} />

      <NodeResizer
        isVisible={isDiagramModifiable}
        onResize={parentId ? onLaneResize(parentId, id) : undefined}
        // Lane width is fully pool-driven — reject any horizontal resize.
        shouldResize={(_event, params) => params.direction[0] === 0}
        minHeight={SWIMLANE_MIN_HEIGHT}
        handleStyle={{ width: 8, height: 8 }}
      />
      <div ref={svgWrapperRef}>
        <BPMNSwimlaneNodeSVG
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
        type="BPMNSwimlane"
      />
    </DefaultNodeWrapper>
  )
}
