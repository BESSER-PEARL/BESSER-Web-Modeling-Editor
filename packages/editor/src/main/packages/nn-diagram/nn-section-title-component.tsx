import React, { FC } from 'react';

interface OwnProps {
  element: {
    name?: string;
    bounds?: {
      width: number;
      height: number;
    };
  };
}

export const NNSectionTitleComponent: FC<OwnProps> = ({ element }) => {
  const width = element.bounds?.width || 100;
  const height = element.bounds?.height || 40;
  // Center text within the element bounds
  const centerX = width / 2;
  // Add top margin by positioning text lower
  const textY = height / 2 + 5;

  return (
    <g>
      <text
        x={centerX}
        y={textY}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{
          fontWeight: 'bold',
          fontSize: '22px',
          fill: '#1976d2',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {element.name || 'Section Title'}
      </text>
    </g>
  );
};
