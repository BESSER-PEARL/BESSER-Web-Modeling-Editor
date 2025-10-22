import React, { FunctionComponent } from 'react';
import { Text } from '../../../components/controls/text/text';
import { AgentIntentMember } from './agent-intent-member';
import { ThemedRect } from '../../../components/theme/themedComponents';

interface Props {
  element: AgentIntentMember;
  fillColor?: string;
}

export const AgentIntentMemberComponent: FunctionComponent<Props> = ({ element, fillColor }) => {
  return (
    <g>
        
      <ThemedRect fillColor='none' strokeColor="none" width="100%" height="100%"  />
      <Text x={10} fill='black' fontWeight="normal" textAnchor="start">
        {element.name}
      </Text>
    </g>
  );
}; 