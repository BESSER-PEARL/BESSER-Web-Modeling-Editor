import React, { FunctionComponent, useEffect, useRef, useState } from 'react';
import { Multiline } from '../../../utils/svg/multiline';
import { ClassOCLConstraint } from './uml-class-ocl-constraint';
import { ThemedPath } from '../../../components/theme/themedComponents';

// Read-only stereotype badge derived from the OCL text. Mirrors the
// backend's routing regex: ``context X (inv|pre|post) ...`` for invariants,
// ``context X::method(params) (pre|post) ...`` for method contracts.
// Used purely as a visual cue on the canvas — the source of truth is the
// constraint text itself.
const _OCL_HEADER_RE = /\bcontext\s+\w+(?:::(\w+)\s*\([^)]*\))?\s+(inv|pre|post)\b/i;
const _BADGE_LABEL: Record<string, string> = {
  inv: '«inv»',
  pre: '«pre»',
  post: '«post»',
};

function deriveBadge(constraint: string): { label: string; method?: string } | null {
  if (!constraint) return null;
  const match = _OCL_HEADER_RE.exec(constraint);
  if (!match) return null;
  const method = match[1] || undefined;
  const kw = match[2].toLowerCase();
  return { label: _BADGE_LABEL[kw], method };
}

export const ClassOCLConstraintComponent: FunctionComponent<Props> = ({ element, fillColor }) => {
  const padding = 20;
  const contentWidth = element.bounds.width - (padding * 2);
  const contentHeight = element.bounds.height - (padding * 2);
  const badge = deriveBadge(element.constraint || '');

  const formatText = (text: string) => {
    const maxCharsPerLine = Math.floor((contentWidth - 9) / 8); // Reduced width for safety
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    words.forEach(word => {
      if ((currentLine + ' ' + word).length <= maxCharsPerLine) {
        currentLine = currentLine ? `${currentLine} ${word}` : word;
      } else {
        if (currentLine) lines.push(currentLine);
        // Handle long words
        if (word.length > maxCharsPerLine) {
          const chunks = word.match(new RegExp(`.{1,${maxCharsPerLine}}`, 'g')) || [];
          lines.push(...chunks.slice(0, -1));
          currentLine = chunks[chunks.length - 1] || '';
        } else {
          currentLine = word;
        }
      }
    });
    if (currentLine) lines.push(currentLine);

    // Limit number of lines based on height
    const maxLines = Math.floor((contentHeight - 10) / 16);
    if (lines.length > maxLines) {
      const truncatedLines = lines.slice(0, maxLines - 1);
      const lastLine = lines[maxLines - 1];
      if (lastLine) {
        truncatedLines.push(lastLine.slice(0, maxCharsPerLine - 3) + '...');
      }
      return truncatedLines;
    }

    return lines;
  };

  const lines = formatText(element.constraint || '');

  return (
    <g>
      <ThemedPath
        d={`M 0 0 L ${element.bounds.width - 15} 0 L ${element.bounds.width} 15 L ${element.bounds.width} ${
          element.bounds.height
        } L 0 ${element.bounds.height} L 0 0 Z`}
        fillColor={fillColor || element.fillColor}
        strokeColor={element.strokeColor}
        strokeWidth="1.2"
        strokeMiterlimit="10"
      />
      <ThemedPath
        d={`M ${element.bounds.width - 15} 0 L ${element.bounds.width - 15} 15 L ${element.bounds.width} 15`}
        fillColor="none"
        strokeColor={element.strokeColor}
        strokeWidth="1.2"
        strokeMiterlimit="10"
      />
      {badge && (
        <text
          x={padding}
          y={padding - 4}
          fill={element.textColor || 'currentColor'}
          style={{ fontSize: '11px', fontWeight: 600, fontStyle: 'italic' }}
        >
          {badge.label}
          {badge.method ? ` ${badge.method}` : ''}
        </text>
      )}
      <clipPath id={`clip-${element.id}`}>
        <rect
          x={padding}
          y={padding}
          width={contentWidth}
          height={contentHeight}
        />
      </clipPath>
      <g clipPath={`url(#clip-${element.id})`}>
        <text
          x={padding}
          y={padding + 5}
          fill={element.textColor}
          style={{
            fontSize: '18px',
            dominantBaseline: 'hanging'
          }}
        >
          {lines.map((line, i) => (
            <tspan
              key={i}
              x={padding}
              dy={i === 0 ? 0 : '16'}
              textAnchor="start"
            >
              {line}
            </tspan>
          ))}
        </text>
      </g>
    </g>
  );
};

export interface Props {
  element: ClassOCLConstraint;
  fillColor?: string;
}
