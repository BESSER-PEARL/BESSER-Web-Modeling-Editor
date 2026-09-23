import React, { FunctionComponent } from 'react';

// Clean-vector redraw of the Agentic BPMN paper's reflection marker
// (notation/reflection-*.svg are raster-embedded Inkscape exports). Paper §4.4:
// a marker with the mode letter inside (s / c / h). Adem refines against the
// paper notation.
export const BPMNReflectionIcon: FunctionComponent<React.SVGProps<SVGSVGElement> & { letter: string }> = ({
  letter,
  ...props
}) => (
  <svg {...props} height={16} width={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M20 11a8 8 0 1 0-2.3 5.7" strokeLinecap="round" />
    <path d="M20 5v6h-6" strokeLinecap="round" strokeLinejoin="round" />
    <text x="11" y="15" fontSize="9" fill="currentColor" stroke="none" textAnchor="middle" fontFamily="Arial">
      {letter}
    </text>
  </svg>
);
