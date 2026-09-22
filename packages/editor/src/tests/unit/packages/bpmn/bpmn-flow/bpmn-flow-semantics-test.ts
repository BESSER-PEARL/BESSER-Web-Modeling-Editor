import { UMLElementType } from '../../../../../main/packages/uml-element-type';
import {
  getAllowedBpmnFlowTypes,
  getDefaultBpmnFlowType,
} from '../../../../../main/packages/bpmn/bpmn-flow/bpmn-flow-semantics';

describe('bpmn-flow-semantics', () => {
  it('allows sequence between flow nodes', () => {
    const allowed = getAllowedBpmnFlowTypes(UMLElementType.BPMNTask, UMLElementType.BPMNGateway);
    expect(allowed).toContain('sequence');
  });

  it('allows data association between task and data object', () => {
    const allowed = getAllowedBpmnFlowTypes(UMLElementType.BPMNTask, UMLElementType.BPMNDataObject);
    expect(allowed).toContain('data association');
  });

  it('allows association with annotation', () => {
    const allowed = getAllowedBpmnFlowTypes(UMLElementType.BPMNAnnotation, UMLElementType.BPMNTask);
    expect(allowed).toContain('association');
  });

  it('returns deterministic default type priority', () => {
    expect(getDefaultBpmnFlowType(['association', 'sequence'])).toBe('sequence');
    expect(getDefaultBpmnFlowType(['message', 'association'])).toBe('message');
  });
});