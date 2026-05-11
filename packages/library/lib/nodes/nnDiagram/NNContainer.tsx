import { NodeProps, NodeResizer, type Node } from "@xyflow/react"
import { useRef } from "react"
import { DefaultNodeWrapper } from "../wrappers"
import { useHandleOnResize } from "@/hooks"
import { useDiagramModifiable } from "@/hooks/useDiagramModifiable"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import { NodeToolbar } from "@/components/toolbars/NodeToolbar"
import { useDiagramStore } from "@/store/context"
import { NNContainerNodeProps } from "@/types"
import { LAYOUT } from "@/constants"
import { getCustomColorsFromData } from "@/utils/layoutUtils"

/**
 * `NNContainer` — UML-package-style parent node for a sequential layer
 * stack. A small "tab" sits on the top-left carrying the model name;
 * the body below holds the layers / TensorOps / NNReferences attached
 * via React-Flow `parentId`.
 *
 * Plain rectangle, no shadow, no tint. The tab visually anchors the
 * name without competing with the children rendered inside the body.
 */
export function NNContainer({
  id,
  width,
  height,
  data,
  parentId,
}: NodeProps<Node<NNContainerNodeProps>>) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const { onResize } = useHandleOnResize(parentId)
  const isDiagramModifiable = useDiagramModifiable()

  if (!width || !height) return null

  const { fillColor, strokeColor, textColor } = getCustomColorsFromData(data)
  const { name } = data
  const containerFill = !data.fillColor ? "#FFFFFF" : fillColor
  const borderWidth = LAYOUT.LINE_WIDTH

  // Tab metrics — fits the name plus a little side padding. The body
  // rectangle sits below; the tab visually overlaps its top-left edge
  // by 1 px so the strokes merge cleanly.
  const tabHeight = 24
  const namePadding = 18
  // Rough char width approximation; SVG renders monospaceish, this is
  // generous enough that tabs widen to fit longer names without
  // clipping. Capped so a long name doesn't push the tab beyond the
  // body width.
  const approxNameWidth = Math.max(name?.length ?? 0, 4) * 7.5
  const tabWidth = Math.min(width - 8, namePadding + approxNameWidth)
  const bodyTop = tabHeight

  const hasChildren = useDiagramStore((s) =>
    s.nodes.some((n) => n.parentId === id)
  )
  const hintLines = [
    "Drag Layers and TensorOps here",
    "Connect layers and tensorOps",
    "with 'next' relationship",
    "(Drag edges to resize)",
  ]
  const hintLineHeight = 18
  const hintBlockHeight = hintLines.length * hintLineHeight
  const hintTopY = bodyTop + (height - bodyTop - hintBlockHeight) / 2 + 14

  return (
    <DefaultNodeWrapper width={width} height={height} elementId={id}>
      <NodeToolbar elementId={id} />
      <NodeResizer
        isVisible={isDiagramModifiable}
        onResize={onResize}
        minWidth={200}
        minHeight={140}
        handleStyle={{ width: 8, height: 8 }}
      />
      <div ref={wrapperRef}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          overflow="visible"
        >
          {/* Name tab (top-left). Drawn first so the body stroke
              overlaps the tab's bottom edge, hiding the seam. */}
          <rect
            x={0}
            y={0}
            width={tabWidth}
            height={tabHeight}
            fill={containerFill}
            stroke={strokeColor}
            strokeWidth={borderWidth}
          />
          <text
            x={tabWidth / 2}
            y={tabHeight / 2 + 5}
            textAnchor="middle"
            fontSize={LAYOUT.NAME_FONT_SIZE - 2}
            fontWeight="600"
            fill={textColor}
          >
            {name}
          </text>

          {/* Container body */}
          <rect
            x={0}
            y={bodyTop}
            width={width}
            height={height - bodyTop}
            fill={containerFill}
            stroke={strokeColor}
            strokeWidth={borderWidth}
          />

          {!hasChildren &&
            hintLines.map((line, i) => (
              <text
                key={i}
                x={width / 2}
                y={hintTopY + i * hintLineHeight}
                textAnchor="middle"
                fontSize={13}
                fill={textColor}
                opacity={0.55}
              >
                {line}
              </text>
            ))}
        </svg>
      </div>
      <PopoverManager
        anchorEl={wrapperRef.current}
        elementId={id}
        type={"NNContainer" as never}
      />
    </DefaultNodeWrapper>
  )
}
