import React, { FunctionComponent } from 'react';
import { NNReference } from './nn-reference';
import { ThemedRect } from '../../../components/theme/themedComponents';

export const NNReferenceComponent: FunctionComponent<Props> = ({ element, fillColor }) => {
  const displayName = element.referencedNN || 'Select NN...';

  return (
    <g>
      {/* Main box with dashed border to indicate reference.
          ThemedRect fills from the theme by default; only override if the user
          picked a custom fillColor so dark mode doesn't get a hardcoded light-
          blue box. */}
      <ThemedRect
        width={element.bounds.width}
        height={element.bounds.height}
        strokeColor={element.strokeColor}
        fillColor={fillColor || element.fillColor}
        rx={5}
        ry={5}
        strokeDasharray="4,2"
      />

      {/* Reference indicator icon (small arrow/link symbol). Fall back to
          currentColor so the icon inherits the theme text color in dark mode
          instead of staying locked at #666 (invisible on dark canvas). */}
      <text
        x={10}
        y={element.bounds.height / 2 + 5}
        fontSize="14"
        pointerEvents="none"
        style={{ fill: element.textColor || 'currentColor', opacity: element.textColor ? 1 : 0.65 }}
      >
        {'▸'}
      </text>

      {/* Referenced NN name. Active names inherit the theme text color;
          the placeholder "Select NN..." keeps a muted opacity so it reads as
          hint text in both themes. */}
      <text
        x={element.bounds.width / 2 + 5}
        y={element.bounds.height / 2 + 5}
        textAnchor="middle"
        fontSize="12"
        fontWeight="bold"
        fontStyle={element.referencedNN ? 'normal' : 'italic'}
        pointerEvents="none"
        style={{
          fill: element.textColor || 'currentColor',
          opacity: element.textColor ? 1 : (element.referencedNN ? 1 : 0.5),
        }}
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
