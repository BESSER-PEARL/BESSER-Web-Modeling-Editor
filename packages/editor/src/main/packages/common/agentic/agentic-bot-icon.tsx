import React, { FunctionComponent } from 'react';
import { ThemedPath } from '../../../components/theme/themedComponents';

interface Props {
  /** Top-left x of the glyph in the parent SVG coordinate space. */
  x: number;
  /** Top-left y of the glyph in the parent SVG coordinate space. */
  y: number;
  /** Element stroke colour — passed through ThemedPath for theme resolution. */
  strokeColor?: string;
}

/**
 * Robot-head glyph marking an agentic element on the canvas. ~16 px tall.
 */
export const AgenticBotIcon: FunctionComponent<Props> = ({ x, y, strokeColor }) => (
  <g transform={`translate(${x}, ${y})`} pointerEvents="none" data-cy="agentic-bot-icon">
    {/* antenna stem */}
    <ThemedPath d="M9 1 L9 5" fillColor="none" strokeColor={strokeColor} strokeWidth="1.4" />
    {/* antenna tip */}
    <ThemedPath d="M9 -1 L10.6 1 L9 3 L7.4 1 Z" fillColor={strokeColor} strokeColor={strokeColor} strokeWidth="0.6" />
    {/* head */}
    <ThemedPath
      d="M5 5 L13 5 Q15 5 15 7 L15 13 Q15 15 13 15 L5 15 Q3 15 3 13 L3 7 Q3 5 5 5 Z"
      fillColor="none"
      strokeColor={strokeColor}
      strokeWidth="1.4"
    />
    {/* eyes */}
    <ThemedPath d="M6 9 L8 9 L8 11 L6 11 Z" fillColor={strokeColor} strokeColor={strokeColor} strokeWidth="0.4" />
    <ThemedPath d="M10 9 L12 9 L12 11 L10 11 Z" fillColor={strokeColor} strokeColor={strokeColor} strokeWidth="0.4" />
  </g>
);
