import React, { FunctionComponent } from 'react';
import { Text } from '../../../components/controls/text/text';
import { AgentStateMember } from './agent-state-member';
import { ThemedRect } from '../../../components/theme/themedComponents';

interface Props {
  element: AgentStateMember;
  fillColor?: string;
}


export const AgentStateMemberComponent: FunctionComponent<Props> = ({ element, fillColor }) => {
  // For code bodies, show only the first line or truncate long text
  const displayText = element.name || '';
  const firstLine = displayText.split('\n')[0];
  // Truncate if still too long (e.g., more than 50 characters)
  const truncatedText = firstLine.length > 50 ? firstLine.substring(0, 47) + '...' : firstLine;
  
  return (
    <g>
      <ThemedRect fillColor={fillColor || element.fillColor} strokeColor="none" width="100%" height="100%" />
      <Text x={10} fill={element.textColor} fontWeight="normal" textAnchor="start">
        {truncatedText}
      </Text>
    </g>
  );
}; 