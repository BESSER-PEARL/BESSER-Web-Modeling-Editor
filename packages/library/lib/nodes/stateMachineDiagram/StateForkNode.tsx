import { NodeProps, NodeResizer, type Node } from "@xyflow/react"
import { useRef } from "react"
import { DefaultNodeWrapper, HandleId } from "../wrappers"
import { useHandleOnResize } from "@/hooks"
import { useDiagramModifiable } from "@/hooks/useDiagramModifiable"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import { NodeToolbar } from "@/components/toolbars/NodeToolbar"
import { StateMarkerNodeProps } from "@/types"

/**
 * Vertical fork bar. Default size 20×60 (fixed width, resizable height)
 * — matches v3 `UMLStateForkNode.defaultWidth/Height` at
 * `packages/editor/.../uml-state-fork-node.ts`. The bar itself is just
 * a filled rectangle.
 *
 * Mirrors the fix applied to
 * `StateInitialNode`. The shared `getCustomColorsFromData` helper falls
 * back to `var(--besser-background)` (white in the default theme),
 * which painted the fork bar invisible against the canvas. Read
 * `data.fillColor` directly with a hard `#000000` default so the bar
 * always renders solid regardless of theme variables.
 */
export function StateForkNode({
  id,
  width,
  height,
  data,
  parentId,
}: NodeProps<Node<StateMarkerNodeProps>>) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const { onResize } = useHandleOnResize(parentId)
  const isDiagramModifiable = useDiagramModifiable()

  if (!width || !height) return null

  const fill = data?.fillColor || "var(--besser-primary-contrast, #000000)"

  return (
    <DefaultNodeWrapper
      width={width}
      height={height}
      elementId={id}
      hiddenHandles={[
        HandleId.TopLeft,
        HandleId.TopRight,
        HandleId.BottomLeft,
        HandleId.BottomRight,
      ]}
      className="vertically-not-resizable"
    >
      {/* Marker nodes have no editable body — hide the
          pencil so the toolbar only exposes Delete. */}
      <NodeToolbar elementId={id} showEdit={false} />
      <NodeResizer
        isVisible={isDiagramModifiable}
        onResize={onResize}
        minWidth={20}
        maxWidth={20}
        minHeight={60}
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
            fill={fill}
            stroke="none"
          />
        </svg>
      </div>
      <PopoverManager
        anchorEl={wrapperRef.current}
        elementId={id}
        type={"StateForkNode" as const}
      />
    </DefaultNodeWrapper>
  )
}
