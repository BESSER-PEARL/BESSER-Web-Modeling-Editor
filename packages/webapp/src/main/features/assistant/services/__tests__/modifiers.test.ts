import { ClassDiagramModifier } from '../modifiers/ClassDiagramModifier';
import { StateMachineModifier } from '../modifiers/StateMachineModifier';
import { ObjectDiagramModifier } from '../modifiers/ObjectDiagramModifier';
import { AgentDiagramModifier } from '../modifiers/AgentDiagramModifier';
import type { ModelModification } from '../modifiers/base';
import type { BESSERModel } from '../UMLModelingService';

// ---------------------------------------------------------------------------
// Helpers (v4-native: models carry `nodes[]` / `edges[]` arrays)
// ---------------------------------------------------------------------------

function makeEmptyModel(type = 'ClassDiagram'): any {
  return {
    version: '4.0.0',
    id: '',
    title: '',
    type,
    nodes: [],
    edges: [],
    assessments: {},
  };
}

/** Return all nodes from a model whose `type` matches. */
function nodesByType(model: BESSERModel, type: string): any[] {
  return (((model as any).nodes ?? []) as any[]).filter((n: any) => n.type === type);
}

/** Build a minimal v4 class node. */
function classNode(id: string, name: string, extraData: Record<string, unknown> = {}): any {
  return {
    id,
    type: 'class',
    position: { x: 0, y: 0 },
    width: 220,
    height: 90,
    measured: { width: 220, height: 90 },
    data: { name, attributes: [], methods: [], ...extraData },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ClassDiagramModifier
// ═══════════════════════════════════════════════════════════════════════════════

describe('ClassDiagramModifier', () => {
  const modifier = new ClassDiagramModifier();

  // ── add_class ───────────────────────────────────────────────────────────

  describe('add_class', () => {
    it('creates a node with type "class"', () => {
      const model = makeEmptyModel();
      const mod: ModelModification = {
        action: 'add_class',
        target: { className: 'Person' },
        changes: { className: 'Person' },
      };

      const result = modifier.applyModification(model, mod);

      const classes = nodesByType(result, 'class');
      expect(classes).toHaveLength(1);
      expect(classes[0].data.name).toBe('Person');
      expect(classes[0].data.attributes).toEqual([]);
      expect(classes[0].data.methods).toEqual([]);
      expect(classes[0].data.stereotype).toBeUndefined();
    });

    it('stamps stereotype "abstract" when isAbstract is true', () => {
      const model = makeEmptyModel();
      const mod: ModelModification = {
        action: 'add_class',
        target: { className: 'Shape' },
        changes: { className: 'Shape', isAbstract: true } as any,
      };

      const result = modifier.applyModification(model, mod);

      const classes = nodesByType(result, 'class');
      expect(classes).toHaveLength(1);
      expect(classes[0].data.name).toBe('Shape');
      expect(classes[0].data.italic).toBe(true);
      expect(classes[0].data.stereotype).toBe('abstract');
    });

    it('stamps stereotype "enumeration" when isEnumeration is true', () => {
      const model = makeEmptyModel();
      const mod: ModelModification = {
        action: 'add_class',
        target: { className: 'Color' },
        changes: { className: 'Color', isEnumeration: true } as any,
      };

      const result = modifier.applyModification(model, mod);

      const classes = nodesByType(result, 'class');
      expect(classes).toHaveLength(1);
      expect(classes[0].data.name).toBe('Color');
      expect(classes[0].data.stereotype).toBe('enumeration');
    });
  });

  // ── add_attribute ───────────────────────────────────────────────────────

  describe('add_attribute', () => {
    function modelWithClass(): BESSERModel {
      const m = makeEmptyModel();
      m.nodes.push(classNode('cls1', 'Order'));
      return m;
    }

    it('adds an inline attribute row to the target class', () => {
      const model = modelWithClass();
      const mod: ModelModification = {
        action: 'add_attribute',
        target: { className: 'Order' },
        changes: { name: 'total', type: 'float' },
      };

      const result = modifier.applyModification(model, mod);

      const [order] = nodesByType(result, 'class');
      expect(order.data.attributes).toHaveLength(1);
      expect(order.data.attributes[0].name).toBe('total');
      expect(order.data.attributes[0].attributeType).toBe('float');
    });

    it('sets isDerived when specified', () => {
      const model = modelWithClass();
      const mod: ModelModification = {
        action: 'add_attribute',
        target: { className: 'Order' },
        changes: { name: 'totalCost', type: 'float', isDerived: true } as any,
      };

      const result = modifier.applyModification(model, mod);

      const [order] = nodesByType(result, 'class');
      expect(order.data.attributes).toHaveLength(1);
      expect(order.data.attributes[0].isDerived).toBe(true);
    });

    it('sets defaultValue when specified', () => {
      const model = modelWithClass();
      const mod: ModelModification = {
        action: 'add_attribute',
        target: { className: 'Order' },
        changes: { name: 'status', type: 'str', defaultValue: 'pending' } as any,
      };

      const result = modifier.applyModification(model, mod);

      const [order] = nodesByType(result, 'class');
      expect(order.data.attributes).toHaveLength(1);
      expect(order.data.attributes[0].defaultValue).toBe('pending');
    });
  });

  // ── add_method ──────────────────────────────────────────────────────────

  describe('add_method', () => {
    function modelWithClass(): BESSERModel {
      const m = makeEmptyModel();
      m.nodes.push(classNode('cls1', 'Service'));
      return m;
    }

    it('adds an inline method row to the target class', () => {
      const model = modelWithClass();
      const mod: ModelModification = {
        action: 'add_method',
        target: { className: 'Service' },
        changes: { name: 'execute', returnType: 'bool' },
      };

      const result = modifier.applyModification(model, mod);

      const [service] = nodesByType(result, 'class');
      expect(service.data.methods).toHaveLength(1);
      expect(service.data.methods[0].name).toContain('execute');
      expect(service.data.methods[0].attributeType).toBe('bool');
    });

    it('sets code and implementationType when code is provided', () => {
      const model = modelWithClass();
      const mod: ModelModification = {
        action: 'add_method',
        target: { className: 'Service' },
        changes: { name: 'run', returnType: 'any', code: 'print("hello")' },
      };

      const result = modifier.applyModification(model, mod);

      const [service] = nodesByType(result, 'class');
      expect(service.data.methods).toHaveLength(1);
      expect(service.data.methods[0].code).toBe('print("hello")');
      expect(service.data.methods[0].implementationType).toBe('code');
    });

    it('respects explicit implementationType over default', () => {
      const model = modelWithClass();
      const mod: ModelModification = {
        action: 'add_method',
        target: { className: 'Service' },
        changes: { name: 'run', returnType: 'any', code: 'x=1', implementationType: 'action' },
      };

      const result = modifier.applyModification(model, mod);

      const [service] = nodesByType(result, 'class');
      expect(service.data.methods[0].implementationType).toBe('action');
    });
  });

  // ── findClassNode (via add_attribute targeting stereotyped classifiers) ──

  describe('findClassNode resolves stereotyped classifiers by name', () => {
    it('resolves abstract classes by name', () => {
      const model = makeEmptyModel();
      model.nodes.push(classNode('abc1', 'Vehicle', { stereotype: 'abstract', italic: true }));

      const mod: ModelModification = {
        action: 'add_attribute',
        target: { className: 'Vehicle' },
        changes: { name: 'speed', type: 'int' },
      };

      const result = modifier.applyModification(model, mod);

      const vehicle = nodesByType(result, 'class').find((n) => n.id === 'abc1');
      expect(vehicle.data.attributes).toHaveLength(1);
      expect(vehicle.data.attributes[0].name).toBe('speed');
    });

    it('resolves enumerations by name', () => {
      const model = makeEmptyModel();
      model.nodes.push(classNode('enum1', 'Status', { stereotype: 'enumeration' }));

      const mod: ModelModification = {
        action: 'add_attribute',
        target: { className: 'Status' },
        changes: { name: 'ACTIVE', type: 'str' },
      };

      const result = modifier.applyModification(model, mod);

      const status = nodesByType(result, 'class').find((n) => n.id === 'enum1');
      expect(status.data.attributes).toHaveLength(1);
      expect(status.data.attributes[0].name).toBe('ACTIVE');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// StateMachineModifier
// ═══════════════════════════════════════════════════════════════════════════════

describe('StateMachineModifier', () => {
  const modifier = new StateMachineModifier();

  describe('add_state', () => {
    it('creates a State node with inline bodies arrays', () => {
      const model = makeEmptyModel('StateMachineDiagram');
      const mod: ModelModification = {
        action: 'add_state',
        target: { stateName: 'Idle' },
        changes: { name: 'Idle' },
      };

      const result = modifier.applyModification(model, mod);

      const states = nodesByType(result, 'State');
      expect(states).toHaveLength(1);
      expect(states[0].data.name).toBe('Idle');
      expect(states[0].data.bodies).toBeDefined();
      expect(states[0].data.fallbackBodies).toBeDefined();
    });

    it('creates a StateInitialNode when stateType is "initial"', () => {
      const model = makeEmptyModel('StateMachineDiagram');
      const mod: ModelModification = {
        action: 'add_state',
        target: {},
        changes: { stateType: 'initial' },
      };

      const result = modifier.applyModification(model, mod);

      const initials = nodesByType(result, 'StateInitialNode');
      expect(initials).toHaveLength(1);
    });

    it('creates a StateFinalNode when stateType is "final"', () => {
      const model = makeEmptyModel('StateMachineDiagram');
      const mod: ModelModification = {
        action: 'add_state',
        target: {},
        changes: { stateType: 'final' },
      };

      const result = modifier.applyModification(model, mod);

      const finals = nodesByType(result, 'StateFinalNode');
      expect(finals).toHaveLength(1);
    });

    it('collapses entry/do/exit actions onto inline body rows', () => {
      const model = makeEmptyModel('StateMachineDiagram');
      const mod: ModelModification = {
        action: 'add_state',
        target: { stateName: 'Processing' },
        changes: {
          name: 'Processing',
          entryAction: 'logStart()',
          doActivity: 'process()',
          exitAction: 'logEnd()',
        },
      };

      const result = modifier.applyModification(model, mod);

      // Bodies live inline on the parent State — never as separate nodes.
      expect(nodesByType(result, 'StateBody')).toHaveLength(0);

      const [state] = nodesByType(result, 'State');
      expect(state.data.bodies.map((b: any) => b.name)).toEqual([
        'entry / logStart()',
        'do / process()',
        'exit / logEnd()',
      ]);
    });
  });

  describe('add_code_block', () => {
    it('creates a StateCodeBlock node with code and language', () => {
      const model = makeEmptyModel('StateMachineDiagram');
      const mod: ModelModification = {
        action: 'add_code_block',
        target: { stateName: 'MyBlock' },
        changes: { name: 'MyBlock', code: 'x = 1', language: 'python' },
      };

      const result = modifier.applyModification(model, mod);

      const blocks = nodesByType(result, 'StateCodeBlock');
      expect(blocks).toHaveLength(1);
      expect(blocks[0].data.code).toBe('x = 1');
      expect(blocks[0].data.language).toBe('python');
      expect(blocks[0].data.name).toBe('MyBlock');
    });
  });

  describe('add_transition', () => {
    it('finds StateInitialNode as source', () => {
      const model = makeEmptyModel('StateMachineDiagram');
      model.nodes.push({
        id: 'init1',
        type: 'StateInitialNode',
        position: { x: 0, y: 0 },
        width: 45,
        height: 45,
        measured: { width: 45, height: 45 },
        data: { name: '' },
      });
      model.nodes.push({
        id: 's1',
        type: 'State',
        position: { x: 100, y: 0 },
        width: 160,
        height: 100,
        measured: { width: 160, height: 100 },
        data: { name: 'Running', bodies: [], fallbackBodies: [] },
      });

      const mod: ModelModification = {
        action: 'add_transition',
        target: {},
        changes: { source: '', target: 'Running' },
      };

      const result = modifier.applyModification(model, mod);

      const edges: any[] = (result as any).edges ?? [];
      expect(edges).toHaveLength(1);
      expect(edges[0].type).toBe('StateTransition');
      expect(edges[0].source).toBe('init1');
      expect(edges[0].target).toBe('s1');
      // Handle ids must use the lowercase v4 HandleId values.
      expect(edges[0].sourceHandle).toBe('right');
      expect(edges[0].targetHandle).toBe('left');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ObjectDiagramModifier
// ═══════════════════════════════════════════════════════════════════════════════

describe('ObjectDiagramModifier', () => {
  const modifier = new ObjectDiagramModifier();

  describe('add_object', () => {
    it('creates an objectName node with inline attribute rows', () => {
      const model = makeEmptyModel('ObjectDiagram');
      const mod: ModelModification = {
        action: 'add_object',
        target: { objectName: 'order1' },
        changes: {
          objectName: 'order1',
          className: 'Order',
          attributes: [
            { name: 'id', value: '42' },
            { name: 'total', value: '99.9' },
          ],
        },
      };

      const result = modifier.applyModification(model, mod);

      const objects = nodesByType(result, 'objectName');
      expect(objects).toHaveLength(1);
      expect(objects[0].data.name).toBe('order1: Order');

      const attrs = objects[0].data.attributes;
      expect(attrs).toHaveLength(2);
      expect(attrs[0].name).toBe('id = 42');
      expect(attrs[0].value).toBe('42');
      expect(attrs[1].name).toBe('total = 99.9');
      expect(attrs[1].value).toBe('99.9');
    });

    it('creates an objectName node with empty attributes when none provided', () => {
      const model = makeEmptyModel('ObjectDiagram');
      const mod: ModelModification = {
        action: 'add_object',
        target: { objectName: 'empty1' },
        changes: { objectName: 'empty1', className: 'Foo' },
      };

      const result = modifier.applyModification(model, mod);

      const objects = nodesByType(result, 'objectName');
      expect(objects).toHaveLength(1);
      expect(objects[0].data.name).toBe('empty1: Foo');
      expect(objects[0].data.attributes).toEqual([]);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AgentDiagramModifier
// ═══════════════════════════════════════════════════════════════════════════════

describe('AgentDiagramModifier', () => {
  const modifier = new AgentDiagramModifier();

  describe('add_state', () => {
    it('creates an AgentState with inline body rows', () => {
      const model = makeEmptyModel('AgentDiagram');
      const mod: ModelModification = {
        action: 'add_state',
        target: { stateName: 'Greeting' },
        changes: {
          name: 'Greeting',
          replies: [
            { text: 'Hello!', replyType: 'text' },
            { text: 'How can I help?', replyType: 'text' },
          ],
        },
      };

      const result = modifier.applyModification(model, mod);

      const states = nodesByType(result, 'AgentState');
      expect(states).toHaveLength(1);
      expect(states[0].data.name).toBe('Greeting');

      // Bodies live inline on the parent AgentState — never as separate nodes.
      expect(nodesByType(result, 'AgentStateBody')).toHaveLength(0);
      const bodies = states[0].data.bodies;
      expect(bodies).toHaveLength(2);
      expect(bodies[0].name).toBe('Hello!');
      expect(bodies[0].replyType).toBe('text');
      expect(bodies[1].name).toBe('How can I help?');
    });
  });

  describe('add_intent', () => {
    it('creates an AgentIntent with inline training_phrases rows', () => {
      const model = makeEmptyModel('AgentDiagram');
      const mod: ModelModification = {
        action: 'add_intent',
        target: { intentName: 'BookFlight' },
        changes: {
          name: 'BookFlight',
          trainingPhrases: ['I want to book a flight', 'Book me a ticket'],
        },
      };

      const result = modifier.applyModification(model, mod);

      const intents = nodesByType(result, 'AgentIntent');
      expect(intents).toHaveLength(1);
      expect(intents[0].data.name).toBe('BookFlight');

      // Training phrases live on `data.training_phrases` (rendered inline
      // by AgentIntent.tsx) — never as separate nodes.
      expect(nodesByType(result, 'AgentIntentBody')).toHaveLength(0);
      const phrases = intents[0].data.training_phrases;
      expect(phrases).toHaveLength(2);
      expect(phrases[0].name).toBe('I want to book a flight');
      expect(phrases[1].name).toBe('Book me a ticket');
    });
  });

  describe('add_rag_element', () => {
    it('creates an AgentRagElement', () => {
      const model = makeEmptyModel('AgentDiagram');
      const mod: ModelModification = {
        action: 'add_rag_element',
        target: { name: 'KnowledgeBase' },
        changes: { name: 'KnowledgeBase' },
      };

      const result = modifier.applyModification(model, mod);

      const rags = nodesByType(result, 'AgentRagElement');
      expect(rags).toHaveLength(1);
      expect(rags[0].data.name).toBe('KnowledgeBase');
    });
  });
});
