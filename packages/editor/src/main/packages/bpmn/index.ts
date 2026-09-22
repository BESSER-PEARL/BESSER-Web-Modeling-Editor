import { BPMNFlow } from './bpmn-flow/bpmn-flow';

export const BPMNElementType = {
  BPMNTask: 'BPMNTask',
  BPMNSubprocess: 'BPMNSubprocess',
  BPMNTransaction: 'BPMNTransaction',
  BPMNCallActivity: 'BPMNCallActivity',
  BPMNAnnotation: 'BPMNAnnotation',
  BPMNStartEvent: 'BPMNStartEvent',
  BPMNIntermediateEvent: 'BPMNIntermediateEvent',
  BPMNEndEvent: 'BPMNEndEvent',
  BPMNGateway: 'BPMNGateway',
  BPMNDataObject: 'BPMNDataObject',
  BPMNDataStore: 'BPMNDataStore',
  BPMNPool: 'BPMNPool',
  BPMNSwimlane: 'BPMNSwimlane',
  BPMNGroup: 'BPMNGroup',
} as const;

export const BPMNRelationshipType = {
  BPMNFlow: 'BPMNFlow',
} as const;

/**
 * BPMN container element types that can be collapsed/expanded (subprocess &
 * transaction). Centralizes the subprocess/transaction pair so callers don't
 * scatter raw 'BPMNSubprocess'/'BPMNTransaction' string checks.
 */
export function isCollapsibleBpmnContainer(type: string | undefined | null): boolean {
  return type === BPMNElementType.BPMNSubprocess || type === BPMNElementType.BPMNTransaction;
}
