import React, { FC } from 'react';

interface OwnProps {
  element?: {
    bounds?: {
      width: number;
      height: number;
    };
  };
}

export const NNSectionSeparatorComponent: FC<OwnProps> = ({ element }) => {
  const width = element?.bounds?.width || 100;
  const height = element?.bounds?.height || 15;
  const centerY = height / 2;
  // Extend line beyond element bounds to span full sidebar width
  const extendedWidth = 250;
  const centerOffset = (extendedWidth - width) / 2;

  return (
    <g>
      <line
        x1={-centerOffset}
        y1={centerY}
        x2={width + centerOffset}
        y2={centerY}
        stroke="#999"
        strokeWidth={2}
        style={{ pointerEvents: 'none' }}
      />
    </g>
  );
};
