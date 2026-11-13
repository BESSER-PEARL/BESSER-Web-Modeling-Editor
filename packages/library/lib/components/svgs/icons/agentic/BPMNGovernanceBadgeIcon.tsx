import React from "react"
import { AGENTIC_GLYPH_COLOR, AgenticGlyphProps } from "./types"

/**
 * Governance badge: a document with a check mark, drawn top-right of a
 * merging agentic gateway only while a governance policy (`governanceDsl`) is
 * attached. It does not name the policy type. 14×14 by default (viewBox 16×16).
 */
export const BPMNGovernanceBadgeIcon: React.FC<AgenticGlyphProps> = ({
  x,
  y,
  size = 14,
  color = AGENTIC_GLYPH_COLOR,
}) => (
  <svg
    x={x}
    y={y}
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    stroke={color}
    strokeWidth={1.2}
    strokeLinecap="round"
    strokeLinejoin="round"
    overflow="visible"
    pointerEvents="none"
    aria-hidden="true"
    data-testid="bpmn-governance-badge"
  >
    <path d="M4 1.5 h6 l2.5 2.5 v10.5 h-8.5 z" />
    <path d="M10 1.5 v2.5 h2.5" />
    <path d="M5.5 9.5 l1.5 1.5 l3 -3.5" />
  </svg>
)
