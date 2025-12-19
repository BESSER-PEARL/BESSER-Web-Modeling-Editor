import React, { FunctionComponent } from 'react';
import { AgentRagElement } from './agent-rag-element';
import { Text } from '../../../components/controls/text/text';

interface Props {
  element: AgentRagElement;
  children?: React.ReactNode;
  fillColor?: string;
}

export const AgentRagElementComponent: FunctionComponent<Props> = ({ element, children, fillColor }) => {
  const width = element.bounds.width;
  const height = element.bounds.height;
  const ellipseHeight = Math.min(height * 0.3, 30);
  const radiusX = width / 2;
  const radiusY = ellipseHeight / 2;
  const topCenterY = radiusY;
  const bottomCenterY = height - radiusY;

  const baseFill = fillColor ?? element.fillColor ?? '#E8F0FF';
  const strokeColor = element.strokeColor ?? '#668';
  const textColor = element.textColor ?? '#000';

  return (
    <g>
      <rect
        x={0}
        y={radiusY}
        width={width}
        height={height - ellipseHeight}
        fill={baseFill}
        stroke={strokeColor}
      />
      <ellipse cx={radiusX} cy={topCenterY} rx={radiusX} ry={radiusY} fill={baseFill} stroke={strokeColor} />
      <ellipse cx={radiusX} cy={bottomCenterY} rx={radiusX} ry={radiusY} fill={baseFill} stroke={strokeColor} />

      <Text y={topCenterY + radiusY * 0.2} fill={textColor} fontSize="90%">
        RAG DB
      </Text>
      <Text y={height - radiusY - 6} fill={textColor} fontWeight="normal" dominantBaseline="middle">
        {element.name}
      </Text>

      {children}
      <rect x={0} y={0} width={width} height={height} fill="none" stroke="none" pointerEvents="none" />
    </g>
  );
};
