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
  /** Marks the agent's initial (entry) state — renders an "initial" pill. */
  initial?: boolean
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
  initial,
  children,
}: AgentNodeCardProps) {
  const surfaceColor = surface || "var(--besser-background, #ffffff)"
  const title = textColor || "var(--besser-primary-contrast, #0f172a)"
  const hasBody = children != null

  return (
    <div
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
      }}
    >
      {/* Header — clean neutral row; accent lives only in the icon badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          padding: "0 10px",
          minHeight: AGENT_CARD_HEADER_HEIGHT,
          boxSizing: "border-box",
          borderBottom: hasBody ? `1px solid ${HAIRLINE}` : "none",
        }}
      >
        <span
          style={{
            flex: "0 0 auto",
            width: 28,
            height: 28,
            borderRadius: 8,
            background: tint(accent, 12),
            color: accent,
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
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: 0.7,
              color: MUTED,
              textTransform: "uppercase",
            }}
          >
            {typeLabel}
          </span>
          <span
            title={name}
            style={{
              fontSize: 13.5,
              fontWeight: 600,
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
        {initial || headerRight ? (
          <div
            style={{
              marginLeft: "auto",
              flex: "0 0 auto",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            {initial ? (
              <span
                style={{
                  fontSize: 8.5,
                  fontWeight: 700,
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                  color: accent,
                  background: tint(accent, 12),
                  border: `1px solid ${tint(accent, 40)}`,
                  borderRadius: 5,
                  padding: "2px 6px",
                  whiteSpace: "nowrap",
                }}
              >
                initial
              </span>
            ) : null}
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
            padding: "7px 9px",
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
}

/** A quiet, neutral "step" chip — a reply row inside a State card, an
 * intent training phrase, etc. The reply-kind icon is muted; the accent
 * stays reserved for the card's icon badge. */
export function AgentPill({ icon, label, dashed }: AgentPillProps) {
  return (
    <div
      title={label}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        padding: "3px 8px",
        borderRadius: 8,
        background: dashed
          ? "transparent"
          : "color-mix(in srgb, var(--besser-primary-contrast, #0f172a) 4%, transparent)",
        border: `1px ${dashed ? "dashed" : "solid"} ${HAIRLINE}`,
        fontSize: 12,
        color: "var(--besser-primary-contrast, #0f172a)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        boxSizing: "border-box",
        fontStyle: dashed ? "italic" : undefined,
      }}
    >
      {icon != null ? (
        <span style={{ display: "inline-flex", color: MUTED, flex: "0 0 auto" }}>
          {icon}
        </span>
      ) : null}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
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

/** Small muted section label inside a card body (e.g. "fallback"). */
export function AgentSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 600,
        letterSpacing: 0.6,
        textTransform: "uppercase",
        color: MUTED,
        padding: "2px 2px 0",
      }}
    >
      {children}
    </span>
  )
}
