import React from 'react';
import { BPMNExpandableUpdate, ExpandableElement } from '../common/bpmn-expandable-update';
import { BPMNTransaction } from './bpmn-transaction';

interface OwnProps {
  element: BPMNTransaction;
}

export const BPMNTransactionUpdate: React.ComponentType<OwnProps> = ({ element }) => (
  <BPMNExpandableUpdate element={element as unknown as ExpandableElement} labelKey="packages.BPMNDiagram.BPMNTransaction" />
);
