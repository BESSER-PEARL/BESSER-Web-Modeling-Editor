import React, { FunctionComponent } from 'react';
import { NNContainer } from './nn-container';
import { ThemedPath, ThemedRect } from '../../../components/theme/themedComponents';

export const NNContainerComponent: FunctionComponent<Props> = ({ element, children, fillColor }) => {
  const headerHeight = 30;
  const tabWidth = 60;
  const tabHeight = 15;
  const contentAreaTop = tabHeight + headerHeight;
  const contentAreaHeight = element.bounds.height - contentAreaTop;

  // Check if container has children (ownedElements)
  const isEmpty = !element.ownedElements || element.ownedElements.length === 0;

  return (
    <g>
      {/* Tab at top-left with "NN" label */}
      <ThemedPath
        d={`M 0 ${tabHeight} V 0 H ${tabWidth} V ${tabHeight}`}
        strokeColor={element.strokeColor}
        fillColor={fillColor || element.fillColor}
      />
      <text
        x={tabWidth / 2}
        y={tabHeight / 2 + 4}
        textAnchor="middle"
        fontSize="10"
        fontWeight="bold"
        pointerEvents="none"
        style={element.textColor ? { fill: element.textColor } : {}}
      >
        NN
      </text>

      {/* Main body */}
      <ThemedRect
        y={tabHeight}
        width="100%"
        height={element.bounds.height - tabHeight}
        strokeColor={element.strokeColor}
        fillColor={fillColor || element.fillColor}
      />

      {/* Network name in header area */}
      <text
        x="50%"
        y={tabHeight + headerHeight / 2 + 4}
        textAnchor="middle"
        fontWeight="bold"
        fontSize="14"
        pointerEvents="none"
        style={element.textColor ? { fill: element.textColor } : {}}
      >
        {element.name}
      </text>

      {/* Separator line below header */}
      <line
        x1={0}
        y1={tabHeight + headerHeight}
        x2={element.bounds.width}
        y2={tabHeight + headerHeight}
        stroke={element.strokeColor || '#000'}
        strokeWidth={1}
      />

      {/* Placeholder instructions when empty */}
      {isEmpty && (
        <g pointerEvents="none">
          <text
            x={element.bounds.width / 2}
            y={contentAreaTop + contentAreaHeight / 2 - 22}
            textAnchor="middle"
            fontSize="9"
            opacity={0.5}
            style={element.textColor ? { fill: element.textColor } : {}}
          >
            Drag Layers and TensorOps here
          </text>
          <text
            x={element.bounds.width / 2}
            y={contentAreaTop + contentAreaHeight / 2 - 8}
            textAnchor="middle"
            fontSize="9"
            opacity={0.5}
            style={element.textColor ? { fill: element.textColor } : {}}
          >
            Connect layers and tensorOps
          </text>
          <text
            x={element.bounds.width / 2}
            y={contentAreaTop + contentAreaHeight / 2 + 6}
            textAnchor="middle"
            fontSize="9"
            opacity={0.5}
            style={element.textColor ? { fill: element.textColor } : {}}
          >
            with &apos;next&apos; relationship
          </text>
          <text
            x={element.bounds.width / 2}
            y={contentAreaTop + contentAreaHeight / 2 + 22}
            textAnchor="middle"
            fontSize="8"
            opacity={0.35}
            style={element.textColor ? { fill: element.textColor } : {}}
          >
            (Drag edges to resize)
          </text>
        </g>
      )}

      {children}
    </g>
  );
};

interface Props {
  element: NNContainer;
  fillColor?: string;
  children?: React.ReactNode;
}
