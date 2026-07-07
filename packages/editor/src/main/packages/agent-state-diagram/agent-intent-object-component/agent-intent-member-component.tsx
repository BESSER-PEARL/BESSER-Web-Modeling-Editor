import React, { FunctionComponent } from 'react';
import { Text } from '../../../components/controls/text/text';
import { AgentIntentMember } from './agent-intent-member';
import { ThemedRect } from '../../../components/theme/themedComponents';
import { truncateTextToWidth } from '../text-truncation';

interface Props {
  element: AgentIntentMember;
  fillColor?: string;
}

export const AgentIntentMemberComponent: FunctionComponent<Props> = ({ element, fillColor }) => {
  const displayName = truncateTextToWidth(element.name || '', element.bounds.width - 20, 14);
  return (
    <g>
        
      <ThemedRect fillColor='none' strokeColor="none" width="100%" height="100%"  />
      <Text x={10} fill='black' fontWeight="normal" textAnchor="start">
        {displayName}
      </Text>
    </g>
  );
}; 