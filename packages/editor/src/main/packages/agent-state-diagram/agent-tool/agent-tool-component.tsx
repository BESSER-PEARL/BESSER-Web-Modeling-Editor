import React, { FunctionComponent } from 'react';
import { AgentTool } from './agent-tool';
import { Text } from '../../../components/controls/text/text';
import { ThemedRect } from '../../../components/theme/themedComponents';

interface Props {
  element: AgentTool;
  children?: React.ReactNode;
  fillColor?: string;
}

const truncate = (value: string, max: number) => {
  if (!value) return '';
  const flat = value.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

export const AgentToolComponent: FunctionComponent<Props> = ({ element, children, fillColor }) => {
  const width = element.bounds.width;
  const height = element.bounds.height;
  const cornerRadius = 8;
  const subtitle = truncate(element.description || '', 48);
  const strokeColor = element.strokeColor || 'currentColor';
  const textColor = element.textColor || 'currentColor';

  return (
    <g>
      <ThemedRect
        width="100%"
        height="100%"
        rx={cornerRadius}
        fillColor={fillColor || element.fillColor}
        strokeColor={strokeColor}
      />
      <Text y={22} fill={textColor} fontWeight="bold" fontSize="80%">
        «tool»
      </Text>
      <Text y={42} fill={textColor} fontWeight="bold">
        {element.name}
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
