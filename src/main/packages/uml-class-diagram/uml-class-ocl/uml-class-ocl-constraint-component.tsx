import React, { FunctionComponent, useEffect, useRef, useState } from 'react';
import { Multiline } from '../../../utils/svg/multiline';
import { ClassOCLConstraint } from './uml-class-ocl-constraint';
import { ThemedPath } from '../../../components/theme/themedComponents';

export const ClassOCLConstraintComponent: FunctionComponent<Props> = ({ element, fillColor }) => {
  const padding = 20;
  const contentWidth = element.bounds.width - (padding * 2);
  const contentHeight = element.bounds.height - (padding * 2);

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