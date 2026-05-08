import { NodeProps, NodeResizer, type Node } from "@xyflow/react"
import { useRef } from "react"
import { DefaultNodeWrapper } from "@/nodes/wrappers"
import { ClassOCLConstraintNodeProps } from "@/types"
import { useDiagramModifiable } from "@/hooks/useDiagramModifiable"
import { NodeToolbar } from "@/components/toolbars/NodeToolbar"
import { PopoverManager } from "@/components/popovers/PopoverManager"

/**
 * SA-UX-FIX B1: Free-standing OCL constraint node.
 *
 * Source-of-truth port:
 *   `packages/editor/.../uml-class-ocl/uml-class-ocl-constraint-component.tsx`
 *
 * Rendered as a sticky-note rectangle with a folded corner — visually
 * distinct from a class node. Shows the constraint name (header), the
 * derived `«inv»/«pre»/«post»` badge (if the expression carries the
 * canonical `context X (inv|pre|post)` header), and a wrapped preview
 * of the expression body.
 *
 * Authoring happens in the inspector (`ClassEditPanel` already has an
 * `OCLConstraintRow` component — when this node is selected, the
 * inspector switches to a single-row mode keyed on `data.expression`).
 */
const _OCL_HEADER_RE =
  /\bcontext\s+\w+(?:::(\w+)\s*\([^)]*\))?\s+(inv|pre|post)\b/i
const _BADGE_LABEL: Record<string, string> = {
  inv: "«inv»",
  pre: "«pre»",
  post: "«post»",
}

function deriveBadge(
  constraint: string,
  explicitKind?: string
): { label: string; method?: string } | null {
  if (explicitKind) {
    const k = explicitKind.toLowerCase()
    const short = k === "invariant" ? "inv" : k
    if (_BADGE_LABEL[short]) return { label: _BADGE_LABEL[short] }
  }
  if (!constraint) return null
  const match = _OCL_HEADER_RE.exec(constraint)
  if (!match) return null
  const method = match[1] || undefined
  const kw = match[2].toLowerCase()
  return { label: _BADGE_LABEL[kw], method }
}

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
  const contentWidth = w - padding * 2
  const contentHeight = h - padding * 2 - 18 // reserve for header

  const badge = deriveBadge(data.expression || "", data.kind)
  const charsPerLine = Math.max(8, Math.floor((contentWidth - 4) / 7))
  const maxLines = Math.max(1, Math.floor((contentHeight - 8) / 14))
  const lines = wrapText(data.expression || "", charsPerLine, maxLines)

  const fillColor = data.fillColor || "#fff8c4" // sticky-note yellow
  const strokeColor = data.strokeColor || "#bda21f"
  const textColor = data.textColor || "#3a2e00"

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

          {/* Constraint name (header). */}
          <text
            x={padding}
            y={padding + 4}
            fill={textColor}
            style={{
              fontSize: "12px",
              fontWeight: 600,
              dominantBaseline: "hanging",
            }}
          >
            {data.name || "constraint"}
          </text>

          {/* Stereotype badge (inv / pre / post). */}
          {badge && (
            <text
              x={padding}
              y={padding + 18}
              fill={textColor}
              style={{
                fontSize: "10px",
                fontStyle: "italic",
                fontWeight: 600,
                dominantBaseline: "hanging",
              }}
            >
              {badge.label}
              {badge.method ? ` ${badge.method}` : ""}
            </text>
          )}

          {/* Wrapped expression body. */}
          <g
            transform={`translate(${padding}, ${
              padding + (badge ? 34 : 22)
            })`}
          >
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

      <PopoverManager
        anchorEl={wrapperRef.current}
        elementId={id}
        type={"ClassOCLConstraint" as const}
      />
    </DefaultNodeWrapper>
  )
}

export default ClassOCLConstraintNode
