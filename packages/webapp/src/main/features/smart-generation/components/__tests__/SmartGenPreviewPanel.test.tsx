import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SmartGenPreviewPanel } from '../SmartGenPreviewPanel';

describe('SmartGenPreviewPanel', () => {
  it('renders human-readable BPMN and neural-network labels', () => {
    render(
      <SmartGenPreviewPanel
        status="ready"
        error={null}
        instructions="Generate a process-aware neural application"
        plan={{
          primaryKind: 'bpmn',
          auxiliaryKinds: ['nn'],
          executionMode: 'modify',
          targetGenerator: null,
          targetGeneratorConfidence: 0,
          summary: 'Use both models.',
          estimatedTurns: 4,
          estimatedCostUsd: 0.1,
          estimatedDurationSeconds: 30,
          notes: [],
          modelSummary: {
            primary: 'bpmn',
            present: [{ kind: 'bpmn' }, { kind: 'nn' }],
          },
        }}
      />,
    );

    expect(screen.getByText(/primary.*bpmn process/i)).toBeTruthy();
    expect(screen.getByText(/neural network/i)).toBeTruthy();
    expect(screen.getByText(/modify previous run/i)).toBeTruthy();
    expect(screen.getByText(/existing generated workspace/i)).toBeTruthy();
  });
});
