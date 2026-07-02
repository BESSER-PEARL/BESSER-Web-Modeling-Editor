import { describe, it, expect } from 'vitest';
import { UMLDiagramType } from '@besser/wme';
import type { UMLModel, BesserNode, BesserEdge } from '@besser/wme';
import { apollonBpmnToXml } from '../../export/bpmn-xml-exporter';
import { bpmnXmlToApollon } from '../bpmn-xml-importer';

// Round-trip test for the v4 .bpmn XML exporter ↔ importer pair.
//
// Builds a representative collaboration (pool, two lanes, task/event/gateway
// subtypes, sequence + message flows with a default flow, plus BPMN DI bounds),
// exports it to BPMN 2.0 XML, re-imports it, and asserts structural identity on
// node types, names, parentId containment, edge types, and the default flag.
//
// Positions are laid out so the node bounding box is centered on the origin; the
// importer's centerOnOrigin() shift is therefore a no-op.

function node(
  id: string,
  type: string,
  name: string,
  parentId: string | undefined,
  position: { x: number; y: number },
  size: { width: number; height: number },
  extraData: Record<string, unknown> = {},
): BesserNode {
  return {
    id,
    type: type as BesserNode['type'],
    position,
    width: size.width,
    height: size.height,
    measured: { width: size.width, height: size.height },
    data: { name, ...extraData },
    ...(parentId ? { parentId } : {}),
  };
}

function edge(
  id: string,
  source: string,
  target: string,
  type: string,
  name: string,
  points: Array<{ x: number; y: number }>,
  isDefault = false,
): BesserEdge {
  return {
    id,
    source,
    target,
    type: type as BesserEdge['type'],
    sourceHandle: '',
    targetHandle: '',
    data: { label: name, name, ...(isDefault ? { isDefault: true } : {}), points },
  };
}

function buildModel(): UMLModel {
  const S = { width: 40, height: 40 };
  const T = { width: 100, height: 50 };
  const nodes: BesserNode[] = [
    // Pool spans [-300,300] × [-150,150] → bounding box centered on origin.
    node('Pool_1', 'bpmnPool', 'Sales & Ops', undefined, { x: -300, y: -150 }, { width: 600, height: 300 }),
    node('Lane_1', 'bpmnSwimlane', 'Customer', 'Pool_1', { x: 30, y: 0 }, { width: 570, height: 150 }),
    node('Lane_2', 'bpmnSwimlane', 'System', 'Pool_1', { x: 30, y: 150 }, { width: 570, height: 150 }),
    node('Start_1', 'bpmnStartEvent', 'Order received', 'Lane_1', { x: 20, y: 55 }, S, { eventType: 'message' }),
    node('Task_user', 'bpmnTask', 'Review order', 'Lane_1', { x: 120, y: 50 }, T, {
      taskType: 'user',
      marker: 'parallel multi instance',
    }),
    node('Task_service', 'bpmnTask', 'Validate stock', 'Lane_2', { x: 120, y: 25 }, T, {
      taskType: 'service',
      marker: 'none',
    }),
    node('Gw_1', 'bpmnGateway', 'In stock?', 'Lane_2', { x: 270, y: 30 }, S, { gatewayType: 'exclusive' }),
    node('End_1', 'bpmnEndEvent', 'Done', 'Lane_2', { x: 470, y: 30 }, S, { eventType: 'terminate' }),
  ];

  const edges: BesserEdge[] = [
    edge('Seq_1', 'Start_1', 'Task_user', 'BPMNSequenceFlow', 'arrives', [
      { x: -210, y: -75 },
      { x: -150, y: -75 },
    ]),
    edge('Seq_2', 'Task_user', 'Gw_1', 'BPMNSequenceFlow', '', [
      { x: -50, y: -75 },
      { x: 20, y: 30 },
    ]),
    // Default outgoing flow from an exclusive gateway (BPMN 2.0.2 § 8.3.13).
    edge('Seq_3', 'Gw_1', 'End_1', 'BPMNSequenceFlow', 'yes', [{ x: 40, y: 50 }, { x: 200, y: 50 }], true),
    edge('Seq_4', 'Gw_1', 'Task_service', 'BPMNSequenceFlow', 'no', [
      { x: 20, y: 70 },
      { x: -50, y: 50 },
    ]),
    // Message flow lives at the collaboration level (a pool is present).
    edge('Msg_1', 'Task_service', 'Start_1', 'BPMNMessageFlow', 'restock', [
      { x: -100, y: 50 },
      { x: -230, y: -55 },
    ]),
  ];

  return {
    version: '4.0.0',
    id: 'model-1',
    title: 'RT',
    type: UMLDiagramType.BPMN,
    nodes,
    edges,
    assessments: {},
    interactive: { elements: {}, relationships: {} },
  };
}

describe('BPMN v4 XML export ↔ import round-trip', () => {
  const original = buildModel();
  const xml = apollonBpmnToXml(original);
  const result = bpmnXmlToApollon(xml);

  const outNodes = new Map(result.model.nodes.map((n) => [n.id, n]));
  const outEdges = new Map(result.model.edges.map((e) => [e.id, e]));

  it('re-imports as a BPMNDiagram model', () => {
    expect(result.model.type).toBe(UMLDiagramType.BPMN);
    expect(result.model.type).toBe('BPMNDiagram');
    expect(result.model.version).toBe('4.0.0');
  });

  it('preserves the full set of nodes', () => {
    expect([...outNodes.keys()].sort()).toEqual(original.nodes.map((n) => n.id).sort());
  });

  it('round-trips every node: type, name, parentId, and type-specific fields', () => {
    for (const before of original.nodes) {
      const after = outNodes.get(before.id);
      expect(after, `node ${before.id} missing after import`).toBeDefined();
      expect(after!.type).toBe(before.type);
      expect(after!.data.name).toBe(before.data.name);
      expect(after!.parentId ?? null).toBe(before.parentId ?? null);
      if (before.data.taskType !== undefined) expect(after!.data.taskType).toBe(before.data.taskType);
      if (before.data.gatewayType !== undefined) expect(after!.data.gatewayType).toBe(before.data.gatewayType);
      if (before.data.eventType !== undefined) expect(after!.data.eventType).toBe(before.data.eventType);
      if (before.type === 'bpmnTask') expect(after!.data.marker).toBe(before.data.marker);
    }
  });

  it('preserves the full set of edges', () => {
    expect([...outEdges.keys()].sort()).toEqual(original.edges.map((e) => e.id).sort());
  });

  it('round-trips every edge: type, endpoints, name (data.name + data.label), and default flag', () => {
    for (const before of original.edges) {
      const after = outEdges.get(before.id);
      expect(after, `edge ${before.id} missing after import`).toBeDefined();
      expect(after!.type).toBe(before.type);
      expect(after!.source).toBe(before.source);
      expect(after!.target).toBe(before.target);
      expect(after!.data.name).toBe(before.data.name);
      expect(after!.data.label).toBe(before.data.name);
      expect(Boolean(after!.data.isDefault)).toBe(Boolean(before.data.isDefault));
    }
  });

  it('keeps the gateway default flow attached to exactly one source', () => {
    expect(outEdges.get('Seq_3')!.data.isDefault).toBe(true);
    expect(Boolean(outEdges.get('Seq_4')!.data.isDefault)).toBe(false);
    expect(result.model.edges.filter((e) => e.data.isDefault).length).toBe(1);
  });
});
