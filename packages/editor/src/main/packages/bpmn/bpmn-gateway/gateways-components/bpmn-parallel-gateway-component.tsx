import React, { FunctionComponent } from 'react';
import { ThemedPolyline } from '../../../../components/theme/themedComponents';
import { Multiline } from '../../../../utils/svg/multiline';
import { AgenticBotIcon } from '../../../common/agentic/agentic-bot-icon';
import { BPMNMergeMarkerIcon } from '../../common/icons/bpmn-merge-marker-icon';
import { BPMNGovernanceBadgeIcon } from '../../common/icons/bpmn-governance-badge-icon';
import { Props } from '../bpmn-gateway-component';

export const BPMNParallelGatewayComponent: FunctionComponent<Props> = ({ element, fillColor }) => (
  <g>
    <ThemedPolyline
      points={`${element.bounds.width / 2} 0, ${element.bounds.width} ${element.bounds.height / 2}, ${
        element.bounds.width / 2
      } ${element.bounds.height}, 0 ${element.bounds.height / 2}, ${element.bounds.width / 2} 0`}
      strokeColor={element.strokeColor}
      fillColor={fillColor || element.fillColor}
    />
    <ThemedPolyline
      points={`${element.bounds.width / 2} 10, ${element.bounds.width / 2} ${element.bounds.height - 10}`}
      strokeColor={element.strokeColor}
      fillColor="transparent"
    />
    <ThemedPolyline
      points={`10 ${element.bounds.height / 2}, ${element.bounds.width - 10} ${element.bounds.height / 2}`}
      strokeColor={element.strokeColor}
      fillColor="transparent"
    />
    <Multiline
      x={element.bounds.width / 2}
      y={element.bounds.height + 20}
      width={element.bounds.width * 2}
      height={element.bounds.height}
      fill={element.textColor}
      lineHeight={16}
      capHeight={11}
      verticalAnchor="start"
    >
      {element.name}
    </Multiline>
    {/* Agentic BPMN: the bot icon top-left marks the agentic gateway. The
        diverging side has no further marker (the gateway pair already shows
        the block boundary); the merging side shows the merge glyph plus a
        small "governed" badge when a governance policy is attached. */}
    {element.isAgentic && (
      <>
        <AgenticBotIcon x={-4} y={-4} strokeColor={element.strokeColor} />
        {element.gatewayRole === 'merging' && (
          <BPMNMergeMarkerIcon
            x={element.bounds.width - 12}
            y={element.bounds.height - 12}
            color={element.strokeColor}
          />
        )}
        {element.gatewayRole === 'merging' &&
          element.governanceDsl !== undefined &&
          element.governanceDsl.trim() !== '' && (
            <BPMNGovernanceBadgeIcon x={element.bounds.width - 12} y={-6} color={element.strokeColor} />
          )}
      </>
    )}
  </g>
);
