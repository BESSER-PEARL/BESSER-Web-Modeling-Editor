import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getJsonModel } from '../../../shared/api/conversion';
import { useBumlToDiagram } from '../useBumlToDiagram';

vi.mock('../../../shared/api/conversion', () => ({ getJsonModel: vi.fn() }));

const apollonModel = (type: string) => ({
  version: '3.0.0',
  type,
  size: { width: 0, height: 0 },
  interactive: { elements: {}, relationships: {} },
  elements: { n1: { id: 'n1', type: 'Class', name: 'A' } },
  relationships: {},
  assessments: {},
});

const backendAnswers = (model: unknown) =>
  vi.mocked(getJsonModel).mockResolvedValue({
    title: 'imported',
    diagramType: 'x',
    exportedAt: 'x',
    version: '1',
    warnings: [],
    model,
  } as unknown as Awaited<ReturnType<typeof getJsonModel>>);

const importFile = () => renderHook(() => useBumlToDiagram()).result.current(new File(['x'], 'm.py'));

afterEach(() => vi.clearAllMocks());

describe('useBumlToDiagram', () => {
  it.each(['ClassDiagram', 'ComponentDiagram', 'DeploymentDiagram', 'NNDiagram', 'BPMNDiagram', 'AgentDiagram'])(
    'keeps a %s as its own type',
    async (type) => {
      backendAnswers(apollonModel(type));
      const diagram = await importFile();
      expect((diagram.model as { type: string }).type).toBe(type);
      expect(diagram.title).toBe('imported');
    },
  );

  it.each([
    ['GUINoCodeDiagram', { type: 'GUINoCodeDiagram', pages: [{ id: 'p' }] }],
    ['QuantumCircuitDiagram', { type: 'QuantumCircuitDiagram', cols: [], gates: [] }],
  ])('rejects a %s, which has no elements to place', async (_type, model) => {
    backendAnswers(model);
    await expect(importFile()).rejects.toThrow('Invalid diagram: missing model or type information');
  });

  it.each(['GUINoCodeDiagram', 'QuantumCircuitDiagram', 'KnowledgeGraphDiagram', 'ActivityDiagram'])(
    'rejects a %s even in an element/relationship shape instead of filing it as a class diagram',
    async (type) => {
      backendAnswers(apollonModel(type));
      await expect(importFile()).rejects.toThrow(`Unsupported diagram type for a B-UML diagram import: ${type}`);
    },
  );
});
