import React, { FunctionComponent } from 'react';
import { ThemedRect } from '../../../components/theme/themedComponents';
import { BPMNSwimlane } from './bpmn-swimlane';
import { Multiline } from '../../../utils/svg/multiline';
import { BPMNBotIcon } from '../common/icons/bpmn-bot-icon';
import { BPMNAgentProfile } from '../common/types';

const ROLE_BADGE: Record<BPMNAgentProfile, string> = {
  solution: 'S',
  supervision: 'Sv',
};

export const BPMNSwimlaneComponent: FunctionComponent<Props> = ({ element, fillColor, textColor, children }) => {
  const fg = textColor || element.textColor;
  return (
    <g>
      <ThemedRect
        width={element.bounds.width}
        height={element.bounds.height}
        fillColor={fillColor || element.fillColor}
      />
      <Multiline
        y={20}
        x={-(element.bounds.height / 2)}
        transform="rotate(270)"
        textAnchor="middle"
        alignmentBaseline="middle"
        pointerEvents="none"
        fill={fg}
      >
        {element.name}
      </Multiline>
      {/* Agentic BPMN: bot icon + role letter + trust score stack vertically
          to the right of the (vertical) lane name so the header stays narrow. */}
      {element.isAgentic && (
        <>
          <BPMNBotIcon x={34} y={element.bounds.height / 2 - 23} color={fg} />
          <text
            x={42}
            y={element.bounds.height / 2 + 8}
            fontSize={9}
            fontWeight="bold"
            textAnchor="middle"
            fill={fg}
            pointerEvents="none"
          >
            {ROLE_BADGE[element.role as keyof typeof ROLE_BADGE] ?? element.role.slice(0, 2).toUpperCase()}
          </text>
          <text
            x={42}
            y={element.bounds.height / 2 + 23}
            fontSize={10}
            textAnchor="middle"
            fill={fg}
            pointerEvents="none"
          >
            {element.trustScore}
          </text>
          {element.multiplicity > 1 && (
            <text
              x={42}
              y={element.bounds.height / 2 + 38}
              fontSize={11}
              fontWeight="bold"
              textAnchor="middle"
              fill={fg}
              pointerEvents="none"
            >
              {`×${element.multiplicity}`}
            </text>
          )}
        </>
      )}
      {children}
    </g>
  );
};

interface Props {
  element: BPMNSwimlane;
  fillColor?: string;
  textColor?: string;
  children?: React.ReactNode;
}
