import React from "react"
import { AGENTIC_GLYPH_COLOR, AgenticGlyphProps } from "./types"

/**
 * Agentic BPMN merge marker for merging gateways (SEAA'25 § 4.4): two bars
 * with inward-pointing arrows. It names no strategy (that lives in the
 * governance DSL). 16×16 by default (viewBox 18×16).
 */
export const BPMNMergeMarkerIcon: React.FC<AgenticGlyphProps> = ({
  x,
  y,
  size = 16,
  color = AGENTIC_GLYPH_COLOR,
}) => (
  <svg
    x={x}
    y={y}
    width={size}
    height={size}
    viewBox="0 0 18 16"
    fill="none"
    stroke={color}
    strokeWidth={0.93}
    strokeLinecap="round"
    strokeLinejoin="round"
    overflow="visible"
    pointerEvents="none"
    aria-hidden="true"
    data-testid="bpmn-merge-marker"
  >
    <path d="M 1,15 V 1 M 17,15 V 1 m -1,7 h -5 m 0,0 2,-2 m -2,2 2,2 M 2,8 H 7 M 7,8 5,10 M 7,8 5,6" />
  </svg>
)
