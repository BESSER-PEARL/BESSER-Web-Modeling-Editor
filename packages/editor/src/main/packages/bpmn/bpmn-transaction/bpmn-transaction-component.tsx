import React, { FunctionComponent } from 'react';
import { BPMNTransaction } from './bpmn-transaction';
import { ThemedPolyline, ThemedRect } from '../../../components/theme/themedComponents';
import { Multiline } from '../../../utils/svg/multiline';

export const BPMNTransactionComponent: FunctionComponent<Props> = ({
  element,
  fillColor,
  strokeColor,
  textColor,
  children,
}) => {
  const { width, height } = element.bounds;
  const nameY = element.isExpanded ? 20 : height / 2;

  return (
    <g>
      {/* Outer border */}
      <ThemedRect
        rx={10}
        ry={10}
        width={width}
        height={height}
        fillColor={fillColor || element.fillColor}
        strokeColor={strokeColor || element.strokeColor}
      />
      {/* Inner border (Transaction double-border, BPMN 2.0.2 §10.2.5) */}
      <ThemedRect
        rx={7}
        ry={7}
        x={3}
        y={3}
        width={width - 6}
        height={height - 6}
        fillColor={fillColor || element.fillColor}
        strokeColor={strokeColor || element.strokeColor}
      />
      {/* [+] expand/collapse marker — bottom center */}
      <ThemedRect
        x={width / 2 - 7}
        y={height - 14}
        width={14}
        height={14}
        fillColor="transparent"
        strokeColor={element.strokeColor}
      />
      <ThemedPolyline
        points={`${width / 2 - 4} ${height - 7}, ${width / 2 + 4} ${height - 7}`}
        strokeColor={strokeColor || element.strokeColor}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {!element.isExpanded && (
        <ThemedPolyline
          points={`${width / 2} ${height - 11}, ${width / 2} ${height - 3}`}
          strokeColor={strokeColor || element.strokeColor}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      <Multiline
        x={width / 2}
        y={nameY}
        width={width}
        height={height}
        fontWeight="bold"
        fill={textColor || element.textColor}
        lineHeight={16}
        capHeight={11}
      >
        {element.name}
      </Multiline>
      {element.isExpanded && children}
    </g>
  );
};

interface Props {
  element: BPMNTransaction;
  fillColor?: string;
  strokeColor?: string;
  textColor?: string;
  children?: React.ReactNode;
}
