import React, { FunctionComponent } from 'react';
import { Text } from '../../../components/controls/text/text';
import { AgentStateMember } from './agent-state-member';
import { ThemedRect } from '../../../components/theme/themedComponents';
import { truncateTextToWidth } from '../text-truncation';

interface Props {
  element: AgentStateMember;
  fillColor?: string;
}

const preserveTabs = (str: string): string => str.replace(/\t/g, '    ');

const CODE_FONT_SIZE = 12;
const CODE_LINE_HEIGHT = 14;
const CODE_PADDING_LEFT = 10;
// Monospace glyphs are ~0.6em wide.
const CODE_CHAR_WIDTH = CODE_FONT_SIZE * 0.6;

const truncateCodeLine = (line: string, maxChars: number): string =>
  line.length > maxChars ? `${line.slice(0, Math.max(maxChars - 1, 0))}\u2026` : line;

/**
 * Code bodies are drawn with native SVG `<text>`, never `<foreignObject>` HTML: an exported SVG holding
 * `<foreignObject>` taints the canvas the PNG export draws it on (`toBlob` then throws), and most standalone
 * SVG viewers do not render HTML content at all.
 */
const CodeContent: FunctionComponent<{ content: string; textColor: string; width: number }> = ({
  content,
  textColor,
  width,
}) => {
  const maxChars = Math.max(Math.floor((width - CODE_PADDING_LEFT - 4) / CODE_CHAR_WIDTH), 1);
  const lines = content.split('\n');

  return (
    <svg width="100%" height="100%" style={{ overflow: 'hidden' }}>
      <text
        xmlSpace="preserve"
        pointerEvents="none"
        // Inline style, so the export's `text { font-family; font-size }` rule cannot override it.
        style={{ fill: textColor, fontFamily: 'monospace', fontSize: `${CODE_FONT_SIZE}px`, whiteSpace: 'pre' }}
      >
        {lines.map((line, index) => (
          <tspan key={index} x={CODE_PADDING_LEFT} y={4 + index * CODE_LINE_HEIGHT + 11}>
            {truncateCodeLine(preserveTabs(line), maxChars)}
          </tspan>
        ))}
      </text>
    </svg>
  );
};

export const AgentStateMemberComponent: FunctionComponent<Props> = ({ element, fillColor }) => {
  const displayName = truncateTextToWidth(element.name || '', element.bounds.width - 20, 14);

  if (element.replyType === 'code') {
    return (
      <g>
        <ThemedRect fillColor={fillColor || element.fillColor} strokeColor="none" width="100%" height="100%" />
        <CodeContent content={element.name} textColor={element.textColor || '#000'} width={element.bounds.width} />
      </g>
    );
  }

  return (
    <g>
      <ThemedRect fillColor={fillColor || element.fillColor} strokeColor="none" width="100%" height="100%" />
      <svg width="100%" height="100%" style={{ overflow: 'hidden' }}>
        <Text x={10} fill={element.textColor} fontWeight="normal" textAnchor="start">
          {displayName}
        </Text>
      </svg>
    </g>
  );
}; 