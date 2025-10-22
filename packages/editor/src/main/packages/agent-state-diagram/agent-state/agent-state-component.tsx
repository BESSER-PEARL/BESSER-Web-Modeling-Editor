import React, { FunctionComponent } from 'react';
import { Text } from '../../../components/controls/text/text';
import { AgentState } from './agent-state';
import { ThemedRect, ThemedPath } from '../../../components/theme/themedComponents';

interface Props {
  element: AgentState;
  children?: React.ReactNode;
  fillColor?: string;
}

export const AgentStateComponent: FunctionComponent<Props> = ({ element, children, fillColor }) => {
  const cornerRadius = 8;

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
        <svg height={50}>
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
              {element.name}
            </tspan>
          </Text>
        </svg>
      ) : (
        <>
        <svg height={40}>
          <Text
            fill={element.textColor}
            fontStyle={element.italic ? 'italic' : undefined}
            textDecoration={element.underline ? 'underline' : undefined}
          >
            {element.name}
          </Text>
        </svg>
        <image
          href="data:image/png;base64,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"
          x={element.bounds.width - 35}
          y={2}
          width="35"
          height="35"
        />
        </>
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