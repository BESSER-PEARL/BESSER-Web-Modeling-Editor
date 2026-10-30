import React from "react"

/**
 * `AgentNodeCard` — the shared HTML card shell for AgentDiagram nodes AND
 * their palette previews (single source of truth: canvas === palette ===
 * drag ghost).
 *
 * Styled for a restrained, modern flow-editor look rather than a colorful
 * "sticker" card: a neutral surface with a hairline border and a soft
 * layered shadow, and exactly ONE accent cue — a soft-tinted icon badge
 * (accent glyph on an accent-12% chip). Type label, pills and metadata
 * badges are muted/neutral so the canvas stays calm even with many nodes.
 * Theme-aware via the `--besser-*` vars + `color-mix`.
 *
 * Sized in explicit px from the node's `width`/`height` (same contract as
 * the old SVG nodes) so React Flow resize + handle geometry stay correct.
 */

const CARD_FONT = "Inter, system-ui, Avenir, Helvetica, Arial, sans-serif"

export const AGENT_CARD_HEADER_HEIGHT = 44

const tint = (accent: string, pct: number) =>
  `color-mix(in srgb, ${accent} ${pct}%, transparent)`

/** Accent as foreground ink: lifted toward white in dark mode
 * (`--besser-accent-lift`, app.css) so it reads on the dark card. */
const ink = (accent: string) =>
  `color-mix(in srgb, ${accent}, white var(--besser-accent-lift, 0%))`

/** Neutral hairline that adapts to light/dark (primary-contrast flips). */
const HAIRLINE =
  "color-mix(in srgb, var(--besser-primary-contrast, #0f172a) 10%, transparent)"
const MUTED = "var(--besser-gray-variant, #64748b)"

export interface AgentNodeCardProps {
  width: number
  height: number
  accent: string
  icon: React.ReactNode
  /** Stereotype label, e.g. "state", "tool" — rendered uppercase, muted. */
  typeLabel: string
  name: string
  /** Custom surface override (data.fillColor) — else themed background. */
  surface?: string
  /** Custom text override (data.textColor) — else themed contrast. */
  textColor?: string
  /** Optional right-aligned header slot (a badge). */
  headerRight?: React.ReactNode
  italic?: boolean
  underline?: boolean
  children?: React.ReactNode
}

export function AgentNodeCard({
  width,
  height,
  accent,
  icon,
  typeLabel,
  name,
  surface,
  textColor,
  headerRight,
  italic,
  underline,
  children,
}: AgentNodeCardProps) {
  const surfaceColor = surface || "var(--besser-background, #ffffff)"
  const title = textColor || "var(--besser-primary-contrast, #0f172a)"
  const hasBody = children != null

  return (
    <div
      // getSVG serializes this card into SVG shapes and text on export.
      data-export-html=""
      style={{
        width,
        height,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        background: surfaceColor,
        border: `1px solid ${HAIRLINE}`,
        borderRadius: 14,
        boxShadow:
          "0 1px 2px rgba(16, 24, 40, 0.06), 0 10px 24px -12px rgba(16, 24, 40, 0.16)",
        overflow: "hidden",
        fontFamily: CARD_FONT,
        position: "relative",
      }}
    >
      {/* Accent rail along the left edge (clipped by the card radius). */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: ink(accent),
        }}
      />
      {/* Header — faint accent wash behind the icon badge and name */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          padding: "0 10px 0 12px",
          minHeight: AGENT_CARD_HEADER_HEIGHT,
          boxSizing: "border-box",
          background: `linear-gradient(180deg, ${tint(accent, 8)}, ${tint(accent, 2)})`,
          borderBottom: hasBody ? `1px solid ${HAIRLINE}` : "none",
        }}
      >
        <span
          style={{
            flex: "0 0 auto",
            width: 28,
            height: 28,
            borderRadius: 9,
            background: tint(accent, 12),
            color: ink(accent),
            display: "grid",
            placeItems: "center",
          }}
        >
          {icon}
        </span>
        <div
          style={{
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            lineHeight: 1.25,
          }}
        >
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 10.5,
              fontWeight: 500,
              color: MUTED,
            }}
          >
            <span style={{ textTransform: "capitalize" }}>{typeLabel}</span>
          </span>
          <span
            title={name}
            style={{
              fontSize: 14,
              fontWeight: 650,
              color: title,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              fontStyle: italic ? "italic" : undefined,
              textDecoration: underline ? "underline" : undefined,
            }}
          >
            {name}
          </span>
        </div>
        {headerRight ? (
          <div
            style={{
              marginLeft: "auto",
              flex: "0 0 auto",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            {headerRight}
          </div>
        ) : null}
      </div>

      {/* Body */}
      {hasBody ? (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
            padding: "7px 9px 7px 11px",
            display: "flex",
            flexDirection: "column",
            gap: 5,
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  )
}

export interface AgentPillProps {
  icon?: React.ReactNode
  label: string
  /** Kept for API compatibility; pills are intentionally neutral now. */
  accent?: string
  /** Dashed border (used for fallback / secondary rows). */
  dashed?: boolean
  /** Short right-aligned kind tag, e.g. "LLM". */
  tag?: string
}

/** A quiet, neutral "step" row — a reply inside a State card, an intent
 * training phrase, etc. The kind icon sits in a small muted tile; the
 * accent stays reserved for the card's icon badge and rail. */
export function AgentPill({ icon, label, dashed, tag }: AgentPillProps) {
  return (
    <div
      title={label}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        minHeight: 24,
        padding: "3px 8px 3px 3px",
        borderRadius: 8,
        background: dashed
          ? "transparent"
          : "color-mix(in srgb, var(--besser-primary-contrast, #0f172a) 3%, transparent)",
        border: `1px ${dashed ? "dashed" : "solid"} ${HAIRLINE}`,
        fontSize: 12,
        color: dashed ? MUTED : "var(--besser-primary-contrast, #0f172a)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      {icon != null ? (
        <span
          style={{
            flex: "0 0 auto",
            width: 16,
            height: 16,
            borderRadius: 5,
            display: "grid",
            placeItems: "center",
            color: MUTED,
            background:
              "color-mix(in srgb, var(--besser-primary-contrast, #0f172a) 7%, transparent)",
          }}
        >
          {icon}
        </span>
      ) : null}
      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
        {label}
      </span>
      {tag ? (
        <span
          style={{
            flex: "0 0 auto",
            fontSize: 9.5,
            fontWeight: 600,
            letterSpacing: 0.4,
            color: MUTED,
          }}
        >
          {tag}
        </span>
      ) : null}
    </div>
  )
}

export interface AgentBadgeProps {
  children: React.ReactNode
  /** Kept for API compatibility; badges are intentionally neutral now. */
  accent?: string
}

/** A subtle, neutral metadata badge for the header (LLM name, k, rw…). */
export function AgentBadge({ children }: AgentBadgeProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 10,
        fontWeight: 500,
        padding: "2px 7px",
        borderRadius: 6,
        background:
          "color-mix(in srgb, var(--besser-primary-contrast, #0f172a) 5%, transparent)",
        border: `1px solid ${HAIRLINE}`,
        color: MUTED,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  )
}

/** Small muted section label inside a card body (e.g. "fallback"),
 * followed by a hairline. */
export function AgentSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 9.5,
        fontWeight: 600,
        letterSpacing: 0.6,
        textTransform: "uppercase",
        color: MUTED,
        padding: "3px 2px 0",
      }}
    >
      {children}
      <span style={{ flex: 1, height: 1, background: HAIRLINE }} />
    </span>
  )
}
