/**
 * Assistant BPMN converter / modifier tests (v4-native).
 *
 * Models carry `nodes[]` / `edges[]` arrays; node types are the library's
 * lowerCamelCase React-Flow types (`bpmnTask`, `bpmnPool`, …) and flows are
 * `BPMNSequenceFlow` / `BPMNMessageFlow` edges.
 */

import { BPMNDiagramConverter } from '../converters/BPMNDiagramConverter';
import { BPMNDiagramModifier } from '../modifiers/BPMNDiagramModifier';
import type { ModelModification } from '../modifiers/base';
import type { BESSERModel } from '../UMLModelingService';
import { isUMLModel } from '../../../../shared/types/project';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEmptyBPMNModel(): BESSERModel {
  return {
    version: '4.0.0',
    id: '',
    title: '',
    type: 'BPMNDiagram',
    nodes: [],
    edges: [],
    assessments: {},
  } as any;
}

function nodesByType(model: any, type: string): any[] {
  return ((model.nodes ?? []) as any[]).filter((n) => n.type === type);
}

function bpmnNode(
  id: string,
  type: string,
  name: string,
  x: number,
  extraData: Record<string, unknown> = {},
  size: { width: number; height: number } = { width: 140, height: 60 },
): any {
  return {
    id,
    type,
    position: { x, y: 0 },
    width: size.width,
    height: size.height,
    measured: { ...size },
    data: { name, ...extraData },
  };
}

/** Absolute canvas rectangle of a node (children are positioned relative to their parent). */
function absoluteRect(model: any, node: any): { x: number; y: number; width: number; height: number } {
  let x = node.position.x;
  let y = node.position.y;
  let parent = node.parentId ? model.nodes.find((n: any) => n.id === node.parentId) : undefined;
  while (parent) {
    x += parent.position.x;
    y += parent.position.y;
    parent = parent.parentId ? model.nodes.find((n: any) => n.id === parent.parentId) : undefined;
  }
  return { x, y, width: node.width, height: node.height };
}

// ═══════════════════════════════════════════════════════════════════════════
// BPMNDiagramConverter
// ═══════════════════════════════════════════════════════════════════════════

describe('BPMNDiagramConverter', () => {
  const converter = new BPMNDiagramConverter();

  describe('convertCompleteSystem', () => {
    it('creates nodes for each spec node with the correct v4 node types', () => {
      const result = converter.convertCompleteSystem({
        nodes: [
          { id: 'n0', type: 'startEvent', name: 'Start' },
          { id: 'n1', type: 'task', name: 'Do Work', taskType: 'user' },
          { id: 'n2', type: 'gateway', name: 'Decision', gatewayType: 'exclusive' },
          { id: 'n3', type: 'endEvent', name: 'End' },
        ],
        flows: [
          { source: 'n0', target: 'n1' },
          { source: 'n1', target: 'n2' },
          { source: 'n2', target: 'n3' },
        ],
      });

      expect(isUMLModel(result)).toBe(true);
      expect(result.version).toBe('4.0.0');
      expect(result).not.toHaveProperty('elements');
      expect(nodesByType(result, 'bpmnStartEvent')).toHaveLength(1);
      expect(nodesByType(result, 'bpmnTask')).toHaveLength(1);
      expect(nodesByType(result, 'bpmnGateway')).toHaveLength(1);
      expect(nodesByType(result, 'bpmnEndEvent')).toHaveLength(1);
      expect(result.edges).toHaveLength(3);
      result.edges.forEach((e: any) => expect(e.type).toBe('BPMNSequenceFlow'));
    });

    it('sets taskType on bpmnTask and falls back to "default" for unknown types', () => {
      const result = converter.convertCompleteSystem({
        nodes: [
          { id: 't1', type: 'task', name: 'ValidTask', taskType: 'service' },
          { id: 't2', type: 'task', name: 'BadTask', taskType: 'invalid' },
        ],
        flows: [],
      });
      const tasks = nodesByType(result, 'bpmnTask');
      const valid = tasks.find((t) => t.data.name === 'ValidTask');
      const bad = tasks.find((t) => t.data.name === 'BadTask');
      expect(valid?.data.taskType).toBe('service');
      expect(bad?.data.taskType).toBe('default');
      expect(valid?.data.marker).toBe('none');
    });

    it('passes through eventType on event nodes', () => {
      const result = converter.convertCompleteSystem({
        nodes: [{ id: 'e0', type: 'startEvent', name: 'MsgStart', eventType: 'message' }],
        flows: [],
      });
      const events = nodesByType(result, 'bpmnStartEvent');
      expect(events[0]?.data.eventType).toBe('message');
    });

    it('centers content around the origin', () => {
      const result = converter.convertCompleteSystem({
        nodes: [
          { id: 'a', type: 'task', name: 'A' },
          { id: 'b', type: 'task', name: 'B' },
        ],
        flows: [{ source: 'a', target: 'b' }],
      });
      const rects = result.nodes.map((n: any) => absoluteRect(result, n));
      const minX = Math.min(...rects.map((r) => r.x));
      const maxX = Math.max(...rects.map((r) => r.x + r.width));
      const minY = Math.min(...rects.map((r) => r.y));
      const maxY = Math.max(...rects.map((r) => r.y + r.height));
      expect(Math.round((minX + maxX) / 2)).toBe(0);
      expect(Math.round((minY + maxY) / 2)).toBe(0);
    });

    it('emits model.type "BPMNDiagram"', () => {
      const result = converter.convertCompleteSystem({ nodes: [], flows: [] });
      expect(result.type).toBe('BPMNDiagram');
      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
    });

    it('ignores flows that reference unknown node ids', () => {
      const result = converter.convertCompleteSystem({
        nodes: [{ id: 'x', type: 'task', name: 'X' }],
        flows: [{ source: 'x', target: 'missing' }],
      });
      expect(result.edges).toHaveLength(0);
    });

    it('writes the flow label to both data.name and data.label and keeps the default marker', () => {
      const result = converter.convertCompleteSystem({
        nodes: [
          { id: 'g', type: 'gateway', name: 'Ok?' },
          { id: 't', type: 'task', name: 'Ship' },
        ],
        flows: [{ source: 'g', target: 't', name: 'yes', isDefault: true }],
      });
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].data).toMatchObject({ name: 'yes', label: 'yes', isDefault: true });
    });

    it('convertSingleElement returns a one-node {nodes, edges} fragment', () => {
      const result = converter.convertSingleElement({ type: 'task', name: 'Solo' });
      expect(result.edges).toEqual([]);
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0]).toMatchObject({ type: 'bpmnTask', data: { name: 'Solo' } });
    });

    it('emits pools, swimlanes, and lane-parented nodes for pooled specs', () => {
      const result = converter.convertCompleteSystem({
        nodes: [
          {
            id: 'start',
            type: 'startEvent',
            name: 'Order Received',
            poolId: 'pizza_vendor',
            laneId: 'clerk',
            owner: 'clerk',
          },
          {
            id: 'task1',
            type: 'task',
            name: 'Check Ingredients',
            taskType: 'service',
            poolId: 'pizza_vendor',
            laneId: 'chef',
            owner: 'chef',
          },
        ],
        flows: [{ source: 'start', target: 'task1' }],
        pools: [
          {
            id: 'pizza_vendor',
            name: 'Pizza Vendor',
            lanes: [
              { id: 'clerk', name: 'Clerk' },
              { id: 'chef', name: 'Chef' },
              { id: 'delivery_driver', name: 'Delivery Driver' },
            ],
          },
        ],
      });

      const pools = nodesByType(result, 'bpmnPool');
      const lanes = nodesByType(result, 'bpmnSwimlane');
      const start = nodesByType(result, 'bpmnStartEvent')[0];
      const task = nodesByType(result, 'bpmnTask')[0];
      const clerkLane = lanes.find((lane) => lane.data.name === 'Clerk');
      const chefLane = lanes.find((lane) => lane.data.name === 'Chef');
      const emptyLane = lanes.find((lane) => lane.data.name === 'Delivery Driver');

      expect(pools).toHaveLength(1);
      expect(pools[0].parentId).toBeUndefined();
      expect(lanes).toHaveLength(3);
      expect(clerkLane?.parentId).toBe(pools[0].id);
      expect(chefLane?.parentId).toBe(pools[0].id);
      expect(emptyLane).toBeDefined();
      // Flow nodes are parented to their lane (never to the raw spec lane id).
      expect(start.parentId).toBe(clerkLane?.id);
      expect(task.parentId).toBe(chefLane?.id);
      expect(start.parentId).not.toBe('clerk');
      expect(task.parentId).not.toBe('chef');

      // Geometry: lanes tile the pool vertically, nodes sit inside their lane.
      const poolRect = absoluteRect(result, pools[0]);
      lanes.forEach((lane) => {
        const r = absoluteRect(result, lane);
        expect(r.x).toBeGreaterThanOrEqual(poolRect.x);
        expect(r.y).toBeGreaterThanOrEqual(poolRect.y);
        expect(r.y + r.height).toBeLessThanOrEqual(poolRect.y + poolRect.height + 0.001);
      });
      const startRect = absoluteRect(result, start);
      const clerkRect = absoluteRect(result, clerkLane);
      expect(startRect.y).toBeGreaterThanOrEqual(clerkRect.y);
      expect(startRect.y + startRect.height).toBeLessThanOrEqual(clerkRect.y + clerkRect.height);

      // Same-pool flow stays a sequence flow.
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].type).toBe('BPMNSequenceFlow');
    });

    it('infers message flows for cross-pool edges', () => {
      const result = converter.convertCompleteSystem({
        nodes: [
          { id: 'customer_send', type: 'task', name: 'Place Order', poolId: 'customer', laneId: 'customer_lane' },
          { id: 'vendor_receive', type: 'task', name: 'Receive Order', poolId: 'vendor', laneId: 'vendor_lane' },
        ],
        flows: [{ source: 'customer_send', target: 'vendor_receive' }],
        pools: [
          { id: 'customer', name: 'Customer', lanes: [{ id: 'customer_lane', name: 'Customer' }] },
          { id: 'vendor', name: 'Vendor', lanes: [{ id: 'vendor_lane', name: 'Vendor' }] },
        ],
      });

      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].type).toBe('BPMNMessageFlow');
      // Cross-pool flows run vertically between the stacked pools.
      expect(result.edges[0].sourceHandle).toBe('bottom');
      expect(result.edges[0].targetHandle).toBe('top');
      expect(nodesByType(result, 'bpmnPool')).toHaveLength(2);
    });

    it('keeps nodes with an unknown poolId in a trailing flat band', () => {
      const result = converter.convertCompleteSystem({
        nodes: [
          { id: 'in', type: 'task', name: 'In Pool', poolId: 'p' },
          { id: 'out', type: 'task', name: 'Orphan', poolId: 'nope' },
        ],
        flows: [],
        pools: [{ id: 'p', name: 'Pool' }],
      });
      const tasks = nodesByType(result, 'bpmnTask');
      const inPool = tasks.find((t) => t.data.name === 'In Pool');
      const orphan = tasks.find((t) => t.data.name === 'Orphan');
      expect(inPool.parentId).toBe(nodesByType(result, 'bpmnPool')[0].id);
      expect(orphan.parentId).toBeUndefined();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// BPMNDiagramModifier
// ═══════════════════════════════════════════════════════════════════════════

describe('BPMNDiagramModifier', () => {
  const modifier = new BPMNDiagramModifier();

  function modelWithNodes(): BESSERModel {
    const m: any = makeEmptyBPMNModel();
    m.nodes.push(bpmnNode('task1', 'bpmnTask', 'Review', 0, { taskType: 'default', marker: 'none' }));
    m.nodes.push(bpmnNode('gw1', 'bpmnGateway', 'Branch', 200, { gatewayType: 'exclusive' }, { width: 40, height: 40 }));
    m.nodes.push(bpmnNode('evt1', 'bpmnStartEvent', 'Start', -100, { eventType: 'default' }, { width: 40, height: 40 }));
    return m;
  }

  it('canHandle accepts both the BPMN and the generic state-machine vocabularies', () => {
    for (const a of [
      'add_task', 'add_gateway', 'add_event', 'add_flow', 'modify_node', 'remove_flow', 'remove_element',
      'add_state', 'modify_state', 'add_transition', 'remove_transition',
    ]) {
      expect(modifier.canHandle(a)).toBe(true);
    }
    expect(modifier.canHandle('add_class')).toBe(false);
  });

  // ── add_flow ─────────────────────────────────────────────────────────────

  describe('add_flow', () => {
    it('creates a BPMNSequenceFlow edge between two nodes resolved by id', () => {
      const model = modelWithNodes();
      const mod: ModelModification = {
        action: 'add_flow',
        target: {},
        changes: { source: 'task1', target: 'gw1' },
      };
      const result: any = modifier.applyModification(model, mod);
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0]).toMatchObject({ type: 'BPMNSequenceFlow', source: 'task1', target: 'gw1' });
      expect(result.edges[0].data.isDefault).toBe(false);
    });

    it('creates a flow when source/target are given as display names', () => {
      const model = modelWithNodes();
      const mod: ModelModification = {
        action: 'add_flow',
        target: {},
        changes: { source: 'Review', target: 'Branch', label: 'ok' },
      };
      const result: any = modifier.applyModification(model, mod);
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0]).toMatchObject({ source: 'task1', target: 'gw1' });
      expect(result.edges[0].data).toMatchObject({ name: 'ok', label: 'ok' });
    });

    it('throws when a node cannot be resolved', () => {
      const model = modelWithNodes();
      const mod: ModelModification = {
        action: 'add_flow',
        target: {},
        changes: { source: 'NoSuchNode', target: 'gw1' },
      };
      expect(() => modifier.applyModification(model, mod)).toThrow();
    });

    it('accepts bpmnCallActivity as a flow source/target', () => {
      const model: any = makeEmptyBPMNModel();
      model.nodes.push(bpmnNode('ca1', 'bpmnCallActivity', 'OrderProcess', 200, { calledElement: '' }));
      model.nodes.push(bpmnNode('task1', 'bpmnTask', 'Confirm', 400, { taskType: 'default', marker: 'none' }));
      const mod: ModelModification = {
        action: 'add_flow',
        target: {},
        changes: { source: 'ca1', target: 'task1' },
      };
      const result: any = modifier.applyModification(model, mod);
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0]).toMatchObject({ source: 'ca1', target: 'task1', type: 'BPMNSequenceFlow' });
    });

    it('accepts bpmnSubprocess and bpmnTransaction as flow endpoints by id', () => {
      const model: any = makeEmptyBPMNModel();
      model.nodes.push(bpmnNode('sp1', 'bpmnSubprocess', 'InnerFlow', 0, { isExpanded: false }));
      model.nodes.push(bpmnNode('tx1', 'bpmnTransaction', 'Payment', 200, { isExpanded: false }));
      const result: any = modifier.applyModification(model, {
        action: 'add_flow',
        target: {},
        changes: { source: 'sp1', target: 'tx1' },
      });
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0]).toMatchObject({ source: 'sp1', target: 'tx1' });
    });

    it('add_transition is an alias of add_flow', () => {
      const model = modelWithNodes();
      const result: any = modifier.applyModification(model, {
        action: 'add_transition',
        target: {},
        changes: { source: 'Start', target: 'Review' },
      });
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0]).toMatchObject({ source: 'evt1', target: 'task1' });
    });
  });

  // ── resolveNode (id beats name) ───────────────────────────────────────────

  describe('resolveNode', () => {
    it('prefers a direct id match over a name match', () => {
      const model: any = modelWithNodes();
      // Add a task whose display name happens to be 'gw1' (same as the gateway's id).
      model.nodes.push(bpmnNode('other', 'bpmnTask', 'gw1', 400, { taskType: 'default', marker: 'none' }));
      const result: any = modifier.applyModification(model, {
        action: 'add_flow',
        target: {},
        changes: { source: 'task1', target: 'gw1' },
      });
      // 'gw1' is the id of the gateway, not the task named 'gw1'.
      expect(result.edges[0].target).toBe('gw1');
    });
  });

  // ── add_task / add_gateway / add_event ───────────────────────────────────

  describe('add_task / add_gateway', () => {
    it('add_task reuses the agent-proposed nodeId and places the node to the right', () => {
      const model = modelWithNodes();
      const result: any = modifier.applyModification(model, {
        action: 'add_task',
        target: { nodeId: 'approve', nodeName: 'Approve' },
        changes: { taskType: 'user' },
      });
      const task = result.nodes.find((n: any) => n.id === 'approve');
      expect(task).toMatchObject({ type: 'bpmnTask', data: { name: 'Approve', taskType: 'user', marker: 'none' } });
      // Right of the rightmost existing node (gw1 ends at x=240).
      expect(task.position.x).toBeGreaterThan(240);
    });

    it('add_task mints a fresh id when the proposed one is taken', () => {
      const model = modelWithNodes();
      const result: any = modifier.applyModification(model, {
        action: 'add_task',
        target: { nodeId: 'task1', nodeName: 'Duplicate' },
        changes: {},
      });
      expect(nodesByType(result, 'bpmnTask')).toHaveLength(2);
      expect(new Set(result.nodes.map((n: any) => n.id)).size).toBe(result.nodes.length);
    });

    it('add_gateway falls back to exclusive for unknown gateway types', () => {
      const result: any = modifier.applyModification(makeEmptyBPMNModel(), {
        action: 'add_gateway',
        target: { nodeName: 'Split' },
        changes: { gatewayType: 'bogus' },
      });
      const gw = nodesByType(result, 'bpmnGateway')[0];
      expect(gw.data.gatewayType).toBe('exclusive');
      expect(gw).toMatchObject({ width: 40, height: 40 });
    });
  });

  describe('add_event', () => {
    it('reads eventType from changes when provided', () => {
      const result: any = modifier.applyModification(makeEmptyBPMNModel(), {
        action: 'add_event',
        target: { nodeName: 'MsgStart' },
        changes: { eventKind: 'start', eventType: 'message' },
      });
      const events = nodesByType(result, 'bpmnStartEvent');
      expect(events).toHaveLength(1);
      expect(events[0].data.eventType).toBe('message');
    });

    it('defaults eventType to "default" when omitted', () => {
      const result: any = modifier.applyModification(makeEmptyBPMNModel(), {
        action: 'add_event',
        target: { nodeName: 'End' },
        changes: { eventKind: 'end' },
      });
      const events = nodesByType(result, 'bpmnEndEvent');
      expect(events[0].data.eventType).toBe('default');
    });

    it('generic add_state infers the node kind from stateType', () => {
      const result: any = modifier.applyModification(makeEmptyBPMNModel(), {
        action: 'add_state',
        target: { stateName: 'Wait' },
        changes: { stateType: 'intermediateEvent' },
      });
      expect(nodesByType(result, 'bpmnIntermediateEvent')).toHaveLength(1);
    });
  });

  // ── modify_node ───────────────────────────────────────────────────────────

  describe('modify_node', () => {
    it('updates eventType on an event node', () => {
      const model = modelWithNodes(); // evt1 has eventType 'default'
      const result: any = modifier.applyModification(model, {
        action: 'modify_node',
        target: { nodeId: 'evt1' },
        changes: { eventType: 'timer' },
      });
      expect(result.nodes.find((n: any) => n.id === 'evt1').data.eventType).toBe('timer');
    });

    it('does not set eventType on a gateway node', () => {
      const model = modelWithNodes();
      const result: any = modifier.applyModification(model, {
        action: 'modify_node',
        target: { nodeId: 'gw1' },
        changes: { eventType: 'message' },
      });
      expect(result.nodes.find((n: any) => n.id === 'gw1').data.eventType).toBeUndefined();
    });

    it('renames and retypes a task addressed by name', () => {
      const model = modelWithNodes();
      const result: any = modifier.applyModification(model, {
        action: 'modify_node',
        target: { nodeName: 'Review' },
        changes: { name: 'Approve', taskType: 'user' },
      });
      expect(result.nodes.find((n: any) => n.id === 'task1').data).toMatchObject({ name: 'Approve', taskType: 'user' });
    });
  });

  // ── remove_flow / remove_element ──────────────────────────────────────────

  describe('remove_flow / remove_element', () => {
    it('remove_flow deletes by flowId or by resolved endpoints', () => {
      let model: any = modifier.applyModification(modelWithNodes(), {
        action: 'add_flow',
        target: {},
        changes: { source: 'task1', target: 'gw1' },
      });
      model = modifier.applyModification(model, {
        action: 'add_flow',
        target: {},
        changes: { source: 'evt1', target: 'task1' },
      });
      expect(model.edges).toHaveLength(2);

      const byId = modifier.applyModification(model, {
        action: 'remove_flow',
        target: { flowId: model.edges[0].id },
        changes: {},
      }) as any;
      expect(byId.edges).toHaveLength(1);

      const byEndpoints = modifier.applyModification(model, {
        action: 'remove_flow',
        target: {},
        changes: { source: 'Start', target: 'Review' },
      }) as any;
      expect(byEndpoints.edges).toHaveLength(1);
      expect(byEndpoints.edges[0]).toMatchObject({ source: 'task1', target: 'gw1' });
    });

    it('remove_element drops the node and its incident flows', () => {
      const model: any = modifier.applyModification(modelWithNodes(), {
        action: 'add_flow',
        target: {},
        changes: { source: 'task1', target: 'gw1' },
      });
      const result: any = modifier.applyModification(model, {
        action: 'remove_element',
        target: { nodeName: 'Branch' },
        changes: {},
      });
      expect(nodesByType(result, 'bpmnGateway')).toHaveLength(0);
      expect(result.edges).toHaveLength(0);
    });

    it('remove_element throws for an unknown node', () => {
      expect(() =>
        modifier.applyModification(modelWithNodes(), {
          action: 'remove_element',
          target: { nodeName: 'Ghost' },
          changes: {},
        }),
      ).toThrow(/Ghost/);
    });
  });
});
