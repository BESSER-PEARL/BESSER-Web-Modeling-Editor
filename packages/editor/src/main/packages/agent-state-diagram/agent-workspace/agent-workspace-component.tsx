import React, { FunctionComponent } from 'react';
import { AgentWorkspace } from './agent-workspace';
import { Text } from '../../../components/controls/text/text';
import { AGENT_PRIMITIVE_COLORS } from '../agent-primitive-colors';

interface Props {
  element: AgentWorkspace;
  children?: React.ReactNode;
  fillColor?: string;
}

const truncate = (value: string, max: number) => {
  if (!value) return '';
  const flat = value.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

export const AgentWorkspaceComponent: FunctionComponent<Props> = ({ element, children, fillColor }) => {
  const width = element.bounds.width;
  const height = element.bounds.height;
  const subtitle = truncate(element.path || element.description || '', 48);
  const accent = element.strokeColor || AGENT_PRIMITIVE_COLORS.workspace.accent;
  const fill = fillColor || element.fillColor || AGENT_PRIMITIVE_COLORS.workspace.tint;
  const textColor = element.textColor || 'currentColor';

  // Folder: a tab on the top-left rising above the body (a "folder" silhouette).
  const tabW = Math.min(70, width * 0.45);
  const tabH = Math.min(16, height * 0.22);
  const slope = 10;
  const folderPath = `M 0 0 H ${tabW} L ${tabW + slope} ${tabH} H ${width} V ${height} H 0 Z`;

  return (
    <g>
      <path d={folderPath} fill={fill} stroke={accent} strokeWidth={1.5} />
      <Text x={width / 2} y={tabH + 16} fill={accent} fontWeight="bold" fontSize="80%" textAnchor="middle">
        {`${AGENT_PRIMITIVE_COLORS.workspace.icon} «workspace»`}
      </Text>
      <Text x={width / 2} y={tabH + 34} fill={textColor} fontWeight="bold" textAnchor="middle">
        {element.name}
      </Text>
      {subtitle ? (
        <Text x={width / 2} y={height - 12} fill={textColor} fontWeight="normal" fontSize="80%" textAnchor="middle">
          {subtitle}
        </Text>
      ) : null}
      {children}
    </g>
  );
};
