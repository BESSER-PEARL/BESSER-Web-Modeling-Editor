import React, { FunctionComponent } from 'react';

// Agentic BPMN governance badge (T1/P3′ — O4). Shown top-right of a merging
// agentic gateway ONLY when a governance policy (`governanceDsl`) is attached.
// The merge axis is defined in the governance DSL (level 3); this badge is the
// at-a-glance "governed" signal — it does NOT name the policy type (the DSL is
// free text and the PolicyType picker is a non-stored generator affordance).
// A small document glyph with a check mark.
export const BPMNGovernanceBadgeIcon: FunctionComponent<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    {...props}
    width={14}
    height={14}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* document outline */}
    <path d="M4 1.5 h6 l2.5 2.5 v10.5 h-8.5 z" />
    {/* folded corner */}
    <path d="M10 1.5 v2.5 h2.5" />
    {/* check mark (policy satisfied) */}
    <path d="M5.5 9.5 l1.5 1.5 l3 -3.5" />
  </svg>
);
