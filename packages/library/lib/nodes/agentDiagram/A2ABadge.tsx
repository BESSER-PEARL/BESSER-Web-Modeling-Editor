import { useState } from "react"
import { useTranslation } from "@/i18n"
import { a2aTitle, type A2ATag } from "@/utils/a2aNotation"

/**
 * A2A (agent-to-agent) badges, ported from develop's `A2ABadge`: an outbound
 * chip at the bottom-right of an AgentState card (HTML, so the card's
 * export serializer draws it) and an inbound chip beside the transition label
 * (SVG, exported with the edge labels). A click toggles the "Send to / Receive
 * from <peer>" details, as in develop.
 *
 * Colours stay export-safe: one fixed blue for the glyph and border, the
 * label in the themed contrast colour.
 */

const A2A_ACCENT = "#3b82f6"
const TEXT = "var(--besser-primary-contrast, #0f172a)"
const SURFACE = "var(--besser-background, #ffffff)"

// Develop's envelope + arrow, in its own coordinates.
const GLYPH_VIEWBOX = { x: 4, y: 16, w: 38, h: 14 }
const GLYPH_HEIGHT = 9
const GLYPH_WIDTH = (GLYPH_VIEWBOX.w / GLYPH_VIEWBOX.h) * GLYPH_HEIGHT

function GlyphPaths({ dir }: { dir: "in" | "out" }) {
  return (
    <g fill="none" stroke={A2A_ACCENT} strokeLinecap="round" strokeLinejoin="round">
      <rect x="12" y="18" width="22" height="11" rx="2" strokeWidth="1.6" />
      <path d="M 12 18 L 23 24 L 34 18" strokeWidth="1.6" />
      <path
        d={dir === "in" ? "M 5 23 H 11 M 9 21 L 11 23 L 9 25" : "M 35 23 H 41 M 39 21 L 41 23 L 39 25"}
        strokeWidth="2"
      />
    </g>
  )
}

const useA2ATitle = (tags: A2ATag[]) => {
  const { t } = useTranslation()
  return a2aTitle(tags, t)
}

interface A2AChipProps {
  tags: A2ATag[]
  open: boolean
  onToggle: () => void
}

/** Outbound chip inside an AgentState card. */
export function A2AChip({ tags, open, onToggle }: A2AChipProps) {
  const title = useA2ATitle(tags)
  return (
    <button
      type="button"
      className="nodrag nopan"
      data-testid="a2a-out-badge"
      title={title}
      aria-label={title.replace(/\n/g, ", ")}
      aria-expanded={open}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      style={{
        // Bottom-right of the card body, where develop drew it.
        alignSelf: "flex-end",
        margin: "auto 0 0",
        flex: "0 0 auto",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        height: 20,
        boxSizing: "border-box",
        padding: "0 6px",
        borderRadius: 6,
        border: `1px solid color-mix(in srgb, ${A2A_ACCENT} 50%, transparent)`,
        background: `color-mix(in srgb, ${A2A_ACCENT} 10%, ${SURFACE})`,
        color: TEXT,
        font: "inherit",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.3,
        lineHeight: 1,
        cursor: "pointer",
      }}
    >
      <svg
        width={GLYPH_WIDTH}
        height={GLYPH_HEIGHT}
        viewBox={`${GLYPH_VIEWBOX.x} ${GLYPH_VIEWBOX.y} ${GLYPH_VIEWBOX.w} ${GLYPH_VIEWBOX.h}`}
        aria-hidden="true"
      >
        <GlyphPaths dir="out" />
      </svg>
      <span>A2A</span>
      {tags.length > 1 ? <span>×{tags.length}</span> : null}
    </button>
  )
}

/** The chip's detail list; the caller positions it beside the card. */
export function A2ADetails({ tags }: { tags: A2ATag[] }) {
  const lines = useA2ATitle(tags).split("\n")
  return (
    <div
      data-testid="a2a-details"
      className="nodrag nopan"
      style={{
        padding: "6px 9px",
        borderRadius: 8,
        border: `1px solid color-mix(in srgb, ${A2A_ACCENT} 50%, transparent)`,
        background: SURFACE,
        boxShadow: "var(--besser-chrome-shadow, 0 4px 14px rgba(15, 23, 42, 0.14))",
        color: TEXT,
        fontSize: 11,
        lineHeight: "16px",
        whiteSpace: "nowrap",
      }}
    >
      {lines.map((line, i) => (
        <div key={i}>{line}</div>
      ))}
    </div>
  )
}

export const A2A_EDGE_BADGE_WIDTH = 62
export const A2A_EDGE_BADGE_HEIGHT = 20

/** Inbound chip on a transition; (x, y) is its top-left corner. */
export function A2AEdgeBadge({ x, y, tag }: { x: number; y: number; tag: A2ATag }) {
  const [open, setOpen] = useState(false)
  const title = useA2ATitle([tag])
  const glyphScale = GLYPH_HEIGHT / GLYPH_VIEWBOX.h
  const w = A2A_EDGE_BADGE_WIDTH
  const h = A2A_EDGE_BADGE_HEIGHT
  // The transform sits on the `.edge-labels` group: the export clones that
  // group alone.
  return (
    <>
      <g
        transform={`translate(${x}, ${y})`}
        className="edge-labels nodrag nopan"
        data-testid="a2a-in-badge"
        role="button"
        aria-label={title}
        aria-expanded={open}
        style={{ cursor: "pointer", pointerEvents: "all" }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        <title>{title}</title>
        <rect width={w} height={h} rx={6} style={{ fill: SURFACE }} />
        <rect
          x={0.5}
          y={0.5}
          width={w - 1}
          height={h - 1}
          rx={5.5}
          fill={A2A_ACCENT}
          fillOpacity={0.1}
          stroke={A2A_ACCENT}
          strokeOpacity={0.5}
        />
        <g
          transform={`translate(6, ${(h - GLYPH_HEIGHT) / 2}) scale(${glyphScale}) translate(${-GLYPH_VIEWBOX.x}, ${-GLYPH_VIEWBOX.y})`}
        >
          <GlyphPaths dir="in" />
        </g>
        <text
          x={6 + GLYPH_WIDTH + 4}
          y={h / 2}
          dominantBaseline="central"
          style={{ fill: TEXT, fontSize: 10, fontWeight: 700, letterSpacing: 0.3 }}
        >
          A2A
        </text>
      </g>
      {open ? (
        <g
          data-testid="a2a-details"
          transform={`translate(${x}, ${y - 24})`}
          pointerEvents="none"
        >
          <rect
            width={Math.max(w, title.length * 6.2 + 18)}
            height={20}
            rx={6}
            style={{ fill: SURFACE }}
            stroke={A2A_ACCENT}
            strokeOpacity={0.5}
          />
          <text x={9} y={10} dominantBaseline="central" style={{ fill: TEXT, fontSize: 11 }}>
            {title}
          </text>
        </g>
      ) : null}
    </>
  )
}
