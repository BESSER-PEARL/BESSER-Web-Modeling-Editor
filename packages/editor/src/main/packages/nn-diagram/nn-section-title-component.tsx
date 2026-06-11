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
          // Inherit theme text color so the title stays legible in dark
          // mode. The previous hardcoded brand-blue stuck around regardless
          // of the canvas background.
          fill: 'currentColor',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {element.name || 'Section Title'}
      </text>
    </g>
  );
};
