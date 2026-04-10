import React, { FunctionComponent } from 'react';
import { NNReference } from './nn-reference';
import { ThemedRect } from '../../../components/theme/themedComponents';

export const NNReferenceComponent: FunctionComponent<Props> = ({ element, fillColor }) => {
  const displayName = element.referencedNN || 'Select NN...';

  return (
    <g>
      {/* Main box with dashed border to indicate reference */}
      <ThemedRect
        width={element.bounds.width}
        height={element.bounds.height}
        strokeColor={element.strokeColor}
        fillColor={fillColor || element.fillColor || '#e8f4fc'}
        rx={5}
        ry={5}
        strokeDasharray="4,2"
      />

      {/* Reference indicator icon (small arrow/link symbol) */}
      <text
        x={10}
        y={element.bounds.height / 2 + 5}
        fontSize="14"
        pointerEvents="none"
        style={element.textColor ? { fill: element.textColor } : { fill: '#666' }}
      >
        {'▸'}
      </text>

      {/* Referenced NN name */}
      <text
        x={element.bounds.width / 2 + 5}
        y={element.bounds.height / 2 + 5}
        textAnchor="middle"
        fontSize="12"
        fontWeight="bold"
        fontStyle={element.referencedNN ? 'normal' : 'italic'}
        pointerEvents="none"
        style={element.textColor ? { fill: element.textColor } : { fill: element.referencedNN ? '#333' : '#999' }}
      >
        {displayName}
      </text>
    </g>
  );
};

interface Props {
  element: NNReference;
  fillColor?: string;
}
