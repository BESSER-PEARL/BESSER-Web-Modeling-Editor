import { describe, expect, it } from 'vitest';
import en from '../../../../../../i18n/en/webapp.json';
import { APOLLON_TABLES, snapshotKnowledgeGraph, snapshotQuantumModel } from '../../../shared/traceability/diagramModelDiff';
import i18n from '../../../shared/i18n';
import { generatorLabel } from '../traceLabels';
import { cardCounts } from '../lineage/lineageLabels';
import type { LineageSubject } from '../../../shared/traceability/lineage';

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

describe('generator labels', () => {
  it('names a generator as the Generate menu does, and keeps the name of a tool the menu does not offer', () => {
    // Live: "Generated sqlalchemy", "python: 1 file out of date".
    const t = i18n.getFixedT('en');
    expect(generatorLabel(t, 'sqlalchemy')).toBe('SQLAlchemy DDL');
    expect(generatorLabel(t, 'python')).toBe('Python Classes');
    // Offered in several forms under one group: the group names it.
    expect(generatorLabel(t, 'pytorch')).toBe('PyTorch');
    expect(generatorLabel(t, 'gpt-6-luna')).toBe('gpt-6-luna');
  });
});

describe('lineage card counts', () => {
  it('counts the cards by kind, in the page language', () => {
    // Live: "3 diagrams, prompts and generation runs" for one diagram and two runs.
    const t = i18n.getFixedT('en');
    const time = '2026-11-18T10:00:00.000Z';
    const run = (id: string): LineageSubject => ({ kind: 'run', id, operation: { id, type: 'CodeGeneration', status: 'SUCCEEDED', startedAt: time, performedBy: [], toolCalls: [], reads: [], writes: [] } });
    const diagram: LineageSubject = { kind: 'artifact', id: 'cd', artifact: { id: 'cd', type: 'ModelArtifact', name: 'Library', elementId: 'd', elementType: 'DomainModel', timestamp: time } };
    const prompt: LineageSubject = { kind: 'artifact', id: 'p', artifact: { id: 'p', type: 'PromptArtifact', name: 'p', content: 'a library', contentHash: 'h', timestamp: time } };
    expect(cardCounts(t, [diagram, run('a'), run('b')], 'en')).toBe('1 diagram and 2 generation runs');
    expect(cardCounts(t, [run('a'), prompt, diagram], 'en')).toBe('1 diagram, 1 prompt, and 1 generation run');
  });
});
