import { NodeProps, NodeResizer, type Node } from "@xyflow/react"
import { useRef } from "react"
import { DefaultNodeWrapper } from "@/nodes/wrappers"
import { CommentNodeProps } from "@/types"
import { useDiagramModifiable } from "@/hooks/useDiagramModifiable"
import { NodeToolbar } from "@/components/toolbars/NodeToolbar"
import { PopoverManager } from "@/components/popovers/PopoverManager"

/**
 * SA-HIDE-NOISE: Comment sticky-note node ported from v3
 * (`packages/editor/src/main/packages/common/comments/comments-component.tsx`).
 *
 * v3 rendered a rounded-rectangle speech-bubble shape with a small
 * downward pointer. We keep that silhouette so existing fixtures look
 * familiar after migration. The comment body is stored on `data.name`
 * for parity with the v3 element, which reused `UMLElement.name` as the
 * free-form body.
 *
 * Default fill / stroke / text colours are tuned to the canonical
 * "yellow sticky note" look. Authors override per-instance via the
 * inspector's colour swatches (these flow through `DefaultNodeProps`
 * fillColor / strokeColor / textColor).
 *
 * The node intentionally does NOT expose connection handles — comments
 * are untethered notes (per the SA-HIDE-NOISE brief: "comments float
 * as untethered sticky notes; binding to elements can be added later").
 */
const MIN_WIDTH = 120
const MIN_HEIGHT = 50
const POINTER_HEIGHT = 10
const POINTER_WIDTH = 12
const CORNER_RADIUS = 8
const PADDING = 8

function wrapText(
  text: string,
  maxCharsPerLine: number,
  maxLines: number
): string[] {
  if (!text) return []
  const lines: string[] = []
  for (const paragraph of text.split(/\n/)) {
    if (!paragraph) {
      lines.push("")
      continue
    }
    const words = paragraph.split(/\s+/)
    let current = ""
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word
      if (candidate.length <= maxCharsPerLine) {
        current = candidate
      } else {
        if (current) lines.push(current)
        if (word.length > maxCharsPerLine) {
          const re = new RegExp(`.{1,${maxCharsPerLine}}`, "g")
          const chunks = word.match(re) || []
          lines.push(...chunks.slice(0, -1))
          current = chunks[chunks.length - 1] || ""
        } else {
          current = word
        }
      }
    }
    if (current) lines.push(current)
  }
  if (lines.length > maxLines) {
    const out = lines.slice(0, maxLines - 1)
    const last = lines[maxLines - 1] ?? ""
    out.push(last.slice(0, Math.max(0, maxCharsPerLine - 3)) + "…")
    return out
  }
  return lines
}

export function Comment({
  id,
  width,
  height,
  data,
}: NodeProps<Node<CommentNodeProps>>) {
  const isDiagramModifiable = useDiagramModifiable()
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  const w = Math.max(width ?? 0, MIN_WIDTH)
  const h = Math.max(height ?? 0, MIN_HEIGHT)

  // SA-FINAL-3 Tier 2 #6: theme-portable sticky-note palette. See ClassOCLConstraint.
  const fillColor = data.fillColor || "var(--besser-sticky-fill, #fff8c4)"
  const strokeColor = data.strokeColor || "var(--besser-sticky-stroke, #bda21f)"
  const textColor = data.textColor || "var(--besser-sticky-text, #3a2e00)"

  const bodyHeight = h - POINTER_HEIGHT
  const innerWidth = w - PADDING * 2
  const innerHeight = bodyHeight - PADDING * 2
  const charsPerLine = Math.max(6, Math.floor(innerWidth / 7))
  const maxLines = Math.max(1, Math.floor(innerHeight / 14))
  const lines = wrapText(data.name || "", charsPerLine, maxLines)

  // SA-FINAL-3 Tier 7 #26: make Comment handles visible so the user can
  // anchor a CommentLink dependency arrow to any element. Full CommentLink
  // inspector port is TODO — for now the placeholder edge type is registered
  // in `edges/edgeTypes/index.ts` and uses the dashed dependency style.
  return (
    <DefaultNodeWrapper
      width={w}
      height={h}
      elementId={id}
    >
      <NodeToolbar elementId={id} />
      <NodeResizer
        nodeId={id}
        isVisible={isDiagramModifiable}
        minWidth={MIN_WIDTH}
        minHeight={MIN_HEIGHT}
        handleStyle={{ width: 8, height: 8 }}
      />
      <div ref={wrapperRef}>
        <svg width={w} height={h} style={{ overflow: "visible" }}>
          <path
            d={`
              M ${CORNER_RADIUS} 0
              L ${w - CORNER_RADIUS} 0
              Q ${w} 0 ${w} ${CORNER_RADIUS}
              L ${w} ${bodyHeight - CORNER_RADIUS}
              Q ${w} ${bodyHeight} ${w - CORNER_RADIUS} ${bodyHeight}
              L ${POINTER_WIDTH + 5} ${bodyHeight}
              L ${POINTER_WIDTH / 2} ${h}
              L 5 ${bodyHeight}
              Q 0 ${bodyHeight} 0 ${bodyHeight - CORNER_RADIUS}
              L 0 ${CORNER_RADIUS}
              Q 0 0 ${CORNER_RADIUS} 0 Z
            `}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={1.2}
            strokeMiterlimit="10"
          />
          <g transform={`translate(${PADDING}, ${PADDING + 4})`}>
            <text
              fill={textColor}
              style={{
                fontSize: "12px",
                dominantBaseline: "hanging",
              }}
            >
              {lines.map((line, i) => (
                <tspan key={i} x={0} dy={i === 0 ? 0 : 14}>
                  {line || " "}
                </tspan>
              ))}
            </text>
          </g>
        </svg>
      </div>

      <PopoverManager
        anchorEl={wrapperRef.current}
        elementId={id}
        type={"comment" as const}
      />
    </DefaultNodeWrapper>
  )
}

export default Comment
