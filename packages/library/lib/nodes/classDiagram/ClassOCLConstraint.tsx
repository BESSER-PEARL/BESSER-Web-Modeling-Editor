import { NodeProps, NodeResizer, type Node } from "@xyflow/react"
import { useRef } from "react"
import { Tooltip } from "@mui/material"
import { DefaultNodeWrapper } from "@/nodes/wrappers"
import { ClassOCLConstraintNodeProps } from "@/types"
import { useDiagramModifiable } from "@/hooks/useDiagramModifiable"
import { NodeToolbar } from "@/components/toolbars/NodeToolbar"
import { PopoverManager } from "@/components/popovers/PopoverManager"

/**
 * Free-standing OCL constraint node, rendered as a sticky-note rectangle
 * with a folded corner. The canvas shows:
 *  - `data.name` as a small bold header (so the user can identify the
 *    constraint at a glance; the inspector edits only expression and
 *    description, so name is read-only from templates / import).
 *  - `data.expression` wrapped as the body.
 *  - `data.description` is reachable via the hover tooltip.
 * No kind badge — that lives only in the round-trip data.
 */
function wrapText(text: string, maxCharsPerLine: number, maxLines: number): string[] {
  if (!text) return []
  const words = text.split(/\s+/)
  const lines: string[] = []
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
  if (lines.length > maxLines) {
    const out = lines.slice(0, maxLines - 1)
    const last = lines[maxLines - 1]
    out.push(last.slice(0, Math.max(0, maxCharsPerLine - 3)) + "…")
    return out
  }
  return lines
}

const MIN_WIDTH = 160
const MIN_HEIGHT = 80

export function ClassOCLConstraintNode({
  id,
  width,
  height,
  data,
}: NodeProps<Node<ClassOCLConstraintNodeProps>>) {
  const isDiagramModifiable = useDiagramModifiable()
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  const w = Math.max(width ?? 0, MIN_WIDTH)
  const h = Math.max(height ?? 0, MIN_HEIGHT)

  const fold = 14
  const padding = 12
  const headerHeight = 18
  const name = (data.name ?? "").trim()
  const showName = name.length > 0
  const contentTop = padding + (showName ? headerHeight : 0)
  const contentWidth = w - padding * 2
  const contentHeight = h - contentTop - padding

  const charsPerLine = Math.max(8, Math.floor((contentWidth - 4) / 7))
  const maxLines = Math.max(1, Math.floor(contentHeight / 14))
  const lines = wrapText(data.expression || "", charsPerLine, maxLines)

  // Theme-portable sticky-note palette. Vars defined
  // in themings.json switch the OCL/Comment note to a muted amber in dark
  // mode while keeping the v3 Post-it yellow in light mode.
  const fillColor = data.fillColor || "var(--besser-sticky-fill, #fff8c4)"
  const strokeColor = data.strokeColor || "var(--besser-sticky-stroke, #bda21f)"
  const textColor = data.textColor || "var(--besser-sticky-text, #3a2e00)"

  // Surface `data.description` as a hover tooltip so
  // the long-form description is reachable on the canvas without opening the
  // inspector. Only mount the Tooltip when there's something to show.
  const description = (data.description ?? "").trim()
  const tooltipDisabled = description.length === 0

  return (
    <DefaultNodeWrapper width={w} height={h} elementId={id}>
      <NodeToolbar elementId={id} />
      <NodeResizer
        nodeId={id}
        isVisible={isDiagramModifiable}
        minWidth={MIN_WIDTH}
        minHeight={MIN_HEIGHT}
        handleStyle={{ width: 8, height: 8 }}
      />
      <Tooltip
        title={description}
        disableHoverListener={tooltipDisabled}
        disableFocusListener={tooltipDisabled}
        disableTouchListener={tooltipDisabled}
        placement="top"
        arrow
      >
      <div ref={wrapperRef}>
        <svg width={w} height={h} style={{ overflow: "visible" }}>
          {/* Outer note shape with folded corner. */}
          <path
            d={`M 0 0 L ${w - fold} 0 L ${w} ${fold} L ${w} ${h} L 0 ${h} Z`}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={1.2}
          />
          {/* Folded-corner overlay. */}
          <path
            d={`M ${w - fold} 0 L ${w - fold} ${fold} L ${w} ${fold}`}
            fill="none"
            stroke={strokeColor}
            strokeWidth={1.2}
          />

          {/* Constraint name header — read-only from `data.name`. The
              inspector exposes only expression + description, so name
              comes from templates / import. */}
          {showName && (
            <text
              x={padding}
              y={padding + 2}
              fill={textColor}
              style={{
                fontSize: "12px",
                fontWeight: 600,
                dominantBaseline: "hanging",
              }}
            >
              {name}
            </text>
          )}
          {/* Wrapped expression body. */}
          <g transform={`translate(${padding}, ${contentTop})`}>
            <text
              fill={textColor}
              style={{
                fontSize: "11px",
                fontFamily:
                  "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace",
                dominantBaseline: "hanging",
              }}
            >
              {lines.map((line, i) => (
                <tspan key={i} x={0} dy={i === 0 ? 0 : 14}>
                  {line}
                </tspan>
              ))}
            </text>
          </g>
        </svg>
      </div>
      </Tooltip>

      <PopoverManager
        anchorEl={wrapperRef.current}
        elementId={id}
        type={"ClassOCLConstraint" as const}
      />
    </DefaultNodeWrapper>
  )
}

export default ClassOCLConstraintNode
