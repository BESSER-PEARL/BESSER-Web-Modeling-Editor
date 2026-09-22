import React, { FunctionComponent } from 'react';
import { Text } from '../../../components/controls/text/text';
import { AgentState } from './agent-state';
import { ThemedRect, ThemedPath } from '../../../components/theme/themedComponents';
import { truncateTextToWidth } from '../text-truncation';

interface Props {
  element: AgentState;
  children?: React.ReactNode;
  fillColor?: string;
}

const REASONING_ACCENT = '#7C3AED';

export const AgentStateComponent: FunctionComponent<Props> = ({ element, children, fillColor }) => {
  const cornerRadius = 8;

  if (element.stateType === 'reasoning') {
    const headerHeight = 50;
    const llmLabel = truncateTextToWidth(
      element.llm_name ? `LLM: ${element.llm_name}` : 'LLM: (use default)',
      element.bounds.width - 20,
      12,
    );
    const displayName = truncateTextToWidth(element.name || '', element.bounds.width - 20, 14);
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
              {'🧠 «reasoning»'}
            </tspan>
            <tspan x="50%" dy={20} textAnchor="middle" fontWeight="bold">
              {displayName}
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
  }

  const displayName = truncateTextToWidth(element.name || '', element.bounds.width - 20, 14);

  return (
    <g>
      <ThemedRect
        fillColor={fillColor || element.fillColor}
        strokeColor="none"
        width="100%"
        height={element.stereotype ? 50 : 40}
        rx={cornerRadius}
      />
      <ThemedRect
        y={element.stereotype ? 50 : 40}
        width="100%"
        height={element.bounds.height - (element.stereotype ? 50 : 40)}
        strokeColor="none"
        rx={cornerRadius}
      />
      {element.stereotype ? (
        <svg height={50} width="100%" style={{ overflow: 'hidden' }}>
          <Text fill={element.textColor}>
            <tspan x="50%" dy={-8} textAnchor="middle" fontSize="85%">
              {`«${element.stereotype}»`}
            </tspan>
            <tspan
              x="50%"
              dy={18}
              textAnchor="middle"
              fontStyle={element.italic ? 'italic' : undefined}
              textDecoration={element.underline ? 'underline' : undefined}
            >
              {displayName}
            </tspan>
          </Text>
        </svg>
      ) : (
        <svg height={40} width="100%" style={{ overflow: 'hidden' }}>
          <Text
            fill={element.textColor}
            fontStyle={element.italic ? 'italic' : undefined}
            textDecoration={element.underline ? 'underline' : undefined}
          >
            {displayName}
          </Text>
        </svg>
      )}

      {children}

      <ThemedRect
        width="100%"
        height="100%"
        strokeColor={element.strokeColor}
        fillColor="none"
        pointer-events="none"
        rx={cornerRadius}
      />
      {element.hasBody && (
        <ThemedPath d={`M 0 ${element.headerHeight} H ${element.bounds.width}`} strokeColor={element.strokeColor} />
      )}
      {element.hasBody && (
         <svg
         xmlns="http://www.w3.org/2000/svg"
         width="40"
         height="40"
         viewBox="0 0 16 16"
         x="70%"
         y="40"
       >

       </svg>
      )}
      {element.hasFallbackBody && (
        <ThemedPath d={`M 0 ${element.dividerPosition} H ${element.bounds.width}`} strokeColor={element.strokeColor} />
      )}
    </g>
  );
};
