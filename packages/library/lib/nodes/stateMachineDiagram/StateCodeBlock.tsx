import { NodeProps, NodeResizer, type Node } from "@xyflow/react"
import { usePopoverAnchor } from "@/hooks/usePopoverAnchor"
import { DefaultNodeWrapper } from "../wrappers"
import { useHandleOnResize } from "@/hooks"
import { useDiagramModifiable } from "@/hooks/useDiagramModifiable"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import { NodeToolbar } from "@/components/toolbars/NodeToolbar"
import { StateCodeBlockProps } from "@/types"
import { getCustomColorsFromData } from "@/utils/layoutUtils"
import { StateCodeBlockShape } from "@/components/svgs/nodes/stateMachineDiagram/StateShape"

/**
 * Resizable code panel: a language header over the code, drawn by
 * `StateCodeBlockShape` (shared with the palette preview).
 *
 * In v4 this is its own React-Flow node — the brief allows it to attach
 * via `parentId` to a containing State, but it can also free-float (the
 * v3 fork supported both shapes).
 */
export function StateCodeBlock({
  id,
  width,
  height,
  data,
  parentId,
}: NodeProps<Node<StateCodeBlockProps>>) {
  const [wrapperEl, wrapperRef] = usePopoverAnchor<HTMLDivElement>()
  const { onResize } = useHandleOnResize(parentId)
  const isDiagramModifiable = useDiagramModifiable()

  if (!width || !height) return null

  const { fillColor, strokeColor, textColor } = getCustomColorsFromData(data)
  const { code = "", language = "python" } = data

  return (
    <DefaultNodeWrapper width={width} height={height} elementId={id}>
      <NodeToolbar elementId={id} />
      <NodeResizer
        isVisible={isDiagramModifiable}
        onResize={onResize}
        minWidth={150}
        minHeight={100}
        handleStyle={{ width: 8, height: 8 }}
      />
      <div ref={wrapperRef}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          overflow="visible"
        >
          <StateCodeBlockShape
            width={width}
            height={height}
            code={code}
            language={language}
            fillColor={fillColor}
            strokeColor={strokeColor}
            textColor={textColor}
            clipId={`code-clip-${id}`}
          />
        </svg>
      </div>
      <PopoverManager
        anchorEl={wrapperEl}
        elementId={id}
        type={"StateCodeBlock" as const}
      />
    </DefaultNodeWrapper>
  )
}
