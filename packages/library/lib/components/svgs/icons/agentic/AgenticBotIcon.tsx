import React from "react"
import { AGENTIC_GLYPH_COLOR, AgenticGlyphProps } from "./types"

/**
 * Robot-head glyph marking an agentic element (BPMN task / lane / gateway,
 * agent-stereotyped component). Drawn on a 16px grid whose antenna tip pokes
 * 1px above `y`, as in develop; `size` scales the whole glyph.
 */
export const AgenticBotIcon: React.FC<AgenticGlyphProps> = ({
  x,
  y,
  size = 16,
  color = AGENTIC_GLYPH_COLOR,
}) => (
  <g
    transform={`translate(${x}, ${y})${size === 16 ? "" : ` scale(${size / 16})`}`}
    pointerEvents="none"
    aria-hidden="true"
    data-testid="agentic-bot-icon"
  >
    {/* antenna stem */}
    <path d="M9 1 L9 5" fill="none" stroke={color} strokeWidth={1.4} />
    {/* antenna tip */}
    <path d="M9 -1 L10.6 1 L9 3 L7.4 1 Z" fill={color} stroke={color} strokeWidth={0.6} />
    {/* head */}
    <path
      d="M5 5 L13 5 Q15 5 15 7 L15 13 Q15 15 13 15 L5 15 Q3 15 3 13 L3 7 Q3 5 5 5 Z"
      fill="none"
      stroke={color}
      strokeWidth={1.4}
    />
    {/* eyes */}
    <path d="M6 9 L8 9 L8 11 L6 11 Z" fill={color} stroke={color} strokeWidth={0.4} />
    <path d="M10 9 L12 9 L12 11 L10 11 Z" fill={color} stroke={color} strokeWidth={0.4} />
  </g>
)
