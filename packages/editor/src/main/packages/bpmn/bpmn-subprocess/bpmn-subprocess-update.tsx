import React from 'react';
import { BPMNExpandableUpdate, ExpandableElement } from '../common/bpmn-expandable-update';
import { BPMNSubprocess } from './bpmn-subprocess';

interface OwnProps {
  element: BPMNSubprocess;
}

export const BPMNSubprocessUpdate: React.ComponentType<OwnProps> = ({ element }) => (
  <BPMNExpandableUpdate element={element as unknown as ExpandableElement} expandLabel="subprocess" />
);
