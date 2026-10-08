import {
  NodeProps,
  NodeResizeControl,
  type Node,
  type ResizeControlVariant,
} from "@xyflow/react"
import { usePopoverAnchor } from "@/hooks/usePopoverAnchor"
import { DefaultNodeWrapper } from "../wrappers"
import { useEffect } from "react"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import { useDiagramModifiable } from "@/hooks/useDiagramModifiable"
import { BPMNSwimlaneProps } from "@/types"
import { BPMNSwimlaneNodeSVG } from "@/components"
import { NodeToolbar } from "@/components/toolbars/NodeToolbar"
import { useSwimlaneLayout, SWIMLANE_MIN_HEIGHT } from "@/hooks/useSwimlaneLayout"
import { LANE_HEADER_WIDTH } from "@/utils/bpmnConstraints"

/**
 * A pool's swimlanes are React-Flow CHILD nodes of the pool, and React Flow
 * paints child nodes ON TOP of their parent. A lane's opaque body therefore
 * covers the parent pool's own NodeResizer handles wherever a lane sits
 * (everything except the 40px header strip), so the pointer lands on the lane
 * instead of the pool's handle — the pool's right / top / bottom edges become
 * un-grabbable and "dragging the pool bigger" appears to do nothing.
 *
 * Fix: let a lane's body pass pointer events THROUGH to the pool (and its
 * resize handles) beneath it, while keeping the lane's OWN resize handles
 * interactive so a lane can still be resized vertically. A single global
 * stylesheet rule (injected once) does this without needing to touch the
 * shared node wrapper. Lanes have no need to be an edge endpoint, so their
 * connection handles are hidden (see `hiddenHandles` below), leaving nothing
 * but the resize controls to capture the pointer.
 */
const SWIMLANE_PASSTHROUGH_STYLE_ID = "besser-bpmn-swimlane-passthrough"
function ensureSwimlanePassthroughStyle(): void {
  if (typeof document === "undefined") return
  if (document.getElementById(SWIMLANE_PASSTHROUGH_STYLE_ID)) return
  const style = document.createElement("style")
  style.id = SWIMLANE_PASSTHROUGH_STYLE_ID
  // `!important` is required: React Flow's base `.react-flow__node`
  // rule also sets `pointer-events: all` at equal specificity, and its
  // stylesheet is injected after this one, so a plain rule would lose the
  // cascade tie. The resize-control re-enable must also win to stay grabbable.
  style.textContent =
    ".react-flow__node-bpmnSwimlane{pointer-events:none !important;}" +
    ".react-flow__node-bpmnSwimlane .react-flow__resize-control{pointer-events:all !important;}"
  document.head.appendChild(style)
}

/**
 * A swimlane — a Pool subdivision. Modeled on BPMNPool but:
 *  - not draggable (set at creation time in the drop / lane-insert action,
 *    not here — this component only renders);
 *  - resizable from its bottom edge only, since the lane width and the
 *    outer edges are pool-driven (`pool.width - HEADER`);
 *  - selectable through its header strip (the body passes clicks through);
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
  const [svgWrapperEl, svgWrapperRef] = usePopoverAnchor<HTMLDivElement>()
  const isDiagramModifiable = useDiagramModifiable()
  const { onLaneResize } = useSwimlaneLayout()

  // Let the lane body pass the pointer through to the pool's resize handles
  // beneath it (see the note above). Idempotent — one shared <style> element.
  useEffect(() => {
    ensureSwimlanePassthroughStyle()
  }, [])

  if (!width || !height) {
    return null
  }

  return (
    <DefaultNodeWrapper
      width={width}
      height={height}
      elementId={id}
      // Lanes are never an edge endpoint; drop their connection handles so
      // nothing but the resize controls can intercept a pool-resize drag.
      hiddenHandles={true}
    >
      <NodeToolbar elementId={id} />

      {/* Only the bottom edge resizes a lane: its other edges coincide with
          the pool's, whose own resize handles must stay reachable (a lane
          line over the pool's right edge made a laned pool unwidenable). */}
      {isDiagramModifiable && parentId && (
        <NodeResizeControl
          position="bottom"
          variant={"line" as ResizeControlVariant}
          onResize={onLaneResize(parentId, id)}
          shouldResize={(_event, params) => params.direction[0] === 0}
          minHeight={SWIMLANE_MIN_HEIGHT}
          style={{ pointerEvents: "all" }}
        />
      )}
      {/* The header strip (lane name) takes the pointer, so a click selects
          the lane itself rather than falling through to the pool. */}
      <div
        className="besser-bpmn-lane-header"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: LANE_HEADER_WIDTH,
          height,
          pointerEvents: "all",
          cursor: "pointer",
          zIndex: 1,
        }}
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
        anchorEl={svgWrapperEl}
        elementId={id}
        type="BPMNSwimlane"
      />
    </DefaultNodeWrapper>
  )
}
