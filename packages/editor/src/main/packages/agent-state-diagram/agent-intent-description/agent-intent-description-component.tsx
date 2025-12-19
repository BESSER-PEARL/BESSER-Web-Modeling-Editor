import React, { FunctionComponent } from 'react';
import { Text } from '../../../components/controls/text/text';
import { ThemedRect } from '../../../components/theme/themedComponents';

export const AGENT_INTENT_DESCRIPTION_HEIGHT = 30;

interface Props {
  description: string;
  width: number;
  textColor: string;
}

export const AgentIntentDescriptionComponent: FunctionComponent<Props> = ({ description, width, textColor }) => (
    
  <g>
    <ThemedRect fillColor="none" strokeColor="none" width={width} height={AGENT_INTENT_DESCRIPTION_HEIGHT} />
    <Text
      x={10}
      y={AGENT_INTENT_DESCRIPTION_HEIGHT / 2}
      fill={textColor}
      fontWeight="normal"
      textAnchor="start"
      dominantBaseline="middle"
    >
      {`Description: ${description}`}
    </Text>
  </g>
);
