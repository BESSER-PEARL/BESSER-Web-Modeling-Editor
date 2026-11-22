import { describe, expect, it } from 'vitest';
import { canAssistantWriteTo, isAssistantApplicableTo } from '../assistantSupport';

describe('assistantSupport', () => {
  it('hides the assistant on the NN and Knowledge Graph diagrams only', () => {
    expect(isAssistantApplicableTo('NNDiagram')).toBe(false);
    expect(isAssistantApplicableTo('KnowledgeGraphDiagram')).toBe(false);
    for (const type of ['ClassDiagram', 'BPMN', 'GUINoCodeDiagram', 'QuantumCircuitDiagram', undefined]) {
      expect(isAssistantApplicableTo(type)).toBe(true);
    }
  });

  it('never lets the assistant write a Knowledge Graph', () => {
    expect(canAssistantWriteTo('KnowledgeGraphDiagram')).toBe(false);
    expect(canAssistantWriteTo('ClassDiagram')).toBe(true);
  });
});
