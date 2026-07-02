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

// Read-only stereotype badge derived from the OCL text — mirrors develop's
// `deriveBadge` (v3 source: uml-class-ocl/uml-class-ocl-constraint-component.tsx)
// and the backend's routing regex: `context X (inv|pre|post) ...` for
// invariants, `context X::method(params) (pre|post) ...` for method contracts.
// `data.kind` wins when present (legacy v3 fixtures carry it explicitly);
// otherwise derive live from the expression as the user types, exactly like
// develop. Purely a visual cue — the source of truth is the constraint text.
const OCL_HEADER_RE = /\bcontext\s+\w+(?:::(\w+)\s*\([^)]*\))?\s+(inv|pre|post)\b/i
const OCL_BADGE_LABEL: Record<string, string> = {
  inv: "«inv»",
  pre: "«pre»",
  post: "«post»",
}

function deriveBadge(
  expression: string,
  explicitKind?: string
): { label: string; method?: string } | null {
  const explicit = explicitKind?.toLowerCase()
  if (explicit && OCL_BADGE_LABEL[explicit]) {
    return { label: OCL_BADGE_LABEL[explicit] }
  }
  if (!expression) return null
  const match = OCL_HEADER_RE.exec(expression)
  if (!match) return null
  const method = match[1] || undefined
  const kw = match[2].toLowerCase()
  return { label: OCL_BADGE_LABEL[kw], method }
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
  const badge = deriveBadge(data.expression || "", data.kind)
  const showName = name.length > 0
  const showHeader = showName || !!badge
  const contentTop = padding + (showHeader ? headerHeight : 0)
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
          {/* «inv»/«pre»/«post» stereotype badge, live-derived from the OCL
              text (parity with develop's ClassOCLConstraintComponent).
              Right-aligned so it never collides with the name header. */}
          {badge && (
            <text
              x={w - fold - 4}
              y={padding + 2}
              textAnchor="end"
              fill={textColor}
              style={{
                fontSize: "11px",
                fontWeight: 600,
                fontStyle: "italic",
                dominantBaseline: "hanging",
              }}
            >
              {badge.label}
              {badge.method ? ` ${badge.method}` : ""}
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
