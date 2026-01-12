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
  const MAX_DISPLAY_LENGTH = 50;
  const TRUNCATED_SUFFIX_LENGTH = 3; // for "..."
  const displayText = element.name || '';
  const firstLine = displayText.split('\n')[0];
  // Truncate if still too long
  const truncatedText = firstLine.length > MAX_DISPLAY_LENGTH 
    ? firstLine.substring(0, MAX_DISPLAY_LENGTH - TRUNCATED_SUFFIX_LENGTH) + '...' 
    : firstLine;
  
  return (
    <g>
      <ThemedRect fillColor={fillColor || element.fillColor} strokeColor="none" width="100%" height="100%" />
      <Text x={10} fill={element.textColor} fontWeight="normal" textAnchor="start">
        {truncatedText}
      </Text>
    </g>
  );
}; 