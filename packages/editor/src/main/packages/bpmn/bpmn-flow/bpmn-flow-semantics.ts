import { UMLElementType } from '../../uml-element-type';
import { BPMNFlowType } from './bpmn-flow';

const flowNodes = new Set<UMLElementType>([
  UMLElementType.BPMNStartEvent,
  UMLElementType.BPMNIntermediateEvent,
  UMLElementType.BPMNEndEvent,
  UMLElementType.BPMNTask,
  UMLElementType.BPMNSubprocess,
  UMLElementType.BPMNTransaction,
  UMLElementType.BPMNCallActivity,
  UMLElementType.BPMNGateway,
]);

const dataNodes = new Set<UMLElementType>([
  UMLElementType.BPMNDataObject,
  UMLElementType.BPMNDataStore,
]);

const artifactNodes = new Set<UMLElementType>([
  UMLElementType.BPMNAnnotation,
  UMLElementType.BPMNGroup,
]);

const messageEligible = new Set<UMLElementType>([
  UMLElementType.BPMNTask,
  UMLElementType.BPMNSubprocess,
  UMLElementType.BPMNTransaction,
  UMLElementType.BPMNCallActivity,
  UMLElementType.BPMNStartEvent,
  UMLElementType.BPMNIntermediateEvent,
  UMLElementType.BPMNEndEvent,
]);

export function getAllowedBpmnFlowTypes(source: UMLElementType, target: UMLElementType): BPMNFlowType[] {
  const allowed: BPMNFlowType[] = [];

  if (flowNodes.has(source) && flowNodes.has(target)) {
    allowed.push('sequence');
  }

  if (
    (dataNodes.has(source) && flowNodes.has(target)) ||
    (flowNodes.has(source) && dataNodes.has(target))
  ) {
    allowed.push('data association');
  }

  if (artifactNodes.has(source) || artifactNodes.has(target)) {
    allowed.push('association');
  }

  if (messageEligible.has(source) && messageEligible.has(target)) {
    allowed.push('message');
  }

  return allowed;
}

export function getDefaultBpmnFlowType(allowed: BPMNFlowType[]): BPMNFlowType {
  if (allowed.includes('sequence')) return 'sequence';
  if (allowed.includes('message')) return 'message';
  if (allowed.includes('data association')) return 'data association';
  return 'association';
}