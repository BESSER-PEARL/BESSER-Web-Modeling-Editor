import React, { FunctionComponent, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { ModelState } from '../../../components/store/model-state';
import { Multiline } from '../../../utils/svg/multiline';
import { ClassOCLConstraint, OCLConstraintKind } from './uml-class-ocl-constraint';
import { UMLElementType } from '../../uml-element-type';
import { ThemedPath } from '../../../components/theme/themedComponents';

const KIND_BADGE: Record<OCLConstraintKind, string> = {
  invariant: '«inv»',
  precondition: '«pre»',
  postcondition: '«post»',
};

export const ClassOCLConstraintComponent: FunctionComponent<Props> = ({ element, fillColor }) => {
  const padding = 20;
  const contentWidth = element.bounds.width - (padding * 2);
  const contentHeight = element.bounds.height - (padding * 2);

  // Resolve target method name (and orphan state) when this is a pre/post
  // contract. Reading directly from redux state keeps the canvas in sync
  // when the targeted method is renamed or deleted.
  const elements = useSelector((state: ModelState) => state.elements);
  const kind: OCLConstraintKind = element.kind || 'invariant';
  const targetMethodId = element.targetMethodId;
  let targetMethodName: string | undefined;
  let isOrphan = false;
  if (kind !== 'invariant' && targetMethodId) {
    const target = elements[targetMethodId];
    if (target && target.type === UMLElementType.ClassMethod) {
      targetMethodName = (target as any).name;
    } else {
      isOrphan = true;
    }
  }
  const orphanStrokeColor = isOrphan ? '#d6336c' : element.strokeColor;

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
        strokeColor={orphanStrokeColor}
        strokeWidth={isOrphan ? '2' : '1.2'}
        strokeMiterlimit="10"
      />
      <ThemedPath
        d={`M ${element.bounds.width - 15} 0 L ${element.bounds.width - 15} 15 L ${element.bounds.width} 15`}
        fillColor="none"
        strokeColor={orphanStrokeColor}
        strokeWidth={isOrphan ? '2' : '1.2'}
        strokeMiterlimit="10"
      />
      {/* Stereotype badge — UML convention for distinguishing invariants
          from method contracts. Shown above the body when kind != default
          OR when a target method is set, alongside the method name for
          pre/post (and an orphan glyph when the target is missing). */}
      {(kind !== 'invariant' || targetMethodName || isOrphan) && (
        <text
          x={padding}
          y={padding - 6}
          fill={isOrphan ? '#d6336c' : element.textColor}
          style={{ fontSize: '11px', fontWeight: 600 }}
        >
          {KIND_BADGE[kind]}
          {targetMethodName ? ` ${targetMethodName}` : ''}
          {isOrphan ? ' ⚠ method missing' : ''}
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