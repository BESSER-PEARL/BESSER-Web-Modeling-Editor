import React, { FunctionComponent } from 'react';
import { Text } from '../../../components/controls/text/text';
import { AgentStateMember } from './agent-state-member';
import { ThemedRect } from '../../../components/theme/themedComponents';

interface Props {
  element: AgentStateMember;
  fillColor?: string;
}

const preserveTabs = (str: string): string => str.replace(/\t/g, '    ');

const CodeContent: FunctionComponent<{ content: string; textColor: string }> = ({ content, textColor }) => {
  const fontSize = '12px';
  const lineHeight = 14;
  const paddingLeft = 10;
  const lines = content.split('\n');

  return (
    <g>
      {lines.map((line, index) => {
        const y = 4 + index * lineHeight;
        const processedLine = preserveTabs(line);
        return (
          <foreignObject key={index} x={0} y={y} width="100%" height={lineHeight + 2}>
            <div
              style={{
                fontSize,
                color: textColor,
                fontFamily: 'monospace',
                whiteSpace: 'pre',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                paddingLeft,
                lineHeight: `${lineHeight}px`,
              }}
            >
              {processedLine || '\u00A0'}
            </div>
          </foreignObject>
        );
      })}
    </g>
  );
};

export const AgentStateMemberComponent: FunctionComponent<Props> = ({ element, fillColor }) => {
  if (element.replyType === 'code') {
    return (
      <g>
        <ThemedRect fillColor={fillColor || element.fillColor} strokeColor="none" width="100%" height="100%" />
        <CodeContent content={element.name} textColor={element.textColor || '#000'} />
      </g>
    );
  }

  return (
    <g>
      <ThemedRect fillColor={fillColor || element.fillColor} strokeColor="none" width="100%" height="100%" />
      <svg width="100%" height="100%" style={{ overflow: 'hidden' }}>
        <Text x={10} fill={element.textColor} fontWeight="normal" textAnchor="start">
          {element.name}
        </Text>
      </svg>
    </g>
  );
}; 