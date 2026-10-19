import { BPMNDiagramConverter } from '../converters/BPMNDiagramConverter';
import { BPMNDiagramModifier } from '../modifiers/BPMNDiagramModifier';
import type { ModelModification } from '../modifiers/base';
import type { BESSERModel } from '../UMLModelingService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEmptyBPMNModel(): BESSERModel {
  return {
    version: '3.0.0',
    type: 'BPMNDiagram',
    size: { width: 800, height: 600 },
    elements: {},
    relationships: {},
    interactive: { elements: {}, relationships: {} },
    assessments: {},
  };
}

function elementsByType(model: BESSERModel, type: string) {
  return Object.values(model.elements).filter((el: any) => el.type === type);
}

// ═══════════════════════════════════════════════════════════════════════════
// BPMNDiagramConverter
// ═══════════════════════════════════════════════════════════════════════════

describe('BPMNDiagramConverter', () => {
  const converter = new BPMNDiagramConverter();

  describe('convertCompleteSystem', () => {
    it('creates elements for each node with correct Apollon types', () => {
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

      expect(elementsByType(result, 'BPMNStartEvent')).toHaveLength(1);
      expect(elementsByType(result, 'BPMNTask')).toHaveLength(1);
      expect(elementsByType(result, 'BPMNGateway')).toHaveLength(1);
      expect(elementsByType(result, 'BPMNEndEvent')).toHaveLength(1);
      expect(Object.values(result.relationships)).toHaveLength(3);
    });

    it('sets taskType on BPMNTask and falls back to "default" for unknown types', () => {
      const result = converter.convertCompleteSystem({
        nodes: [
          { id: 't1', type: 'task', name: 'ValidTask', taskType: 'service' },
          { id: 't2', type: 'task', name: 'BadTask', taskType: 'invalid' },
        ],
        flows: [],
      });
      const tasks = elementsByType(result, 'BPMNTask') as any[];
      const valid = tasks.find((t) => t.name === 'ValidTask');
      const bad = tasks.find((t) => t.name === 'BadTask');
      expect(valid?.taskType).toBe('service');
      expect(bad?.taskType).toBe('default');
    });

    it('passes through eventType on event nodes', () => {
      const result = converter.convertCompleteSystem({
        nodes: [{ id: 'e0', type: 'startEvent', name: 'MsgStart', eventType: 'message' }],
        flows: [],
      });
      const events = elementsByType(result, 'BPMNStartEvent') as any[];
      expect(events[0]?.eventType).toBe('message');
    });

    it('centers content around the origin', () => {
      const result = converter.convertCompleteSystem({
        nodes: [
          { id: 'a', type: 'task', name: 'A' },
          { id: 'b', type: 'task', name: 'B' },
        ],
        flows: [{ source: 'a', target: 'b' }],
      });
      const elements = Object.values(result.elements) as any[];
      const minX = Math.min(...elements.map((e) => e.bounds.x));
      const maxX = Math.max(...elements.map((e) => e.bounds.x + e.bounds.width));
      const minY = Math.min(...elements.map((e) => e.bounds.y));
      const maxY = Math.max(...elements.map((e) => e.bounds.y + e.bounds.height));
      expect(Math.round((minX + maxX) / 2)).toBe(0);
      expect(Math.round((minY + maxY) / 2)).toBe(0);
    });

    it('emits model.type "BPMNDiagram"', () => {
      const result = converter.convertCompleteSystem({ nodes: [], flows: [] });
      expect(result.type).toBe('BPMNDiagram');
    });

    it('ignores flows that reference unknown node ids', () => {
      const result = converter.convertCompleteSystem({
        nodes: [{ id: 'x', type: 'task', name: 'X' }],
        flows: [{ source: 'x', target: 'missing' }],
      });
      expect(Object.values(result.relationships)).toHaveLength(0);
    });

    it('convertSingleElement wraps spec in a one-node process', () => {
      const result = converter.convertSingleElement({ type: 'task', name: 'Solo' });
      expect(elementsByType(result, 'BPMNTask')).toHaveLength(1);
    });

    it('emits pools, swimlanes, and lane-owned nodes for pooled specs', () => {
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

      const pools = elementsByType(result, 'BPMNPool') as any[];
      const lanes = elementsByType(result, 'BPMNSwimlane') as any[];
      const start = elementsByType(result, 'BPMNStartEvent')[0] as any;
      const task = elementsByType(result, 'BPMNTask')[0] as any;
      const clerkLane = lanes.find((lane) => lane.name === 'Clerk');
      const chefLane = lanes.find((lane) => lane.name === 'Chef');
      const emptyLane = lanes.find((lane) => lane.name === 'Delivery Driver');

      expect(pools).toHaveLength(1);
      expect(lanes).toHaveLength(3);
      expect(clerkLane?.owner).toBe(pools[0].id);
      expect(chefLane?.owner).toBe(pools[0].id);
      expect(emptyLane).toBeDefined();
      expect(start.owner).toBe(clerkLane?.id);
      expect(task.owner).toBe(chefLane?.id);
      expect(start.owner).not.toBe('clerk');
      expect(task.owner).not.toBe('chef');
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

      const flows = Object.values(result.relationships) as any[];
      expect(flows).toHaveLength(1);
      expect(flows[0].flowType).toBe('message');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// BPMNDiagramModifier
// ═══════════════════════════════════════════════════════════════════════════

describe('BPMNDiagramModifier', () => {
  const modifier = new BPMNDiagramModifier();

  function modelWithNodes(): BESSERModel {
    const m = makeEmptyBPMNModel();
    m.elements['task1'] = {
      id: 'task1',
      type: 'BPMNTask',
      name: 'Review',
      owner: null,
      bounds: { x: 0, y: 0, width: 140, height: 60 },
      taskType: 'default',
      marker: 'none',
    };
    m.elements['gw1'] = {
      id: 'gw1',
      type: 'BPMNGateway',
      name: 'Branch',
      owner: null,
      bounds: { x: 200, y: 0, width: 40, height: 40 },
      gatewayType: 'exclusive',
    };
    m.elements['evt1'] = {
      id: 'evt1',
      type: 'BPMNStartEvent',
      name: 'Start',
      owner: null,
      bounds: { x: -100, y: 0, width: 40, height: 40 },
      eventType: 'default',
    };
    return m;
  }

  // ── add_flow ─────────────────────────────────────────────────────────────

  describe('add_flow', () => {
    it('creates a BPMNFlow relationship between two nodes resolved by id', () => {
      const model = modelWithNodes();
      const mod: ModelModification = {
        action: 'add_flow',
        target: {},
        changes: { source: 'task1', target: 'gw1' },
      };
      const result = modifier.applyModification(model, mod);
      const flows = Object.values(result.relationships) as any[];
      expect(flows).toHaveLength(1);
      expect(flows[0].type).toBe('BPMNFlow');
      expect(flows[0].source.element).toBe('task1');
      expect(flows[0].target.element).toBe('gw1');
      expect(flows[0].flowType).toBe('sequence');
    });

    it('creates a BPMNFlow when source/target are given as display names', () => {
      const model = modelWithNodes();
      const mod: ModelModification = {
        action: 'add_flow',
        target: {},
        changes: { source: 'Review', target: 'Branch' },
      };
      const result = modifier.applyModification(model, mod);
      const flows = Object.values(result.relationships) as any[];
      expect(flows).toHaveLength(1);
      expect(flows[0].source.element).toBe('task1');
      expect(flows[0].target.element).toBe('gw1');
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

    it('accepts BPMNCallActivity as a flow source/target', () => {
      const model = makeEmptyBPMNModel();
      model.elements['ca1'] = {
        id: 'ca1',
        type: 'BPMNCallActivity',
        name: 'OrderProcess',
        owner: null,
        bounds: { x: 200, y: 0, width: 140, height: 60 },
      } as any;
      model.elements['task1'] = {
        id: 'task1',
        type: 'BPMNTask',
        name: 'Confirm',
        owner: null,
        bounds: { x: 400, y: 0, width: 140, height: 60 },
        taskType: 'default',
        marker: 'none',
      };
      const mod: ModelModification = {
        action: 'add_flow',
        target: {},
        changes: { source: 'ca1', target: 'task1' },
      };
      const result = modifier.applyModification(model, mod);
      const flows = Object.values(result.relationships) as any[];
      expect(flows).toHaveLength(1);
      expect(flows[0].source.element).toBe('ca1');
      expect(flows[0].target.element).toBe('task1');
    });

    it('accepts BPMNSubprocess as a flow endpoint by id', () => {
      const model = makeEmptyBPMNModel();
      model.elements['sp1'] = {
        id: 'sp1',
        type: 'BPMNSubprocess',
        name: 'InnerFlow',
        owner: null,
        bounds: { x: 0, y: 0, width: 140, height: 80 },
      } as any;
      model.elements['task2'] = {
        id: 'task2',
        type: 'BPMNTask',
        name: 'Next',
        owner: null,
        bounds: { x: 200, y: 0, width: 140, height: 60 },
        taskType: 'default',
        marker: 'none',
      };
      const mod: ModelModification = {
        action: 'add_flow',
        target: {},
        changes: { source: 'sp1', target: 'task2' },
      };
      const result = modifier.applyModification(model, mod);
      const flows = Object.values(result.relationships) as any[];
      expect(flows).toHaveLength(1);
      expect(flows[0].source.element).toBe('sp1');
    });
  });

  // ── resolveNode (id beats name) ───────────────────────────────────────────

  describe('resolveNode', () => {
    it('prefers a direct id match over a name match', () => {
      const model = modelWithNodes();
      // Add a task whose display name happens to be 'gw1' (same as the gateway's id).
      model.elements['other'] = {
        id: 'other',
        type: 'BPMNTask',
        name: 'gw1',
        owner: null,
        bounds: { x: 400, y: 0, width: 140, height: 60 },
        taskType: 'default',
        marker: 'none',
      };
      const mod: ModelModification = {
        action: 'add_flow',
        target: {},
        changes: { source: 'task1', target: 'gw1' },
      };
      const result = modifier.applyModification(model, mod);
      const flow = Object.values(result.relationships)[0] as any;
      // 'gw1' is the id of the BPMNGateway, not the task named 'gw1'.
      expect(flow.target.element).toBe('gw1');
    });
  });

  // ── add_event eventType ───────────────────────────────────────────────────

  describe('add_event', () => {
    it('reads eventType from changes when provided', () => {
      const model = makeEmptyBPMNModel();
      const mod: ModelModification = {
        action: 'add_event',
        target: { nodeName: 'MsgStart' },
        changes: { eventKind: 'start', eventType: 'message' },
      };
      const result = modifier.applyModification(model, mod);
      const events = elementsByType(result, 'BPMNStartEvent') as any[];
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('message');
    });

    it('defaults eventType to "default" when omitted', () => {
      const model = makeEmptyBPMNModel();
      const mod: ModelModification = {
        action: 'add_event',
        target: { nodeName: 'End' },
        changes: { eventKind: 'end' },
      };
      const result = modifier.applyModification(model, mod);
      const events = elementsByType(result, 'BPMNEndEvent') as any[];
      expect(events[0].eventType).toBe('default');
    });
  });

  // ── modify_node eventType ─────────────────────────────────────────────────

  describe('modify_node', () => {
    it('updates eventType on an event node', () => {
      const model = modelWithNodes(); // evt1 has eventType 'default'
      const mod: ModelModification = {
        action: 'modify_node',
        target: { nodeId: 'evt1' },
        changes: { eventType: 'timer' },
      };
      const result = modifier.applyModification(model, mod);
      expect((result.elements['evt1'] as any).eventType).toBe('timer');
    });

    it('does not set eventType on a gateway node', () => {
      const model = modelWithNodes();
      const mod: ModelModification = {
        action: 'modify_node',
        target: { nodeId: 'gw1' },
        changes: { eventType: 'message' },
      };
      const result = modifier.applyModification(model, mod);
      expect((result.elements['gw1'] as any).eventType).toBeUndefined();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Data objects (BESSER-PEARL/BESSER#627): inputs a task uses / outputs it
// produces used to be dropped because neither the spec nor the modifier had a
// way to carry them.
// ═══════════════════════════════════════════════════════════════════════════

describe('BPMN data objects', () => {
  const converter = new BPMNDiagramConverter();
  const modifier = new BPMNDiagramModifier();

  const battery = {
    nodes: [
      { id: 'start', type: 'startEvent', name: 'Cell production started' },
      { id: 'mixing', type: 'task', name: 'Mixing' },
      { id: 'coating', type: 'task', name: 'Coating' },
      { id: 'end', type: 'endEvent', name: 'Cell ready' },
    ],
    flows: [
      { source: 'start', target: 'mixing' },
      { source: 'mixing', target: 'coating' },
      { source: 'coating', target: 'end' },
    ],
    dataObjects: [
      { id: 'binder', name: 'Binder' },
      { id: 'solvent', name: 'Solvent' },
      { id: 'slurry', name: 'Slurry' },
      { id: 'notes', name: 'Process Notes' },
    ],
    dataAssociations: [
      { dataObject: 'binder', node: 'mixing', direction: 'input' },
      { dataObject: 'solvent', node: 'mixing', direction: 'input' },
      { dataObject: 'slurry', node: 'mixing', direction: 'output' },
      { dataObject: 'slurry', node: 'coating', direction: 'input' },
    ],
  };

  function byName(model: BESSERModel, name: string): any {
    return Object.values(model.elements).find((el: any) => el.name === name);
  }

  it('emits a BPMNDataObject per data object, including unlinked ones', () => {
    const result = converter.convertCompleteSystem(battery);
    const dataObjects = elementsByType(result, 'BPMNDataObject') as any[];
    expect(dataObjects.map((d) => d.name).sort()).toEqual(['Binder', 'Process Notes', 'Slurry', 'Solvent']);
    expect(dataObjects[0].bounds.width).toBe(40);
    expect(dataObjects[0].bounds.height).toBe(60);
  });

  it('links them with data associations in the right direction', () => {
    const result = converter.convertCompleteSystem(battery);
    const flows = Object.values(result.relationships) as any[];
    const data = flows.filter((f) => f.flowType === 'data association');
    expect(flows.filter((f) => f.flowType === 'sequence')).toHaveLength(3);
    expect(data).toHaveLength(4);

    const mixing = byName(result, 'Mixing').id;
    const binder = byName(result, 'Binder').id;
    const slurry = byName(result, 'Slurry').id;
    const pairs = data.map((f) => [f.source.element, f.target.element]);
    expect(pairs).toContainEqual([binder, mixing]); // input: data object -> task
    expect(pairs).toContainEqual([mixing, slurry]); // output: task -> data object
  });

  it('puts a task\'s data objects side by side in a row centered under it', () => {
    const result = converter.convertCompleteSystem(battery);
    const mixing = byName(result, 'Mixing').bounds;
    const row = ['Binder', 'Solvent', 'Slurry'].map((n) => byName(result, n).bounds);
    expect(new Set(row.map((b) => b.y)).size).toBe(1);
    expect(row[0].y).toBeGreaterThanOrEqual(mixing.y + mixing.height);
    const left = Math.min(...row.map((b) => b.x));
    const right = Math.max(...row.map((b) => b.x + b.width));
    expect((left + right) / 2).toBeCloseTo(mixing.x + mixing.width / 2);
    // Labels (twice the shape width, centered) of neighbours must not overlap.
    const xs = row.map((b) => b.x).sort((a, b) => a - b);
    expect(xs[1] - xs[0]).toBeGreaterThanOrEqual(80);
    // The next task still sits to the right, clear of the row.
    expect(byName(result, 'Coating').bounds.x).toBeGreaterThan(right);
  });

  it('staggers a second row so its associations pass between the first row', () => {
    const result = converter.convertCompleteSystem({
      nodes: [{ id: 'mixing', type: 'task', name: 'Mixing' }],
      flows: [],
      dataObjects: ['A', 'B', 'C', 'D'].map((n) => ({ id: n, name: n })),
      dataAssociations: ['A', 'B', 'C', 'D'].map((n) => ({ dataObject: n, node: 'mixing', direction: 'input' })),
    });
    const first = ['A', 'B', 'C'].map((n) => byName(result, n).bounds);
    const d = byName(result, 'D').bounds;
    expect(d.y).toBeGreaterThan(first[0].y);
    const centre = d.x + d.width / 2;
    expect(first.every((b) => centre < b.x || centre > b.x + b.width)).toBe(true);
  });

  it('leaves the layout of a process without data objects unchanged', () => {
    const result = converter.convertCompleteSystem({ nodes: battery.nodes, flows: battery.flows });
    expect(byName(result, 'Coating').bounds.x - byName(result, 'Mixing').bounds.x).toBe(220);
  });

  it('places a data object in the lane of its task', () => {
    const result = converter.convertCompleteSystem({
      nodes: [
        { id: 'take', type: 'task', name: 'Take Order', poolId: 'shop', laneId: 'clerk' },
        { id: 'bake', type: 'task', name: 'Bake Pizza', poolId: 'shop', laneId: 'chef' },
      ],
      flows: [{ source: 'take', target: 'bake' }],
      pools: [{ id: 'shop', name: 'Shop', lanes: [{ id: 'clerk', name: 'Clerk' }, { id: 'chef', name: 'Chef' }] }],
      dataObjects: [{ id: 'recipe', name: 'Recipe' }],
      dataAssociations: [{ dataObject: 'recipe', node: 'bake', direction: 'input' }],
    });
    const chef = byName(result, 'Chef');
    const recipe = byName(result, 'Recipe');
    expect(recipe.bounds.y).toBeGreaterThanOrEqual(chef.bounds.y);
    expect(recipe.bounds.y + recipe.bounds.height).toBeLessThanOrEqual(chef.bounds.y + chef.bounds.height);
    const flow = (Object.values(result.relationships) as any[]).find((f) => f.source.element === recipe.id);
    expect(flow.flowType).toBe('data association');
  });

  it('add_data_object creates a data object that add_flow links as a data association', () => {
    let model = makeEmptyBPMNModel();
    model.elements['task1'] = {
      id: 'task1',
      type: 'BPMNTask',
      name: 'Mixing',
      owner: null,
      bounds: { x: 0, y: 0, width: 140, height: 60 },
      taskType: 'default',
      marker: 'none',
    };
    model = modifier.applyModification(model, { action: 'add_data_object', target: { nodeName: 'Binder' }, changes: {} });
    model = modifier.applyModification(model, {
      action: 'add_flow',
      target: {},
      changes: { source: 'Binder', target: 'task1' },
    });
    model = modifier.applyModification(model, { action: 'add_data_object', target: { nodeName: 'Slurry' }, changes: {} });
    model = modifier.applyModification(model, {
      action: 'add_flow',
      target: {},
      changes: { source: 'Mixing', target: 'Slurry' },
    });

    const binder = byName(model, 'Binder');
    expect(binder.type).toBe('BPMNDataObject');
    const flows = Object.values(model.relationships) as any[];
    expect(flows).toHaveLength(2);
    expect(flows.every((f) => f.flowType === 'data association')).toBe(true);
    expect(flows[0].source.element).toBe(binder.id);
    expect(flows[1].target.element).toBe(byName(model, 'Slurry').id);
  });

  it('canHandle add_data_object', () => {
    expect(modifier.canHandle('add_data_object')).toBe(true);
  });
});
