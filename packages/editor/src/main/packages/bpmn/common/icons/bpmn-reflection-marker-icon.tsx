import React, { FunctionComponent } from 'react';

// Agentic BPMN reflection marker (SEAA'25 § 4.4): two mirrored brackets
// either side of a dashed mirror axis, with the reflection-mode letter
// (s / c / h) below. Clean-vector redraw of the paper's reflection notation.
//
// This marks the *reflection mode* and is used on agentic tasks only. The
// separate BPMNReflectionIcon (refresh-circle + letter) stays the generic
// collaboration / merging letter badge on flows and gateways — do NOT conflate
// the two.
export const BPMNReflectionMarkerIcon: FunctionComponent<React.SVGProps<SVGSVGElement> & { letter: string }> = ({
  letter,
  ...props
}) => (
  <svg
    {...props}
    width={16}
    height={21}
    viewBox="0 0 24 32"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.24}
    strokeLinejoin="round"
    strokeLinecap="round"
  >
    {/* left + right mirrored brackets */}
    <path d="M1.6 2 L1.6 22 L9.6 16.4 L9.6 7.6 Z" />
    <path d="M22.4 2 L22.4 22 L14.4 16.4 L14.4 7.6 Z" />
    {/* reflection (mirror) axis */}
    <path d="M12 1.5 L12 22.5" strokeDasharray="1.857 2.8" />
    {/* reflection-mode letter */}
    <text x="12" y="31" fontSize="9" fill="currentColor" stroke="none" textAnchor="middle" fontFamily="Arial">
      {letter}
    </text>
  </svg>
);
