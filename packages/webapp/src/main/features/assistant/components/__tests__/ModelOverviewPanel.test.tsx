import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const project = {
  currentDiagramIndices: { ClassDiagram: 0 },
  diagrams: {
    ClassDiagram: [{
      model: {
        elements: {
          c1: { id: 'c1', type: 'Class', name: 'User', attributes: ['a1'], methods: [] },
          a1: { id: 'a1', type: 'ClassAttribute', name: 'email', attributeType: 'str', owner: 'c1' },
          e1: { id: 'e1', type: 'Enumeration', name: 'Role', attributes: ['l1'], methods: [] },
          l1: { id: 'l1', type: 'ClassAttribute', name: 'ADMIN', owner: 'e1' },
        },
        relationships: {
          r1: { id: 'r1', type: 'ClassBidirectional', source: { element: 'c1' }, target: { element: 'e1' } },
        },
      },
    }],
  },
};
vi.mock('../../../../app/hooks/useProject', () => ({ useProject: () => ({ currentProject: project }) }));

import { ModelOverviewPanel } from '../ModelOverviewPanel';

afterEach(cleanup);

describe('ModelOverviewPanel', () => {
  it('sends the id of the clicked class, attribute, enum literal or relationship', () => {
    const onFocusElement = vi.fn();
    render(<ModelOverviewPanel onClose={() => {}} onFocusElement={onFocusElement} />);

    fireEvent.click(screen.getByRole('button', { name: 'User' }));
    fireEvent.click(screen.getByRole('button', { name: /email/ }));
    fireEvent.click(screen.getByRole('button', { name: 'ADMIN' }));
    fireEvent.click(screen.getByRole('button', { name: /association/ }));

    expect(onFocusElement.mock.calls.map(([id]) => id)).toEqual(['c1', 'a1', 'l1', 'r1']);
  });
});
