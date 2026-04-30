import { ClassDiagramModifier } from '../modifiers/ClassDiagramModifier';
import { StateMachineModifier } from '../modifiers/StateMachineModifier';
import { ObjectDiagramModifier } from '../modifiers/ObjectDiagramModifier';
import { AgentDiagramModifier } from '../modifiers/AgentDiagramModifier';
import type { ModelModification } from '../modifiers/base';
import type { BESSERModel } from '../UMLModelingService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEmptyModel(type = 'ClassDiagram'): BESSERModel {
  return {
    version: '3.0.0',
    type,
    size: { width: 1000, height: 800 },
    elements: {},
    relationships: {},
    interactive: { elements: {}, relationships: {} },
    assessments: {},
  };
}

/** Return all element values from a model whose `type` matches. */
function elementsByType(model: BESSERModel, type: string) {
  return Object.values(model.elements).filter((el: any) => el.type === type);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ClassDiagramModifier
// ═══════════════════════════════════════════════════════════════════════════════

describe('ClassDiagramModifier', () => {
  const modifier = new ClassDiagramModifier();

  // ── add_class ───────────────────────────────────────────────────────────

  describe('add_class', () => {
    it('creates an element with type "Class"', () => {
      const model = makeEmptyModel();
      const mod: ModelModification = {
        action: 'add_class',
        target: { className: 'Person' },
        changes: { className: 'Person' },
      };

      const result = modifier.applyModification(model, mod);

      const classes = elementsByType(result, 'Class');
      expect(classes).toHaveLength(1);
      expect(classes[0].name).toBe('Person');
      expect(classes[0].attributes).toEqual([]);
      expect(classes[0].methods).toEqual([]);
    });

    it('creates an "AbstractClass" when isAbstract is true', () => {
      const model = makeEmptyModel();
      const mod: ModelModification = {
        action: 'add_class',
        target: { className: 'Shape' },
        changes: { className: 'Shape', isAbstract: true } as any,
      };

      const result = modifier.applyModification(model, mod);

      const abstracts = elementsByType(result, 'AbstractClass');
      expect(abstracts).toHaveLength(1);
      expect(abstracts[0].name).toBe('Shape');
      expect(abstracts[0].italic).toBe(true);
      expect(abstracts[0].stereotype).toBe('abstract');
    });

    it('creates an "Enumeration" when isEnumeration is true', () => {
      const model = makeEmptyModel();
      const mod: ModelModification = {
        action: 'add_class',
        target: { className: 'Color' },
        changes: { className: 'Color', isEnumeration: true } as any,
      };

      const result = modifier.applyModification(model, mod);

      const enums = elementsByType(result, 'Enumeration');
      expect(enums).toHaveLength(1);
      expect(enums[0].name).toBe('Color');
      expect(enums[0].stereotype).toBe('enumeration');
    });
  });

  // ── add_attribute ───────────────────────────────────────────────────────

  describe('add_attribute', () => {
    function modelWithClass(): BESSERModel {
      const m = makeEmptyModel();
      m.elements['cls1'] = {
        id: 'cls1',
        name: 'Order',
        type: 'Class',
        owner: null,
        bounds: { x: 0, y: 0, width: 220, height: 90 },
        attributes: [],
        methods: [],
      };
      return m;
    }

    it('adds a ClassAttribute to the target class', () => {
      const model = modelWithClass();
      const mod: ModelModification = {
        action: 'add_attribute',
        target: { className: 'Order' },
        changes: { name: 'total', type: 'float' },
      };

      const result = modifier.applyModification(model, mod);

      const attrs = elementsByType(result, 'ClassAttribute');
      expect(attrs).toHaveLength(1);
      expect(attrs[0].owner).toBe('cls1');
      expect(attrs[0].attributeType).toBe('float');
    });

    it('sets isDerived when specified', () => {
      const model = modelWithClass();
      const mod: ModelModification = {
        action: 'add_attribute',
        target: { className: 'Order' },
        changes: { name: 'totalCost', type: 'float', isDerived: true } as any,
      };

      const result = modifier.applyModification(model, mod);

      const attrs = elementsByType(result, 'ClassAttribute');
      expect(attrs).toHaveLength(1);
      expect(attrs[0].isDerived).toBe(true);
    });

    it('sets defaultValue when specified', () => {
      const model = modelWithClass();
      const mod: ModelModification = {
        action: 'add_attribute',
        target: { className: 'Order' },
        changes: { name: 'status', type: 'str', defaultValue: 'pending' } as any,
      };

      const result = modifier.applyModification(model, mod);

      const attrs = elementsByType(result, 'ClassAttribute');
      expect(attrs).toHaveLength(1);
      expect(attrs[0].defaultValue).toBe('pending');
    });
  });

  // ── add_method ──────────────────────────────────────────────────────────

  describe('add_method', () => {
    function modelWithClass(): BESSERModel {
      const m = makeEmptyModel();
      m.elements['cls1'] = {
        id: 'cls1',
        name: 'Service',
        type: 'Class',
        owner: null,
        bounds: { x: 0, y: 0, width: 220, height: 90 },
        attributes: [],
        methods: [],
      };
      return m;
    }

    it('adds a ClassMethod to the target class', () => {
      const model = modelWithClass();
      const mod: ModelModification = {
        action: 'add_method',
        target: { className: 'Service' },
        changes: { name: 'execute', returnType: 'bool' },
      };

      const result = modifier.applyModification(model, mod);

      const methods = elementsByType(result, 'ClassMethod');
      expect(methods).toHaveLength(1);
      expect(methods[0].owner).toBe('cls1');
      expect(methods[0].name).toContain('execute');
      expect(methods[0].name).toContain('bool');
    });

    it('sets code and implementationType when code is provided', () => {
      const model = modelWithClass();
      const mod: ModelModification = {
        action: 'add_method',
        target: { className: 'Service' },
        changes: { name: 'run', returnType: 'any', code: 'print("hello")' },
      };

      const result = modifier.applyModification(model, mod);

      const methods = elementsByType(result, 'ClassMethod');
      expect(methods).toHaveLength(1);
      expect(methods[0].code).toBe('print("hello")');
      expect(methods[0].implementationType).toBe('code');
    });

    it('respects explicit implementationType over default', () => {
      const model = modelWithClass();
      const mod: ModelModification = {
        action: 'add_method',
        target: { className: 'Service' },
        changes: { name: 'run', returnType: 'any', code: 'x=1', implementationType: 'action' },
      };

      const result = modifier.applyModification(model, mod);

      const methods = elementsByType(result, 'ClassMethod');
      expect(methods[0].implementationType).toBe('action');
    });
  });

  // ── findClassIdByName (via add_attribute targeting different types) ─────

  describe('findClassIdByName finds AbstractClass and Enumeration types', () => {
    it('resolves AbstractClass by name', () => {
      const model = makeEmptyModel();
      model.elements['abc1'] = {
        id: 'abc1',
        name: 'Vehicle',
        type: 'AbstractClass',
        owner: null,
        bounds: { x: 0, y: 0, width: 220, height: 90 },
        attributes: [],
        methods: [],
      };

      const mod: ModelModification = {
        action: 'add_attribute',
        target: { className: 'Vehicle' },
        changes: { name: 'speed', type: 'int' },
      };

      const result = modifier.applyModification(model, mod);

      const attrs = elementsByType(result, 'ClassAttribute');
      expect(attrs).toHaveLength(1);
      expect(attrs[0].owner).toBe('abc1');
    });

    it('resolves Enumeration by name', () => {
      const model = makeEmptyModel();
      model.elements['enum1'] = {
        id: 'enum1',
        name: 'Status',
        type: 'Enumeration',
        owner: null,
        bounds: { x: 0, y: 0, width: 220, height: 90 },
        attributes: [],
        methods: [],
      };

      const mod: ModelModification = {
        action: 'add_attribute',
        target: { className: 'Status' },
        changes: { name: 'ACTIVE', type: 'str' },
      };

      const result = modifier.applyModification(model, mod);

      const attrs = elementsByType(result, 'ClassAttribute');
      expect(attrs).toHaveLength(1);
      expect(attrs[0].owner).toBe('enum1');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// StateMachineModifier
// ═══════════════════════════════════════════════════════════════════════════════

describe('StateMachineModifier', () => {
  const modifier = new StateMachineModifier();

  describe('add_state', () => {
    it('creates a State element with bodies arrays', () => {
      const model = makeEmptyModel('StateMachineDiagram');
      const mod: ModelModification = {
        action: 'add_state',
        target: { stateName: 'Idle' },
        changes: { name: 'Idle' },
      };

      const result = modifier.applyModification(model, mod);

      const states = elementsByType(result, 'State');
      expect(states).toHaveLength(1);
      expect(states[0].name).toBe('Idle');
      expect(states[0].bodies).toBeDefined();
      expect(states[0].fallbackBodies).toBeDefined();
    });

    it('creates a StateInitialNode when stateType is "initial"', () => {
      const model = makeEmptyModel('StateMachineDiagram');
      const mod: ModelModification = {
        action: 'add_state',
        target: {},
        changes: { stateType: 'initial' },
      };

      const result = modifier.applyModification(model, mod);

      const initials = elementsByType(result, 'StateInitialNode');
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

      const finals = elementsByType(result, 'StateFinalNode');
      expect(finals).toHaveLength(1);
    });

    it('creates StateBody children for entry/do/exit actions', () => {
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

      const bodies = elementsByType(result, 'StateBody');
      expect(bodies).toHaveLength(3);
      expect(bodies.map((b: any) => b.name)).toEqual(
        expect.arrayContaining([
          'entry / logStart()',
          'do / process()',
          'exit / logEnd()',
        ]),
      );
    });
  });

  describe('add_code_block', () => {
    it('creates a StateCodeBlock element with code and language', () => {
      const model = makeEmptyModel('StateMachineDiagram');
      const mod: ModelModification = {
        action: 'add_code_block',
        target: { stateName: 'MyBlock' },
        changes: { name: 'MyBlock', code: 'x = 1', language: 'python' },
      };

      const result = modifier.applyModification(model, mod);

      const blocks = elementsByType(result, 'StateCodeBlock');
      expect(blocks).toHaveLength(1);
      expect(blocks[0].code).toBe('x = 1');
      expect(blocks[0].language).toBe('python');
      expect(blocks[0].name).toBe('MyBlock');
    });
  });

  describe('add_transition', () => {
    it('finds StateInitialNode as source', () => {
      const model = makeEmptyModel('StateMachineDiagram');
      model.elements['init1'] = {
        id: 'init1',
        name: '',
        type: 'StateInitialNode',
        owner: null,
        bounds: { x: 0, y: 0, width: 45, height: 45 },
      };
      model.elements['s1'] = {
        id: 's1',
        name: 'Running',
        type: 'State',
        owner: null,
        bounds: { x: 100, y: 0, width: 160, height: 100 },
        bodies: [],
        fallbackBodies: [],
      };

      const mod: ModelModification = {
        action: 'add_transition',
        target: {},
        changes: { source: '', target: 'Running' },
      };

      const result = modifier.applyModification(model, mod);

      const transitions = Object.values(result.relationships);
      expect(transitions).toHaveLength(1);
      expect(transitions[0].type).toBe('StateTransition');
      expect(transitions[0].source.element).toBe('init1');
      expect(transitions[0].target.element).toBe('s1');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ObjectDiagramModifier
// ═══════════════════════════════════════════════════════════════════════════════

describe('ObjectDiagramModifier', () => {
  const modifier = new ObjectDiagramModifier();

  describe('add_object', () => {
    it('creates an ObjectName element with ObjectAttribute children', () => {
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

      const objects = elementsByType(result, 'ObjectName');
      expect(objects).toHaveLength(1);
      expect(objects[0].name).toBe('order1: Order');

      const attrs = elementsByType(result, 'ObjectAttribute');
      expect(attrs).toHaveLength(2);
      expect(attrs[0].name).toBe('id = 42');
      expect(attrs[1].name).toBe('total = 99.9');
    });

    it('creates an ObjectName with empty attributes when none provided', () => {
      const model = makeEmptyModel('ObjectDiagram');
      const mod: ModelModification = {
        action: 'add_object',
        target: { objectName: 'empty1' },
        changes: { objectName: 'empty1', className: 'Foo' },
      };

      const result = modifier.applyModification(model, mod);

      const objects = elementsByType(result, 'ObjectName');
      expect(objects).toHaveLength(1);
      expect(objects[0].name).toBe('empty1: Foo');
      expect(objects[0].attributes).toEqual([]);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AgentDiagramModifier
// ═══════════════════════════════════════════════════════════════════════════════

describe('AgentDiagramModifier', () => {
  const modifier = new AgentDiagramModifier();

  describe('add_state', () => {
    it('creates an AgentState with AgentStateBody children', () => {
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

      const states = elementsByType(result, 'AgentState');
      expect(states).toHaveLength(1);
      expect(states[0].name).toBe('Greeting');

      const bodies = elementsByType(result, 'AgentStateBody');
      expect(bodies).toHaveLength(2);
      expect(bodies[0].name).toBe('Hello!');
      expect(bodies[0].replyType).toBe('text');
      expect(bodies[1].name).toBe('How can I help?');
    });
  });

  describe('add_intent', () => {
    it('creates an AgentIntent with AgentIntentBody children', () => {
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

      const intents = elementsByType(result, 'AgentIntent');
      expect(intents).toHaveLength(1);
      expect(intents[0].name).toBe('BookFlight');

      const bodies = elementsByType(result, 'AgentIntentBody');
      expect(bodies).toHaveLength(2);
      expect(bodies[0].name).toBe('I want to book a flight');
      expect(bodies[1].name).toBe('Book me a ticket');
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

      const rags = elementsByType(result, 'AgentRagElement');
      expect(rags).toHaveLength(1);
      expect(rags[0].name).toBe('KnowledgeBase');
    });
  });
});
