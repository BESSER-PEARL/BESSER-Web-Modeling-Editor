import React, { FunctionComponent } from 'react';

// Agentic BPMN merge marker for merging gateways (SEAA'25 § 4.4 glyph): two
// bars with arrows pointing inward (flows merging). It carries no strategy
// label — the merge axis lives in the governance DSL instead. The glyph signals
// "this is the merging side of an agentic collaboration block"; a separate
// governance badge (BPMNGovernanceBadgeIcon) flags whether a policy is attached.
export const BPMNMergeMarkerIcon: FunctionComponent<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    {...props}
    width={16}
    height={16}
    viewBox="0 0 18 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={0.93}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* two bars with inward-pointing arrows (merge) */}
    <path d="M 1,15 V 1 M 17,15 V 1 m -1,7 h -5 m 0,0 2,-2 m -2,2 2,2 M 2,8 H 7 M 7,8 5,10 M 7,8 5,6" />
  </svg>
);
