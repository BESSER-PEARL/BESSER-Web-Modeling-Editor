import React, { FunctionComponent } from 'react';
import { Text } from '../../../components/controls/text/text';
import { AgentReasoningState } from './agent-reasoning-state';
import { ThemedRect, ThemedPath } from '../../../components/theme/themedComponents';

interface Props {
  element: AgentReasoningState;
  children?: React.ReactNode;
  fillColor?: string;
}

const REASONING_ACCENT = '#7C3AED';

export const AgentReasoningStateComponent: FunctionComponent<Props> = ({ element, children, fillColor }) => {
  const cornerRadius = 8;
  const headerHeight = 50;
  const llmLabel = element.llm_name ? `LLM: ${element.llm_name}` : 'LLM: (use default)';
  const accent = element.strokeColor || REASONING_ACCENT;
  const textColor = element.textColor || 'currentColor';

  return (
    <g>
      <ThemedRect
        fillColor={fillColor || element.fillColor}
        strokeColor="none"
        width="100%"
        height={element.bounds.height}
        rx={cornerRadius}
      />
      <svg height={headerHeight} width="100%" style={{ overflow: 'hidden' }}>
        <Text fill={textColor}>
          <tspan x="50%" dy={-6} textAnchor="middle" fontSize="80%" fontWeight="bold" fill={accent}>
            {'▷ «reasoning»'}
          </tspan>
          <tspan x="50%" dy={20} textAnchor="middle" fontWeight="bold">
            {element.name}
          </tspan>
        </Text>
      </svg>
      <svg
        x={0}
        y={headerHeight}
        height={element.bounds.height - headerHeight}
        width="100%"
        style={{ overflow: 'hidden' }}
      >
        <Text fill={textColor} fontWeight="normal" fontSize="80%">
          {llmLabel}
        </Text>
      </svg>

      {children}

      <ThemedRect
        width="100%"
        height="100%"
        strokeColor={accent}
        fillColor="none"
        pointer-events="none"
        rx={cornerRadius}
      />
      <ThemedPath d={`M 0 ${headerHeight} H ${element.bounds.width}`} strokeColor={accent} />
    </g>
  );
};
