import React, { FunctionComponent } from 'react';
import { UMLStateCodeBlock } from './uml-state-code-block';
import { ThemedRect } from '../../../components/theme/themedComponents';

interface Props {
  element: UMLStateCodeBlock;
  fillColor?: string;
}

const preserveTabs = (str: string): string => {
  return str.replace(/\t/g, '    ');
};

const CodeContent: FunctionComponent<{ content: string; textColor: string; width: number; height: number }> = ({
  content,
  textColor,
  width,
  height,
}) => {
  const fontSize = '13px';
  const paddingLeft = 10;
  const lineHeight = 14;
  const headerHeight = 20;

  const lines = content.split('\n');

  return (
    <foreignObject x={0} y={headerHeight} width={width} height={height - headerHeight}>
      <div
        style={{
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          padding: `4px ${paddingLeft}px`,
          boxSizing: 'border-box',
        }}
      >
        {lines.map((line, index) => (
          <div
            key={index}
            style={{
              fontSize,
              color: textColor,
              fontFamily: 'monospace',
              whiteSpace: 'pre',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: `${lineHeight}px`,
            }}
          >
            {preserveTabs(line) || '\u00A0'}
          </div>
        ))}
      </div>
    </foreignObject>
  );
};

export const UMLStateCodeBlockComponent: FunctionComponent<Props> = ({ element, fillColor }) => {
  const cornerRadius = 8;
  const headerHeight = 20;
  const contentCode = element.code || '';

  return (
    <g>
      {/* Background */}
      <ThemedRect
        width="100%"
        height="100%"
        fillColor={fillColor || element.fillColor}
        strokeColor={element.strokeColor}
        rx={cornerRadius}
      />

      {/* Header */}
      <ThemedRect
        width="100%"
        height={headerHeight}
        fillColor={element.strokeColor}
        strokeColor={element.strokeColor}
        rx={cornerRadius}
        ry={cornerRadius}
      />

      {/* Language Label */}
      <text x={10} y={headerHeight / 2 + 5} fontSize="10px" fontFamily="sans-serif" fill="#fff" fontWeight="bold">
        Python
      </text>

      {/* Code Content — single foreignObject with HTML divs, no nesting */}
      <CodeContent
        content={contentCode}
        textColor={element.textColor || '#000'}
        width={element.bounds.width}
        height={element.bounds.height}
      />
    </g>
  );
};
