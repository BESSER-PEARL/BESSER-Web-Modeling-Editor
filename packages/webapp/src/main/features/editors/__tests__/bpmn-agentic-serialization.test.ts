import { describe, it, expect } from 'vitest';
import { convertV3ToV4 } from '@besser/wme';
import type { UMLModel } from '@besser/wme';
import { bpmnModelToXml } from '../../export/bpmn-xml-exporter';
import { bpmnXmlToModel } from '../../import/bpmn-xml-importer';

// Agentic BPMN fields on the v4 model: a stored v3 diagram converts with them on
// `node.data` (same names), and the BPMN XML round-trip keeps them.

const AGENTIC_KEYS = [
  'isAgentic',
  'reflectionMode',
  'trustScore',
  'gatewayRole',
  'governanceDsl',
  'role',
  'multiplicity',
];

const agenticKeysOf = (data: object) => Object.keys(data).filter((key) => AGENTIC_KEYS.includes(key));

const bounds = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });

// A stored v3 BPMN diagram: pool → lane → task + gateway.
function v3Bpmn(extra: { lane?: object; task?: object; gateway?: object } = {}) {
  return {
    version: '3.0.0',
    type: 'BPMNDiagram',
    size: { width: 800, height: 400 },
    interactive: { elements: {}, relationships: {} },
    assessments: {},
    elements: {
      P: { id: 'P', name: 'Pool', type: 'BPMNPool', owner: null, bounds: bounds(0, 0, 600, 300) },
      L: { id: 'L', name: 'Coder', type: 'BPMNSwimlane', owner: 'P', bounds: bounds(40, 0, 560, 300), ...extra.lane },
      T: {
        id: 'T',
        name: 'Plan',
        type: 'BPMNTask',
        owner: 'L',
        bounds: bounds(80, 40, 100, 60),
        taskType: 'default',
        marker: 'none',
        ...extra.task,
      },
      G: {
        id: 'G',
        name: 'Split',
        type: 'BPMNGateway',
        owner: 'L',
        bounds: bounds(240, 50, 40, 40),
        gatewayType: 'parallel',
        ...extra.gateway,
      },
    },
    relationships: {},
  };
}

const convert = (v3: ReturnType<typeof v3Bpmn>): UMLModel => convertV3ToV4(v3 as never);

const dataOf = (model: UMLModel, id: string): Record<string, unknown> => {
  const found = model.nodes.find((n) => n.id === id);
  if (!found) throw new Error(`no node ${id}`);
  return found.data;
};

// Re-import matches by name; the XML ids are the v4 ids.
const roundTrip = (model: UMLModel): UMLModel => bpmnXmlToModel(bpmnModelToXml(model)).model;

describe('agentic BPMN fields on the v4 model', () => {
  it('writes no agentic fields for plain tasks, gateways and lanes', () => {
    const model = convert(v3Bpmn());
    for (const id of ['T', 'G', 'L']) {
      expect(agenticKeysOf(dataOf(model, id))).toEqual([]);
      expect(agenticKeysOf(dataOf(roundTrip(model), id))).toEqual([]);
    }
  });

  it('carries the agentic fields of agentic elements and reads them back', () => {
    const model = convert(
      v3Bpmn({
        task: { isAgentic: true, reflectionMode: 'self', trustScore: 40 },
        lane: { isAgentic: true, role: 'supervision', multiplicity: 3 },
      }),
    );
    expect(dataOf(model, 'T')).toMatchObject({ isAgentic: true, reflectionMode: 'self', trustScore: 40 });
    expect(dataOf(model, 'L')).toMatchObject({ isAgentic: true, role: 'supervision', multiplicity: 3 });

    const restored = roundTrip(model);
    expect(dataOf(restored, 'T')).toMatchObject({ isAgentic: true, reflectionMode: 'self', trustScore: 40 });
    expect(dataOf(restored, 'L')).toMatchObject({ isAgentic: true, role: 'supervision', multiplicity: 3 });
  });

  it('reads a plain element back as non-agentic, leaving the defaults to the editor', () => {
    const restored = dataOf(roundTrip(convert(v3Bpmn())), 'G');
    expect(restored.gatewayType).toBe('parallel');
    expect(restored.isAgentic).toBeUndefined();
    expect(restored.gatewayRole).toBeUndefined();
    expect(restored.trustScore).toBeUndefined();
  });

  it('keeps an Agent diagram link on a task that is no longer agentic', () => {
    const model = convert(v3Bpmn({ task: { agentDiagramRef: 'agent-1' } }));
    expect(dataOf(model, 'T').agentDiagramRef).toBe('agent-1');
  });
});
