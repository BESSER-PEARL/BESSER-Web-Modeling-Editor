import React, { FunctionComponent } from 'react';
import { AgentTool } from './agent-tool';
import { Text } from '../../../components/controls/text/text';
import { AGENT_PRIMITIVE_COLORS } from '../agent-primitive-colors';
import { truncateTextToWidth } from '../text-truncation';

interface Props {
  element: AgentTool;
  children?: React.ReactNode;
  fillColor?: string;
}

export const AgentToolComponent: FunctionComponent<Props> = ({ element, children, fillColor }) => {
  const width = element.bounds.width;
  const height = element.bounds.height;
  const accent = element.strokeColor || AGENT_PRIMITIVE_COLORS.tool.accent;
  const fill = fillColor || element.fillColor || AGENT_PRIMITIVE_COLORS.tool.tint;
  const textColor = element.textColor || 'currentColor';

  // Hexagon: pointed left/right edges (a "module" silhouette).
  const notch = Math.min(18, width / 6);
  const title = truncateTextToWidth(element.name || '', width - 28, 14);
  // Bottom label sits in the slanted area, so reserve extra room beyond simple padding.
  const subtitle = truncateTextToWidth(element.description || '', Math.max(20, width - notch * 2 - 28), 12);
  const hexPath =
    `M ${notch} 0 H ${width - notch} L ${width} ${height / 2} ` +
    `L ${width - notch} ${height} H ${notch} L 0 ${height / 2} Z`;

  return (
    <g>
      <path d={hexPath} fill={fill} stroke={accent} strokeWidth={1.5} />
      <Text x={width / 2} y={24} fill={accent} fontWeight="bold" fontSize="80%" textAnchor="middle">
        {`${AGENT_PRIMITIVE_COLORS.tool.icon} «tool»`}
      </Text>
      <Text x={width / 2} y={44} fill={textColor} fontWeight="bold" textAnchor="middle">
        {title}
      </Text>
      {subtitle ? (
        <Text x={width / 2} y={height - 16} fill={textColor} fontWeight="normal" fontSize="80%" textAnchor="middle">
          {subtitle}
        </Text>
      ) : null}
      {children}
    </g>
  );
};
