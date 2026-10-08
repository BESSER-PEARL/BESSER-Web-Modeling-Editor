import React from "react"
import { AGENTIC_GLYPH_COLOR, AgenticGlyphProps } from "./types"

export interface BPMNReflectionMarkerIconProps extends AgenticGlyphProps {
  /** Reflection-mode letter drawn under the brackets (s / c / h). */
  letter: string
}

/**
 * Agentic BPMN reflection marker (SEAA'25 § 4.4): two mirrored brackets
 * either side of a dashed mirror axis, with the reflection-mode letter below.
 * Agentic tasks only. 16×21 by default (viewBox 24×32).
 */
export const BPMNReflectionMarkerIcon: React.FC<BPMNReflectionMarkerIconProps> = ({
  x,
  y,
  letter,
  size = 16,
  color = AGENTIC_GLYPH_COLOR,
}) => (
  <svg
    x={x}
    y={y}
    width={size}
    height={(size * 21) / 16}
    viewBox="0 0 24 32"
    fill="none"
    stroke={color}
    strokeWidth={1.24}
    strokeLinejoin="round"
    strokeLinecap="round"
    overflow="visible"
    pointerEvents="none"
    aria-hidden="true"
    data-testid="bpmn-reflection-marker"
  >
    <path d="M1.6 2 L1.6 22 L9.6 16.4 L9.6 7.6 Z" />
    <path d="M22.4 2 L22.4 22 L14.4 16.4 L14.4 7.6 Z" />
    <path d="M12 1.5 L12 22.5" strokeDasharray="1.857 2.8" />
    <text x="12" y="31" fontSize="9" fill={color} stroke="none" textAnchor="middle" fontFamily="Arial">
      {letter}
    </text>
  </svg>
)
