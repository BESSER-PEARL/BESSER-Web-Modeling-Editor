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

const dataNodes = new Set<UMLElementType>([UMLElementType.BPMNDataObject, UMLElementType.BPMNDataStore]);

const artifactNodes = new Set<UMLElementType>([UMLElementType.BPMNAnnotation, UMLElementType.BPMNGroup]);

const messageEligible = new Set<UMLElementType>([
  UMLElementType.BPMNTask,
  UMLElementType.BPMNSubprocess,
  UMLElementType.BPMNTransaction,
  UMLElementType.BPMNCallActivity,
  UMLElementType.BPMNStartEvent,
  UMLElementType.BPMNIntermediateEvent,
  UMLElementType.BPMNEndEvent,
  // BPMN 2.0.2 § 10.6: message flows go between participants (pools). Allow
  // dragging directly between pool boundaries so the user doesn't have to
  // draw an association first and switch its type to `message`.
  UMLElementType.BPMNPool,
]);

export function getAllowedBpmnFlowTypes(source: UMLElementType, target: UMLElementType): BPMNFlowType[] {
  const allowed: BPMNFlowType[] = [];

  if (flowNodes.has(source) && flowNodes.has(target)) {
    allowed.push('sequence');
  }

  if ((dataNodes.has(source) && flowNodes.has(target)) || (flowNodes.has(source) && dataNodes.has(target))) {
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
