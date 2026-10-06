/**
 * Assistant behaviour that must match develop (v3) on the v4 model format.
 *
 * Each block records a regression found when the converters/modifiers were
 * ported to v4: the engine and the wire format may differ from develop, the
 * result the user sees may not.
 */

import { vi } from 'vitest';
import { formatObjectMember, normalizeV4Model } from '@besser/wme';
import { ClassDiagramModifier } from '../modifiers/ClassDiagramModifier';
import { ObjectDiagramModifier } from '../modifiers/ObjectDiagramModifier';
import { AgentDiagramModifier } from '../modifiers/AgentDiagramModifier';
import { BPMNDiagramModifier } from '../modifiers/BPMNDiagramModifier';
import { ClassDiagramConverter } from '../converters/ClassDiagramConverter';
import { ObjectDiagramConverter } from '../converters/ObjectDiagramConverter';
import { AgentDiagramConverter, buildTransitionConditionData } from '../converters/AgentDiagramConverter';
import { UMLModelingService } from '../UMLModelingService';
import { createEmptyV4Model } from '../shared/v4Builders';

function model(type: string, nodes: any[] = [], edges: any[] = []): any {
  return { ...createEmptyV4Model(type), nodes, edges };
}

function classNode(id: string, name: string, extraData: Record<string, unknown> = {}): any {
  return {
    id,
    type: 'class',
    position: { x: 100, y: 50 },
    width: 220,
    height: 90,
    measured: { width: 220, height: 90 },
    data: { name, attributes: [], methods: [], ...extraData },
  };
}

function agentState(id: string, name: string, extraData: Record<string, unknown> = {}): any {
  return {
    id,
    type: 'AgentState',
    position: { x: 0, y: 0 },
    width: 210,
    height: 70,
    data: { name, bodies: [], fallbackBodies: [], ...extraData },
  };
}

// ── 1. Class stereotypes use the library's ClassType casing ────────────────
// The library renders and edits only 'Abstract' / 'Interface' / 'Enumeration'
// (ClassSVG, ClassEditPanel). Lowercase writes rendered as a plain class, and
// exact lowercase compares never matched editor-authored classes.
describe('class stereotypes (ClassType casing)', () => {
  const modifier = new ClassDiagramModifier();

  it.each([
    ['isAbstract', 'Abstract'],
    ['isInterface', 'Interface'],
    ['isEnumeration', 'Enumeration'],
  ])('add_class with %s writes "%s"', (flag, expected) => {
    const result: any = modifier.applyModification(model('ClassDiagram'), {
      action: 'add_class',
      target: { className: 'X' },
      changes: { className: 'X', [flag]: true } as any,
    });
    expect(result.nodes[0].data.stereotype).toBe(expected);
  });

  it.each([
    ['isAbstract', 'Abstract'],
    ['isInterface', 'Interface'],
    ['isEnumeration', 'Enumeration'],
  ])('modify_class %s: true writes "%s"', (flag, expected) => {
    const result: any = modifier.applyModification(model('ClassDiagram', [classNode('c1', 'Shape')]), {
      action: 'modify_class',
      target: { className: 'Shape' },
      changes: { [flag]: true } as any,
    });
    expect(result.nodes[0].data.stereotype).toBe(expected);
  });

  it.each([
    ['isAbstract', 'Abstract'],
    ['isInterface', 'Interface'],
    ['isEnumeration', 'Enumeration'],
  ])('modify_class %s: false turns an editor-authored "%s" class back into a plain class', (flag, stereotype) => {
    const result: any = modifier.applyModification(
      model('ClassDiagram', [classNode('c1', 'Shape', { stereotype, italic: stereotype !== 'Enumeration' })]),
      { action: 'modify_class', target: { className: 'Shape' }, changes: { [flag]: false } as any },
    );
    expect(result.nodes[0].data.stereotype).toBeUndefined();
  });

  it('modify_class isAbstract: false resets to a plain class whatever the stereotype (develop)', () => {
    const result: any = modifier.applyModification(
      model('ClassDiagram', [classNode('c1', 'Shape', { stereotype: 'Interface', italic: true })]),
      { action: 'modify_class', target: { className: 'Shape' }, changes: { isAbstract: false } as any },
    );
    expect(result.nodes[0].data.stereotype).toBeUndefined();
    expect(result.nodes[0].data.italic).toBe(false);
  });

  it('modify_class canonicalises a known stereotype string and keeps freeform ones', () => {
    const base = model('ClassDiagram', [classNode('c1', 'Shape'), classNode('c2', 'Repo')]);
    let result: any = modifier.applyModification(base, {
      action: 'modify_class', target: { className: 'Shape' }, changes: { stereotype: 'abstract' } as any,
    });
    result = modifier.applyModification(result, {
      action: 'modify_class', target: { className: 'Repo' }, changes: { stereotype: 'service' } as any,
    });
    expect(result.nodes[0].data.stereotype).toBe('Abstract');
    expect(result.nodes[1].data.stereotype).toBe('service');
  });

  it('add_enum writes "Enumeration"', () => {
    const result: any = modifier.applyModification(model('ClassDiagram'), {
      action: 'add_enum',
      enumName: 'Color',
      values: ['RED', 'GREEN'],
    } as any);
    expect(result.nodes[0].data.stereotype).toBe('Enumeration');
  });

  it('the converter writes ClassType casing', () => {
    const out: any = new ClassDiagramConverter().convertCompleteSystem({
      classes: [
        { className: 'A', isAbstract: true },
        { className: 'I', isInterface: true },
        { className: 'E', isEnumeration: true, attributes: [{ name: 'X' }] },
      ],
    });
    expect(out.nodes.map((n: any) => n.data.stereotype)).toEqual(['Abstract', 'Interface', 'Enumeration']);
  });
});

// ── 2. Assistant-added OCL constraints are visible on the canvas ────────────
// develop created a ClassOCLConstraint element + ClassOCLLink. Storing the
// text only on `data.oclConstraints` left it invisible and uneditable.
describe('add_ocl_constraint', () => {
  it('creates a ClassOCLConstraint node linked to its class, like the converter', () => {
    const modifier = new ClassDiagramModifier();
    const result: any = modifier.applyModification(model('ClassDiagram', [classNode('c1', 'Room')]), {
      action: 'add_ocl_constraint',
      target: { className: 'Room' },
      changes: { constraint: 'context Room inv: self.capacity > 0', text: 'Rooms hold someone' },
    } as any);

    const ocl = result.nodes.find((n: any) => n.type === 'ClassOCLConstraint');
    expect(ocl).toBeDefined();
    expect(ocl.data.expression).toBe('context Room inv: self.capacity > 0');
    expect(ocl.data.description).toBe('Rooms hold someone');
    // Placed to the right of its class (develop: class.x + width + 80).
    expect(ocl.position).toEqual({ x: 100 + 220 + 80, y: 50 });

    const link = result.edges.find((e: any) => e.type === 'ClassOCLLink');
    expect(link).toMatchObject({ source: ocl.id, target: 'c1' });
    // Not duplicated into the hidden per-class row list.
    expect(result.nodes[0].data.oclConstraints).toBeUndefined();
  });
});

// ── 3. Object attribute rows store name and value separately ───────────────
// The library renders `name = value` (formatObjectMember) and its v3 export
// recombines them, so a name of "age = 30" became "age = 30 = 30".
describe('object attribute rows', () => {
  const modifier = new ObjectDiagramModifier();

  it('add_object keeps the attribute name bare and the value on `value`', () => {
    const result: any = modifier.applyModification(model('ObjectDiagram'), {
      action: 'add_object',
      target: {},
      changes: { objectName: 'p1', className: 'Person', attributes: [{ name: 'age', value: '30', type: 'int' }] },
    } as any);
    const row = result.nodes[0].data.attributes[0];
    expect(row).toMatchObject({ name: 'age', value: '30', attributeType: 'int' });
    expect(formatObjectMember(row)).toBe('age = 30');
  });

  it('modify_attribute_value updates only the value', () => {
    const start = model('ObjectDiagram', [{
      id: 'o1',
      type: 'objectName',
      position: { x: 0, y: 0 },
      data: { name: 'p1', className: 'Person', attributes: [{ id: 'a1', name: 'age', value: '30', attributeType: 'int' }] },
    }]);
    const result: any = modifier.applyModification(start, {
      action: 'modify_attribute_value',
      target: { objectName: 'p1', attributeName: 'age' },
      changes: { value: '31' },
    } as any);
    const row = result.nodes[0].data.attributes[0];
    expect(row).toMatchObject({ name: 'age', value: '31' });
    expect(formatObjectMember(row)).toBe('age = 31');
  });

  it('modify_attribute_value still finds a legacy "name = value" row and repairs it', () => {
    const start = model('ObjectDiagram', [{
      id: 'o1',
      type: 'objectName',
      position: { x: 0, y: 0 },
      data: { name: 'p1', attributes: [{ id: 'a1', name: 'age = 30', value: '30' }] },
    }]);
    const result: any = modifier.applyModification(start, {
      action: 'modify_attribute_value',
      target: { objectName: 'p1', attributeName: 'age' },
      changes: { value: '31' },
    } as any);
    expect(result.nodes[0].data.attributes[0]).toMatchObject({ name: 'age', value: '31' });
  });
});

// ── 4. Object header is "name : Class" once ────────────────────────────────
// The library header renders `${name} : ${className}`, so a name that already
// carries ": Book" rendered "book1: Book : Book".
describe('object header', () => {
  const headerOf = (data: any) => (data.className ? `${data.name} : ${data.className}` : data.name);

  it('the converter keeps the bare instance name when only className is known', () => {
    const out: any = new ObjectDiagramConverter().convertCompleteSystem({
      objects: [{ objectName: 'book1', className: 'Book', attributes: [] }],
    });
    expect(out.nodes[0].data).toMatchObject({ name: 'book1', className: 'Book' });
    expect(headerOf(out.nodes[0].data)).toBe('book1 : Book');
  });

  it('add_object keeps the bare instance name when only className is known', () => {
    const result: any = new ObjectDiagramModifier().applyModification(model('ObjectDiagram'), {
      action: 'add_object',
      target: {},
      changes: { objectName: 'book1', className: 'Book' },
    } as any);
    expect(headerOf(result.nodes[0].data)).toBe('book1 : Book');
  });

  it('add_object auto-numbers instances of the same class', () => {
    const modifier = new ObjectDiagramModifier();
    let result: any = modifier.applyModification(model('ObjectDiagram'), {
      action: 'add_object', target: {}, changes: { objectName: 'Book', className: 'Book' },
    } as any);
    result = modifier.applyModification(result, {
      action: 'add_object', target: {}, changes: { objectName: 'Book', className: 'Book' },
    } as any);
    expect(result.nodes.map((n: any) => n.data.name)).toEqual(['book1', 'book2']);
  });
});

// ── 5. Agent initial state ─────────────────────────────────────────────────
// v4 marks the entry state with `data.initial`; the library drops a
// StateInitialNode without an init edge, so a bare marker vanished silently.
describe('agent initial state', () => {
  it('a single "initial" element is rejected with a message instead of vanishing', () => {
    expect(() => new AgentDiagramConverter().convertSingleElement({ type: 'initial' })).toThrow(/initial state/i);
  });

  it('add_transition from "initial" marks the target state initial (single-select)', () => {
    const start = model('AgentDiagram', [
      agentState('s1', 'Welcome', { initial: true }),
      agentState('s2', 'Menu'),
    ]);
    const result: any = new AgentDiagramModifier().applyModification(start, {
      action: 'add_transition',
      target: { sourceStateName: 'initial', targetStateName: 'Menu' },
      changes: {},
    } as any);
    expect(result.nodes.find((n: any) => n.id === 's2').data.initial).toBe(true);
    expect(result.nodes.find((n: any) => n.id === 's1').data.initial).toBe(false);
    expect(result.edges).toHaveLength(0);
    expect(normalizeV4Model(result).nodes.find((n: any) => n.id === 's2')?.data).toMatchObject({ initial: true });
  });

  it('remove_transition from "initial" clears the initial flag', () => {
    const start = model('AgentDiagram', [agentState('s1', 'Welcome', { initial: true })]);
    const result: any = new AgentDiagramModifier().applyModification(start, {
      action: 'remove_transition',
      target: { sourceStateName: 'initial', targetStateName: 'Welcome' },
      changes: {},
    } as any);
    expect(result.nodes[0].data.initial).toBe(false);
  });
});

// ── 6. Agent transition default condition ──────────────────────────────────
// develop left an unconditioned transition without a type, which the editor
// reads as `when_intent_matched`; the port defaulted to 'auto'.
describe('agent transition defaults', () => {
  it('the converter defaults to when_intent_matched', () => {
    expect(buildTransitionConditionData({})).toEqual({
      transitionType: 'predefined',
      predefined: { predefinedType: 'when_intent_matched', intentName: '' },
    });
  });

  it('add_transition defaults to when_intent_matched and labels from changes.name', () => {
    const start = model('AgentDiagram', [agentState('s1', 'A'), agentState('s2', 'B')]);
    const result: any = new AgentDiagramModifier().applyModification(start, {
      action: 'add_transition',
      target: { sourceStateName: 'A', targetStateName: 'B' },
      changes: { name: 'next' },
    } as any);
    const edge = result.edges[0];
    expect(edge.data.name).toBe('next');
    expect(edge.data.predefined.predefinedType).toBe('when_intent_matched');
  });
});

// ── 8. BPMN placement uses absolute coordinates ────────────────────────────
// Children of pools/lanes store positions relative to their parent; mixing
// them with absolute top-level coordinates put new nodes inside/behind pools.
describe('BPMN add_task placement', () => {
  it('places the new node to the right of the rightmost node in canvas coordinates', () => {
    const start = model('BPMN', [
      { id: 'pool', type: 'bpmnPool', position: { x: 1000, y: 400 }, width: 800, height: 300, data: { name: 'P' } },
      { id: 'lane', type: 'bpmnSwimlane', parentId: 'pool', position: { x: 30, y: 0 }, width: 770, height: 300, data: { name: 'L' } },
      { id: 't1', type: 'bpmnTask', parentId: 'lane', position: { x: 100, y: 120 }, width: 140, height: 60, data: { name: 'Inner' } },
    ]);
    const result: any = new BPMNDiagramModifier().applyModification(start, {
      action: 'add_task',
      target: { nodeName: 'Next' },
      changes: {},
    } as any);
    const added = result.nodes.find((n: any) => n.data?.name === 'Next');
    expect(added.parentId).toBeUndefined();
    // Inner task's absolute right edge: 1000 + 30 + 100 + 140 = 1270; y: 400 + 120.
    expect(added.position).toEqual({ x: 1270 + 60, y: 520 });
  });
});

// ── 9. UMLModelingService merges by id (develop) ───────────────────────────
describe('UMLModelingService merge', () => {
  it('a complete system that reuses an id replaces the node instead of duplicating it', async () => {
    const dispatch: any = vi.fn(() => ({ unwrap: () => Promise.resolve() }));
    const service = new UMLModelingService(null, dispatch);
    service.updateCurrentModel(model('ClassDiagram', [classNode('c1', 'Old'), classNode('c2', 'Keep')]) as any);
    await service.injectToEditor({
      type: 'complete_system',
      data: model('ClassDiagram', [classNode('c1', 'New'), classNode('c3', 'Added')]),
      message: '',
    } as any);
    const names = (service.getCurrentModel() as any).nodes.map((n: any) => `${n.id}:${n.data.name}`);
    expect(names).toEqual(['c1:New', 'c2:Keep', 'c3:Added']);
  });
});
