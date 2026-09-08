import { describe, it, expect } from 'vitest';
import { UMLModel, UMLDiagramType } from '@besser/wme';
import { apollonBpmnToXml } from '../../export/bpmn-xml-exporter';
import { bpmnXmlToApollon } from '../bpmn-xml-importer';

// Round-trip test for the .bpmn XML exporter ↔ importer pair.
//
// Builds a representative collaboration (pool, two lanes, a few task/event/gateway
// types, sequence + message flows with a default flow, plus BPMN DI bounds),
// exports it to BPMN 2.0 XML, re-imports it, and asserts structural + DI-bounds
// identity — the export/import equivalent of the serialize()/deserialize() identity
// pattern in the editor's bpmn-start-event-types-test.ts.
//
// The source model is laid out so its node bounding box is already centered on the
// origin; the importer's centerOnOrigin() shift is therefore a no-op (dx = dy = 0),
// which lets absolute DI bounds and edge waypoints round-trip exactly.

type Bounds = { x: number; y: number; width: number; height: number };
type Point = { x: number; y: number };

interface TestElement {
  id: string;
  type: string;
  name: string;
  owner: string | null;
  bounds: Bounds;
  taskType?: string;
  marker?: string;
  gatewayType?: string;
  eventType?: string;
}

interface TestFlow {
  id: string;
  type: 'BPMNFlow';
  name: string;
  owner: null;
  bounds: Bounds;
  path: Point[];
  source: { element: string; direction: string };
  target: { element: string; direction: string };
  flowType: 'sequence' | 'message' | 'association' | 'data association';
  isDefault?: boolean;
}

/**
 * Build a flow the way the importer stores them: `bounds` is the min corner of the
 * absolute waypoints and `path` holds the waypoints relative to that corner. This
 * is the normalized form that survives an export → import cycle unchanged.
 */
function flow(
  id: string,
  source: string,
  target: string,
  flowType: TestFlow['flowType'],
  waypoints: Point[],
  opts: { name?: string; isDefault?: boolean } = {},
): TestFlow {
  const xs = waypoints.map((p) => p.x);
  const ys = waypoints.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    id,
    type: 'BPMNFlow',
    name: opts.name ?? '',
    owner: null,
    bounds: { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y },
    path: waypoints.map((p) => ({ x: p.x - x, y: p.y - y })),
    source: { element: source, direction: 'Right' },
    target: { element: target, direction: 'Left' },
    flowType,
    ...(opts.isDefault ? { isDefault: true } : {}),
  };
}

function buildModel(): UMLModel {
  const elements: TestElement[] = [
    // Pool spanning [-300,300] × [-150,150] → bounding box centered on origin.
    { id: 'Pool_1', type: 'BPMNPool', name: 'Sales & Ops', owner: null, bounds: { x: -300, y: -150, width: 600, height: 300 } },
    { id: 'Lane_1', type: 'BPMNSwimlane', name: 'Customer', owner: 'Pool_1', bounds: { x: -270, y: -150, width: 570, height: 150 } },
    { id: 'Lane_2', type: 'BPMNSwimlane', name: 'System', owner: 'Pool_1', bounds: { x: -270, y: 0, width: 570, height: 150 } },
    {
      id: 'Start_1',
      type: 'BPMNStartEvent',
      name: 'Order received',
      owner: 'Lane_1',
      bounds: { x: -250, y: -95, width: 40, height: 40 },
      eventType: 'message',
    },
    {
      id: 'Task_user',
      type: 'BPMNTask',
      name: 'Review order',
      owner: 'Lane_1',
      bounds: { x: -150, y: -100, width: 100, height: 50 },
      taskType: 'user',
      marker: 'parallel multi instance',
    },
    {
      id: 'Task_service',
      type: 'BPMNTask',
      name: 'Validate stock',
      owner: 'Lane_2',
      bounds: { x: -150, y: 25, width: 100, height: 50 },
      taskType: 'service',
      marker: 'none',
    },
    {
      id: 'Gw_1',
      type: 'BPMNGateway',
      name: 'In stock?',
      owner: 'Lane_2',
      bounds: { x: 0, y: 30, width: 40, height: 40 },
      gatewayType: 'exclusive',
    },
    {
      id: 'End_1',
      type: 'BPMNEndEvent',
      name: 'Done',
      owner: 'Lane_2',
      bounds: { x: 200, y: 30, width: 40, height: 40 },
      eventType: 'terminate',
    },
  ];

  const relationships: TestFlow[] = [
    flow('Seq_1', 'Start_1', 'Task_user', 'sequence', [{ x: -210, y: -75 }, { x: -150, y: -75 }], { name: 'arrives' }),
    flow('Seq_2', 'Task_user', 'Gw_1', 'sequence', [{ x: -50, y: -75 }, { x: 20, y: 30 }]),
    // Default outgoing flow from an exclusive gateway (BPMN 2.0.2 § 8.3.13).
    flow('Seq_3', 'Gw_1', 'End_1', 'sequence', [{ x: 40, y: 50 }, { x: 200, y: 50 }], { name: 'yes', isDefault: true }),
    flow('Seq_4', 'Gw_1', 'Task_service', 'sequence', [{ x: 20, y: 70 }, { x: -50, y: 50 }], { name: 'no' }),
    // Message flow lives at the collaboration level (a pool is present).
    flow('Msg_1', 'Task_service', 'Start_1', 'message', [{ x: -100, y: 50 }, { x: -230, y: -55 }], { name: 'restock' }),
  ];

  const elementMap: Record<string, TestElement> = {};
  for (const e of elements) elementMap[e.id] = e;
  const relMap: Record<string, TestFlow> = {};
  for (const r of relationships) relMap[r.id] = r;

  return {
    version: '3.0.0',
    type: UMLDiagramType.BPMN,
    size: { width: 800, height: 600 },
    interactive: { elements: {}, relationships: {} },
    elements: elementMap,
    relationships: relMap,
    assessments: {},
  } as unknown as UMLModel;
}

describe('BPMN XML export ↔ import round-trip', () => {
  const original = buildModel();
  const { xml, skipped: exportSkipped } = apollonBpmnToXml(original);
  const result = bpmnXmlToApollon(xml);

  const origElements = original.elements as unknown as Record<string, TestElement>;
  const origRels = original.relationships as unknown as Record<string, TestFlow>;
  const outElements = result.model.elements as unknown as Record<string, TestElement>;
  const outRels = result.model.relationships as unknown as Record<string, TestFlow>;

  it('exports and re-imports without skipping anything or emitting warnings', () => {
    expect(exportSkipped).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.model.type).toBe(UMLDiagramType.BPMN);
  });

  it('preserves the full set of elements', () => {
    expect(Object.keys(outElements).sort()).toEqual(Object.keys(origElements).sort());
  });

  it('round-trips every element: type, name, owner, DI bounds, and type-specific fields', () => {
    for (const id of Object.keys(origElements)) {
      const before = origElements[id];
      const after = outElements[id];
      expect(after, `element ${id} missing after import`).toBeDefined();
      expect(after.type).toBe(before.type);
      expect(after.name).toBe(before.name);
      // null/undefined owner both mean "top level".
      expect(after.owner ?? null).toBe(before.owner ?? null);
      expect(after.bounds).toEqual(before.bounds);
      expect(after.taskType).toBe(before.taskType);
      expect(after.gatewayType).toBe(before.gatewayType);
      expect(after.eventType).toBe(before.eventType);
      if (before.type === 'BPMNTask') {
        // Importer always materializes a marker ('none' when no loop characteristics).
        expect(after.marker).toBe(before.marker);
      }
    }
  });

  it('preserves the full set of flows', () => {
    expect(Object.keys(outRels).sort()).toEqual(Object.keys(origRels).sort());
  });

  it('round-trips every flow: endpoints, flowType, default flag, name, and DI waypoints', () => {
    for (const id of Object.keys(origRels)) {
      const before = origRels[id];
      const after = outRels[id];
      expect(after, `flow ${id} missing after import`).toBeDefined();
      expect(after.type).toBe('BPMNFlow');
      expect(after.name).toBe(before.name);
      expect(after.flowType).toBe(before.flowType);
      expect(after.source.element).toBe(before.source.element);
      expect(after.target.element).toBe(before.target.element);
      expect(Boolean(after.isDefault)).toBe(Boolean(before.isDefault));
      // DI edge geometry: bounds + waypoints (path is relative to bounds).
      expect(after.bounds).toEqual(before.bounds);
      expect(after.path).toEqual(before.path);
    }
  });

  it('keeps the gateway default flow attached to the correct source', () => {
    expect(outRels['Seq_3'].isDefault).toBe(true);
    // Only the one default flow is marked; sibling branches stay non-default.
    expect(Boolean(outRels['Seq_4'].isDefault)).toBe(false);
    expect(Object.values(outRels).filter((r) => r.isDefault)).toHaveLength(1);
  });
});
