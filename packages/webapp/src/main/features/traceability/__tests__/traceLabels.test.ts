import { describe, expect, it } from 'vitest';
import en from '../../../../../../i18n/en/webapp.json';
import { APOLLON_TABLES, snapshotKnowledgeGraph, snapshotQuantumModel } from '../../../shared/traceability/diagramModelDiff';

const labels = en.traceability.elementTypes as Record<string, string>;

describe('element type labels', () => {
  it('names every metaclass the diagram tables record', () => {
    // Live: agent, BPMN, NN, quantum and state machine elements showed raw names (AGENTSTATE, LAYERORDER).
    const metaclasses = new Set<string>();
    for (const table of Object.values(APOLLON_TABLES)) {
      for (const rule of Object.values(table!.elements)) if (typeof rule.metaclass === 'string') metaclasses.add(rule.metaclass);
      for (const mapped of Object.values(table!.relationships)) if (typeof mapped === 'string') metaclasses.add(mapped);
    }
    const quantum = snapshotQuantumModel({ cols: [['H', 'X'], ['Swap', 'Swap'], ['Measure', 'Rx(0.5)'], ['mystery', 1]] }, 'qc');
    for (const snapshot of quantum.values()) metaclasses.add(snapshot.elementType);
    const kg = snapshotKnowledgeGraph({ nodes: [{ id: 'n', nodeType: 'class', label: 'A' }], edges: [{ id: 'e', source: 'n', target: 'n', label: 'p' }] } as never);
    for (const snapshot of kg.values()) metaclasses.add(snapshot.elementType);

    expect([...metaclasses].filter((metaclass) => !labels[metaclass])).toEqual([]);
  });
});
