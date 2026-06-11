/**
 * Assistant converter tests (v4-native).
 *
 * The converters must emit the canonical v4 wire shape
 * ({version: '4.0.0', type, nodes[], edges[]}) directly:
 *  - `convertCompleteSystem` output must pass the same `isUMLModel` guard
 *    `BesserEditorComponent` uses before loading a model into the editor
 *    (a v3 'elements/relationships' payload silently renders a blank
 *    canvas),
 *  - `convertSingleElement` output must be accepted by
 *    `UMLModelingService.mergeElementIntoModel` (exercised through
 *    `processSimpleClassSpec` → `injectToEditor`).
 */

import { vi } from 'vitest';
import { ClassDiagramConverter } from '../converters/ClassDiagramConverter';
import { StateMachineConverter } from '../converters/StateMachineConverter';
import { AgentDiagramConverter } from '../converters/AgentDiagramConverter';
import { ObjectDiagramConverter } from '../converters/ObjectDiagramConverter';
import { UMLModelingService } from '../UMLModelingService';
import { createEmptyV4Model } from '../shared/v4Builders';
import { LAYOUT_START_X, LAYOUT_START_Y, LAYOUT_H_GAP } from '../shared/layoutUtils';
import { isUMLModel } from '../../../../shared/types/project';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nodesByType(model: any, type: string): any[] {
  return ((model.nodes ?? []) as any[]).filter((n) => n.type === type);
}

function nodeByName(model: any, name: string): any {
  return ((model.nodes ?? []) as any[]).find((n) => n.data?.name === name);
}

/** Assert the canonical v4 envelope (the editor's load guard). */
function expectValidV4Model(model: any, type: string) {
  expect(isUMLModel(model)).toBe(true);
  expect(model.version).toBe('4.0.0');
  expect(model.type).toBe(type);
  expect(Array.isArray(model.nodes)).toBe(true);
  expect(Array.isArray(model.edges)).toBe(true);
  // Never reintroduce v3 'elements/relationships' records.
  expect(model).not.toHaveProperty('elements');
  expect(model).not.toHaveProperty('relationships');
}

/** Run a single-element spec through the live merge path. */
async function injectSingleElement(diagramType: string, spec: any, baseModel?: any) {
  const dispatch: any = vi.fn(() => ({ unwrap: () => Promise.resolve() }));
  const service = new UMLModelingService(null, dispatch);
  service.updateCurrentModel((baseModel ?? createEmptyV4Model(diagramType)) as any);
  const update = service.processSimpleClassSpec(spec, diagramType);
  await service.injectToEditor(update);
  return service.getCurrentModel() as any;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ClassDiagramConverter
// ═══════════════════════════════════════════════════════════════════════════════

describe('ClassDiagramConverter (v4)', () => {
  const converter = new ClassDiagramConverter();

  const systemSpec = {
    systemName: 'Library',
    classes: [
      {
        className: 'Book',
        attributes: [{ name: 'title', type: 'string', visibility: 'public' }],
        methods: [{
          name: 'borrow',
          returnType: 'bool',
          visibility: 'public',
          parameters: [{ name: 'reader', type: 'str' }],
        }],
      },
      { className: 'Author', attributes: [{ name: 'name', type: 'str' }], methods: [] },
      { className: 'Shape', isAbstract: true, attributes: [], methods: [] },
    ],
    relationships: [
      {
        type: 'Association',
        sourceClass: 'Book',
        targetClass: 'Author',
        sourceMultiplicity: '*',
        targetMultiplicity: '1',
        name: 'writtenBy',
      },
      { type: 'Inheritance', sourceClass: 'Book', targetClass: 'Shape' },
    ],
  };

  it('emits a canonical v4 model that passes the editor load guard', () => {
    const model = converter.convertCompleteSystem(systemSpec);
    expectValidV4Model(model, 'ClassDiagram');
    expect(model.title).toBe('Library');
  });

  it('emits all classifiers as type "class" with inline member rows', () => {
    const model = converter.convertCompleteSystem(systemSpec);

    expect(model.nodes).toHaveLength(3);
    expect(nodesByType(model, 'class')).toHaveLength(3);

    const book = nodeByName(model, 'Book');
    expect(book.data.attributes).toHaveLength(1);
    expect(book.data.attributes[0]).toMatchObject({
      name: 'title',
      attributeType: 'str', // 'string' normalized
      visibility: 'public',
    });
    expect(book.data.methods).toHaveLength(1);
    expect(book.data.methods[0]).toMatchObject({
      name: 'borrow(reader: str)',
      attributeType: 'bool',
      visibility: 'public',
    });
  });

  it('discriminates abstract classes via data.stereotype (not node.type)', () => {
    const model = converter.convertCompleteSystem(systemSpec);
    const shape = nodeByName(model, 'Shape');
    expect(shape.type).toBe('class');
    expect(shape.data.stereotype).toBe('abstract');
    expect(shape.data.italic).toBe(true);
  });

  it('emits relationships as edges with v4 handles and role/multiplicity data', () => {
    const model = converter.convertCompleteSystem(systemSpec);
    expect(model.edges).toHaveLength(2);

    const bookId = nodeByName(model, 'Book').id;
    const authorId = nodeByName(model, 'Author').id;
    const shapeId = nodeByName(model, 'Shape').id;

    const assoc = model.edges.find((e: any) => e.type === 'ClassBidirectional');
    expect(assoc).toMatchObject({
      source: bookId,
      target: authorId,
      sourceHandle: 'left',
      targetHandle: 'right',
    });
    expect(assoc.data).toMatchObject({
      name: 'writtenBy',
      sourceMultiplicity: '*',
      targetMultiplicity: '1',
      targetRole: 'writtenBy',
      isManuallyLayouted: false,
    });

    const inheritance = model.edges.find((e: any) => e.type === 'ClassInheritance');
    expect(inheritance).toMatchObject({ source: bookId, target: shapeId });
  });

  it('lays classes out on the shared grid', () => {
    const model = converter.convertCompleteSystem(systemSpec);
    const book = nodeByName(model, 'Book');
    const author = nodeByName(model, 'Author');
    expect(book.position).toEqual({ x: LAYOUT_START_X, y: LAYOUT_START_Y });
    expect(author.position).toEqual({ x: LAYOUT_START_X + LAYOUT_H_GAP, y: LAYOUT_START_Y });
  });

  it('respects explicit per-class positions', () => {
    const model = converter.convertCompleteSystem({
      classes: [{ className: 'Pinned', position: { x: 42, y: 24 }, attributes: [], methods: [] }],
    });
    expect(nodeByName(model, 'Pinned').position).toEqual({ x: 42, y: 24 });
  });

  it('convertSingleElement returns a {nodes, edges} fragment with geometry', () => {
    const fragment = converter.convertSingleElement(
      { className: 'Person', attributes: [{ name: 'age', type: 'int' }], methods: [] },
      { x: 10, y: 20 },
    );
    expect(fragment.nodes).toHaveLength(1);
    expect(fragment.edges).toEqual([]);
    const node = fragment.nodes[0] as any;
    expect(node.type).toBe('class');
    expect(node.position).toEqual({ x: 10, y: 20 });
    expect(node.width).toBe(220);
    expect(node.measured).toEqual({ width: node.width, height: node.height });
    expect(node.data.attributes[0].attributeType).toBe('int');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// StateMachineConverter
// ═══════════════════════════════════════════════════════════════════════════════

describe('StateMachineConverter (v4)', () => {
  const converter = new StateMachineConverter();

  const systemSpec = {
    name: 'TrafficLight',
    states: [
      { stateType: 'initial' },
      { stateName: 'Red', entryAction: 'turnOnRed()', exitAction: 'turnOffRed()' },
      { stateName: 'Green', doActivity: 'go()' },
    ],
    transitions: [
      { source: 'initial', target: 'Red' },
      { source: 'Red', target: 'Green', trigger: 'timer', guard: 'safe', effect: 'switch()' },
    ],
    codeBlocks: [{ name: 'Helpers', code: 'x = 1', language: 'python' }],
  };

  it('emits a canonical v4 model that passes the editor load guard', () => {
    const model = converter.convertCompleteSystem(systemSpec);
    expectValidV4Model(model, 'StateMachineDiagram');
  });

  it('collapses entry/do/exit actions onto inline State body rows', () => {
    const model = converter.convertCompleteSystem(systemSpec);

    expect(nodesByType(model, 'StateInitialNode')).toHaveLength(1);
    expect(nodesByType(model, 'State')).toHaveLength(2);
    // Bodies are NOT separate nodes in v4.
    expect(nodesByType(model, 'StateBody')).toHaveLength(0);

    const red = nodeByName(model, 'Red');
    expect(red.data.bodies.map((b: any) => b.name)).toEqual([
      'entry / turnOnRed()',
      'exit / turnOffRed()',
    ]);
    expect(red.data.fallbackBodies).toEqual([]);

    const green = nodeByName(model, 'Green');
    expect(green.data.bodies.map((b: any) => b.name)).toEqual(['do / go()']);
  });

  it('emits StateTransition edges with the composed trigger/guard/effect label', () => {
    const model = converter.convertCompleteSystem(systemSpec);
    expect(model.edges).toHaveLength(2);

    const initialId = nodesByType(model, 'StateInitialNode')[0].id;
    const redId = nodeByName(model, 'Red').id;
    const greenId = nodeByName(model, 'Green').id;

    const initEdge = model.edges.find((e: any) => e.source === initialId);
    expect(initEdge).toMatchObject({ type: 'StateTransition', target: redId });

    const labelled = model.edges.find((e: any) => e.source === redId);
    expect(labelled).toMatchObject({
      type: 'StateTransition',
      target: greenId,
      sourceHandle: 'right',
      targetHandle: 'left',
    });
    expect(labelled.data.name).toBe('timer [safe] / switch()');
  });

  it('emits StateCodeBlock nodes for code blocks', () => {
    const model = converter.convertCompleteSystem(systemSpec);
    const blocks = nodesByType(model, 'StateCodeBlock');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].data).toMatchObject({ name: 'Helpers', code: 'x = 1', language: 'python' });
  });

  it('convertSingleElement emits initial/final markers and stateful nodes', () => {
    const initial = converter.convertSingleElement({ stateType: 'initial' }, { x: 0, y: 0 });
    expect(initial.nodes[0]).toMatchObject({ type: 'StateInitialNode', width: 45, height: 45 });

    const state = converter.convertSingleElement(
      { stateName: 'Idle', entryAction: 'init()', fallbackAction: 'recover()' },
      { x: 0, y: 0 },
    );
    const node = state.nodes[0] as any;
    expect(node.type).toBe('State');
    expect(node.data.bodies.map((b: any) => b.name)).toEqual(['entry / init()']);
    expect(node.data.fallbackBodies.map((b: any) => b.name)).toEqual(['recover()']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AgentDiagramConverter
// ═══════════════════════════════════════════════════════════════════════════════

describe('AgentDiagramConverter (v4)', () => {
  const converter = new AgentDiagramConverter();

  const systemSpec = {
    name: 'SupportAgent',
    intents: [{ intentName: 'Greet', trainingPhrases: ['hello', 'hi there'] }],
    states: [
      {
        stateName: 'Welcome',
        replies: [{ text: 'Hello!', replyType: 'text' }],
        fallbackBodies: ['Sorry, I did not get that.'],
      },
    ],
    transitions: [
      { source: 'initial', target: 'Welcome' },
      { source: 'Greet', target: 'Welcome' },
    ],
    ragElements: [{ name: 'Docs' }],
  };

  it('emits a canonical v4 model that passes the editor load guard', () => {
    const model = converter.convertCompleteSystem(systemSpec);
    expectValidV4Model(model, 'AgentDiagram');
  });

  it('collapses replies onto inline AgentState body rows', () => {
    const model = converter.convertCompleteSystem(systemSpec);

    const welcome = nodeByName(model, 'Welcome');
    expect(welcome.type).toBe('AgentState');
    expect(welcome.data.replyType).toBe('text');
    expect(welcome.data.bodies).toHaveLength(1);
    expect(welcome.data.bodies[0]).toMatchObject({ name: 'Hello!', replyType: 'text' });
    expect(welcome.data.fallbackBodies.map((f: any) => f.name)).toEqual([
      'Sorry, I did not get that.',
    ]);
    // Bodies are NOT separate nodes in v4.
    expect(nodesByType(model, 'AgentStateBody')).toHaveLength(0);
    expect(nodesByType(model, 'AgentStateFallbackBody')).toHaveLength(0);
  });

  it('emits intents with inline training_phrases rows (rendered by AgentIntent.tsx)', () => {
    const model = converter.convertCompleteSystem(systemSpec);

    const greet = nodeByName(model, 'Greet');
    expect(greet.type).toBe('AgentIntent');
    expect(greet.data.training_phrases.map((p: any) => p.name)).toEqual(['hello', 'hi there']);
    expect(nodesByType(model, 'AgentIntentBody')).toHaveLength(0);
  });

  it('emits AgentRagElement nodes', () => {
    const model = converter.convertCompleteSystem(systemSpec);
    const rags = nodesByType(model, 'AgentRagElement');
    expect(rags).toHaveLength(1);
    expect(rags[0].data.name).toBe('Docs');
  });

  it('emits canonical transition data: init edge bare, intent edge predefined', () => {
    const model = converter.convertCompleteSystem(systemSpec);
    expect(model.edges).toHaveLength(2);

    const initialId = nodesByType(model, 'StateInitialNode')[0].id;
    const greetId = nodeByName(model, 'Greet').id;

    const initEdge = model.edges.find((e: any) => e.source === initialId);
    expect(initEdge.type).toBe('AgentStateTransitionInit');
    expect(initEdge.data.transitionType).toBeUndefined();

    const intentEdge = model.edges.find((e: any) => e.source === greetId);
    expect(intentEdge.type).toBe('AgentStateTransition');
    expect(intentEdge.data.transitionType).toBe('predefined');
    expect(intentEdge.data.predefined).toEqual({
      predefinedType: 'when_intent_matched',
      intentName: 'Greet',
    });
  });

  it('lifts explicit condition/conditionValue specs to the canonical shape', () => {
    const model = converter.convertCompleteSystem({
      states: [
        { stateName: 'A', replies: [] },
        { stateName: 'B', replies: [] },
      ],
      hasInitialNode: false,
      transitions: [
        { source: 'A', target: 'B', condition: 'when_intent_matched', conditionValue: 'OrderPizza' },
        { source: 'B', target: 'A', condition: 'custom_transition', conditionValue: 'session.done' },
      ],
    });

    const predefined = model.edges.find((e: any) => e.data.transitionType === 'predefined');
    expect(predefined.data.predefined).toEqual({
      predefinedType: 'when_intent_matched',
      intentName: 'OrderPizza',
    });

    const custom = model.edges.find((e: any) => e.data.transitionType === 'custom');
    expect(custom.data.custom).toEqual({
      event: 'WildcardEvent',
      condition: ['session.done'],
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ObjectDiagramConverter
// ═══════════════════════════════════════════════════════════════════════════════

describe('ObjectDiagramConverter (v4)', () => {
  const converter = new ObjectDiagramConverter();

  const systemSpec = {
    objects: [
      {
        objectName: 'book1',
        className: 'Book',
        attributes: [{ name: 'title', value: 'Dune', type: 'str' }],
      },
      { objectName: 'author1', className: 'Author', classId: 'cls_author', attributes: [] },
    ],
    links: [{ source: 'book1', target: 'author1', relationshipType: 'writtenBy' }],
  };

  it('emits a canonical v4 model that passes the editor load guard', () => {
    const model = converter.convertCompleteSystem(systemSpec);
    expectValidV4Model(model, 'ObjectDiagram');
  });

  it('emits objectName nodes with inline attribute rows', () => {
    const model = converter.convertCompleteSystem(systemSpec);
    expect(nodesByType(model, 'objectName')).toHaveLength(2);
    // Attribute rows are NOT separate nodes in v4.
    expect(nodesByType(model, 'objectAttribute')).toHaveLength(0);

    const book = nodeByName(model, 'book1: Book');
    expect(book).toBeDefined();
    expect(book.data.attributes).toHaveLength(1);
    expect(book.data.attributes[0]).toMatchObject({
      name: 'title',
      value: 'Dune',
      attributeType: 'str',
    });
  });

  it('keeps the bare instance name when classId links the object to a class', () => {
    const model = converter.convertCompleteSystem(systemSpec);
    const author = nodeByName(model, 'author1');
    expect(author).toBeDefined();
    expect(author.data.classId).toBe('cls_author');
    expect(author.data.className).toBe('Author');
  });

  it('emits ObjectLink edges between the objects', () => {
    const model = converter.convertCompleteSystem(systemSpec);
    expect(model.edges).toHaveLength(1);
    const link = model.edges[0];
    expect(link.type).toBe('ObjectLink');
    expect(link.source).toBe(nodeByName(model, 'book1: Book').id);
    expect(link.target).toBe(nodeByName(model, 'author1').id);
    expect(link.data).toMatchObject({ name: 'writtenBy', label: 'writtenBy' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Single-element injection — convertSingleElement → mergeElementIntoModel
// ═══════════════════════════════════════════════════════════════════════════════

describe('single-element injection (mergeElementIntoModel acceptance)', () => {
  it('merges a class spec into the current ClassDiagram model', async () => {
    const model = await injectSingleElement('ClassDiagram', {
      className: 'Person',
      attributes: [{ name: 'age', type: 'int', visibility: 'private' }],
      methods: [],
    });
    expect(model.nodes).toHaveLength(1);
    expect(model.nodes[0].type).toBe('class');
    expect(model.nodes[0].data.name).toBe('Person');
  });

  it('appends to an existing model instead of replacing it', async () => {
    const base: any = createEmptyV4Model('ClassDiagram');
    base.nodes.push({
      id: 'existing',
      type: 'class',
      position: { x: 0, y: 0 },
      width: 220,
      height: 90,
      measured: { width: 220, height: 90 },
      data: { name: 'Existing', attributes: [], methods: [] },
    });
    const model = await injectSingleElement('ClassDiagram', {
      className: 'Person',
      attributes: [],
      methods: [],
    }, base);
    expect(model.nodes.map((n: any) => n.data.name)).toEqual(['Existing', 'Person']);
  });

  it('merges a state spec into the current StateMachineDiagram model', async () => {
    const model = await injectSingleElement('StateMachineDiagram', {
      stateName: 'Idle',
      entryAction: 'init()',
    });
    expect(model.nodes).toHaveLength(1);
    expect(model.nodes[0].type).toBe('State');
    expect(model.nodes[0].data.bodies.map((b: any) => b.name)).toEqual(['entry / init()']);
  });

  it('merges an intent spec into the current AgentDiagram model', async () => {
    const model = await injectSingleElement('AgentDiagram', {
      type: 'intent',
      intentName: 'Greet',
      trainingPhrases: ['hi'],
    });
    expect(model.nodes).toHaveLength(1);
    expect(model.nodes[0].type).toBe('AgentIntent');
    expect(model.nodes[0].data.training_phrases.map((p: any) => p.name)).toEqual(['hi']);
  });

  it('merges an object spec into the current ObjectDiagram model', async () => {
    const model = await injectSingleElement('ObjectDiagram', {
      objectName: 'order1',
      className: 'Order',
      attributes: [{ name: 'id', value: '42' }],
    });
    expect(model.nodes).toHaveLength(1);
    expect(model.nodes[0].type).toBe('objectName');
    expect(model.nodes[0].data.attributes[0]).toMatchObject({ name: 'id', value: '42' });
  });
});
