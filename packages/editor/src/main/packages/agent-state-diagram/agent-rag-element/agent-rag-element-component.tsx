import React, { FunctionComponent } from 'react';
import { AgentRagElement } from './agent-rag-element';
import { Text } from '../../../components/controls/text/text';
import { truncateTextToWidth } from '../text-truncation';

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
  const bottomHalfClipId = `rag-bottom-half-${element.id}`;
  const displayName = truncateTextToWidth(element.name || '', width - 20, 14);

  const baseFill = fillColor ?? element.fillColor ?? '#E8F0FF';
  const strokeColor = element.strokeColor ?? '#668';
  const textColor = element.textColor ?? '#000';

  return (
    <g>
      <defs>
        <clipPath id={bottomHalfClipId}>
          <rect x={0} y={bottomCenterY} width={width} height={radiusY} />
        </clipPath>
      </defs>
      <rect
        x={0}
        y={radiusY}
        width={width}
        height={height - ellipseHeight}
        fill={baseFill}
        stroke={strokeColor}
      />
      <ellipse cx={radiusX} cy={topCenterY} rx={radiusX} ry={radiusY} fill={baseFill} stroke={strokeColor} />
      <ellipse cx={radiusX} cy={bottomCenterY} rx={radiusX} ry={radiusY} fill={baseFill} stroke="none" />
      <ellipse
        cx={radiusX}
        cy={bottomCenterY}
        rx={radiusX}
        ry={radiusY}
        fill="none"
        stroke={strokeColor}
        clipPath={`url(#${bottomHalfClipId})`}
      />

      <Text y={topCenterY + radiusY * 0.2} fill={textColor} fontSize="90%">
        RAG DB
      </Text>
      <Text y={height - radiusY - 6} fill={textColor} fontWeight="normal" dominantBaseline="middle">
        {displayName}
      </Text>

      {children}
      <rect x={0} y={0} width={width} height={height} fill="none" stroke="none" pointerEvents="none" />
    </g>
  );
};
