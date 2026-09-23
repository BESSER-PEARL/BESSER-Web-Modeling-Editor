import React, { FunctionComponent } from 'react';
import { ThemedCircle, ThemedPolyline } from '../../../../components/theme/themedComponents';
import { Multiline } from '../../../../utils/svg/multiline';
import { BPMNBotIcon } from '../../common/icons/bpmn-bot-icon';
import { BPMNMergeMarkerIcon } from '../../common/icons/bpmn-merge-marker-icon';
import { BPMNGovernanceBadgeIcon } from '../../common/icons/bpmn-governance-badge-icon';
import { Props } from '../bpmn-gateway-component';

export const BPMNInclusiveGatewayComponent: FunctionComponent<Props> = ({ element, fillColor }) => (
  <g>
    <ThemedPolyline
      points={`${element.bounds.width / 2} 0, ${element.bounds.width} ${element.bounds.height / 2}, ${
        element.bounds.width / 2
      } ${element.bounds.height}, 0 ${element.bounds.height / 2}, ${element.bounds.width / 2} 0`}
      strokeColor={element.strokeColor}
      fillColor={fillColor || element.fillColor}
    />
    <ThemedCircle
      cx={element.bounds.width / 2}
      cy={element.bounds.height / 2}
      r={Math.min(element.bounds.width, element.bounds.height) / 2 - 12}
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
    {/* Agentic BPMN (T1/P3′ rationalization): bot icon top-left marks the
        agentic gateway. The diverging side carries NO bottom-right marker
        (O3 — collaborationMode deleted, the BPMN gateway pair already shows
        the block boundary). The merging side keeps the merge glyph and gains a
        small "governed" badge when a governance policy is attached (O4). */}
    {element.isAgentic && (
      <>
        <BPMNBotIcon x={-4} y={-4} color={element.strokeColor} />
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
