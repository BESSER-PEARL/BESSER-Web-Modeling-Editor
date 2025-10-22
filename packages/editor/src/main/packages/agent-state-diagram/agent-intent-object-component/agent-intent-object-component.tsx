import React, { FunctionComponent } from 'react';
import { Text } from '../../../components/controls/text/text';
import { AgentIntent } from './agent-intent';
import { ThemedRect, ThemedPath } from '../../../components/theme/themedComponents';

interface Props {
  element: AgentIntent;
  children?: React.ReactNode;
  fillColor?: string;
}

export const AgentIntentComponent: FunctionComponent<Props> = ({ element, children, fillColor }) => {
  const cornerRadius = 0;
  element.name = "Intent: " + element.name;
  return (
    <g>
 <svg
  width={element.bounds.width}
  height={element.bounds.height}
  viewBox={`0 0 ${element.bounds.width} ${element.bounds.height}`}
  preserveAspectRatio="none"
>
  <g>
    <ThemedPath
      d={`
        M 0 0
        H ${element.bounds.width}
        V ${element.bounds.height}
        H 30
        L 0 ${element.bounds.height + 30}
        L 10 ${element.bounds.height}
        H 10 0
        Z
      `}
      fillColor="#E3F9E5"
      strokeColor={element.strokeColor}
      strokeWidth="1.2"
    />
       <ThemedRect
      strokeColor="none"
      fillColor="none"
      width="100%"
      height={element.stereotype ? 50 : 40}
      rx={cornerRadius}
      />
      <ThemedRect
      y={element.stereotype ? 50 : 40}
      width="100%"
      height={element.bounds.height - (element.stereotype ? 50 : 40)}
      strokeColor="none"
      fillColor="none"
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
      <svg height={40}>
        <Text
        fill='black'
        fontStyle={element.italic ? 'italic' : undefined}
        textDecoration={element.underline ? 'underline' : undefined}
        >
        {element.name}

        </Text>
       
      </svg>

      )} {children}
      <ThemedRect
      width="100%"
      height="100%"
      strokeColor="none"
      fillColor="none"
      pointer-events="none"
      rx={cornerRadius}
      />
      {element.hasBody && (
      <ThemedPath d={`M 0 ${element.headerHeight} H ${element.bounds.width}`} strokeColor={element.strokeColor} />
      )}
          
    
  </g>
</svg>
    </g>
  );
}; 