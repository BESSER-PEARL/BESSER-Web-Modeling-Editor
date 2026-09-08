import React, { FunctionComponent } from 'react';
import { AgentSkill } from './agent-skill';
import { Text } from '../../../components/controls/text/text';
import { AGENT_PRIMITIVE_COLORS } from '../agent-primitive-colors';
import { truncateTextToWidth } from '../text-truncation';

interface Props {
  element: AgentSkill;
  children?: React.ReactNode;
  fillColor?: string;
}

export const AgentSkillComponent: FunctionComponent<Props> = ({ element, children, fillColor }) => {
  const width = element.bounds.width;
  const height = element.bounds.height;
  const title = truncateTextToWidth(element.name || '', width - 28, 14);
  const subtitle = truncateTextToWidth(element.description || element.content || '', width - 28, 12);
  const accent = element.strokeColor || AGENT_PRIMITIVE_COLORS.skill.accent;
  const fill = fillColor || element.fillColor || AGENT_PRIMITIVE_COLORS.skill.tint;
  const textColor = element.textColor || 'currentColor';

  // Card with a folded top-right corner (a "note" silhouette).
  const fold = Math.min(16, width / 6);
  const cardPath = `M 0 0 H ${width - fold} L ${width} ${fold} V ${height} H 0 Z`;
  const foldPath = `M ${width - fold} 0 L ${width} ${fold} L ${width - fold} ${fold} Z`;

  return (
    <g>
      <path d={cardPath} fill={fill} stroke={accent} strokeWidth={1.5} />
      <path d={foldPath} fill={accent} fillOpacity={0.45} stroke={accent} strokeWidth={1} />
      <Text x={width / 2} y={24} fill={accent} fontWeight="bold" fontSize="80%" textAnchor="middle">
        {`${AGENT_PRIMITIVE_COLORS.skill.icon} «skill»`}
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
