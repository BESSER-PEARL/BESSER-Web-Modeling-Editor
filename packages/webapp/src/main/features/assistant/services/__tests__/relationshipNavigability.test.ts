import { describe, expect, it } from 'vitest';
import { ClassDiagramModifier } from '../modifiers/ClassDiagramModifier';
import { ClassDiagramConverter } from '../converters/ClassDiagramConverter';
import { mapAssistantRelationshipType } from '../shared/relationshipMapping';
import type { ModelModification } from '../modifiers/base';
import type { BESSERModel } from '../UMLModelingService';

function makeEmptyModel(): BESSERModel {
  return {
    version: '4.0.0',
    id: 'm',
    title: '',
    type: 'ClassDiagram',
    nodes: [],
    edges: [],
    assessments: {},
  } as unknown as BESSERModel;
}

// v4: per-end navigability lives on edge.data.sourceNavigable / targetNavigable.
const nav = (edge: any) => [edge.data?.sourceNavigable, edge.data?.targetNavigable];
const nodeName = (model: any, id: string) => model.nodes.find((n: any) => n.id === id)?.data?.name;

// Relationship types the modeling agent's RelationshipSpec can send, plus
// legacy / free-form values the webapp still accepts.
describe('mapAssistantRelationshipType', () => {
  it.each([
    ['Association', 'ClassBidirectional', { source: true, target: true }],
    ['Bidirectional', 'ClassBidirectional', { source: true, target: true }],
    ['Unidirectional', 'ClassBidirectional', { source: false, target: true }],
    ['ClassUnidirectional', 'ClassBidirectional', { source: false, target: true }],
    ['Composition', 'ClassComposition', { source: true, target: true }],
    ['Aggregation', 'ClassAggregation', { source: true, target: true }],
    ['something-else', 'ClassBidirectional', { source: true, target: true }],
    [undefined, 'ClassBidirectional', { source: true, target: true }],
  ])('maps %s to %s with navigable %o', (input, type, navigable) => {
    expect(mapAssistantRelationshipType(input as string | undefined)).toEqual({ type, navigable });
  });

  it.each([
    ['Inheritance', 'ClassInheritance'],
    ['Generalization', 'ClassInheritance'],
    ['Realization', 'ClassRealization'],
    ['Dependency', 'ClassDependency'],
  ])('maps %s to %s without navigability', (input, type) => {
    expect(mapAssistantRelationshipType(input)).toEqual({ type });
  });
});

describe('ClassDiagramModifier relationships', () => {
  const modifier = new ClassDiagramModifier();

  function addRelationship(model: BESSERModel, relationshipType: string) {
    const mod: ModelModification = {
      action: 'add_relationship',
      target: {},
      changes: { sourceClass: 'Order', targetClass: 'Customer', relationshipType } as any,
    };
    return modifier.applyModification(model, mod);
  }

  function modifyRelationship(model: BESSERModel, changes: Record<string, unknown>) {
    return modifier.applyModification(model, {
      action: 'modify_relationship',
      target: { sourceClass: 'Order', targetClass: 'Customer' },
      changes: changes as any,
    });
  }

  const onlyRelationship = (model: BESSERModel) => ((model as any).edges as any[])[0];

  it('adds a plain association as ClassBidirectional with both ends navigable', () => {
    const rel = onlyRelationship(addRelationship(makeEmptyModel(), 'Association'));
    expect(rel.type).toBe('ClassBidirectional');
    expect(nav(rel)).toEqual([true, true]);
  });

  it('adds a unidirectional association pointing at the target class', () => {
    const result = addRelationship(makeEmptyModel(), 'unidirectional');
    const rel = onlyRelationship(result);
    expect(rel.type).toBe('ClassBidirectional');
    expect(nodeName(result, rel.source)).toBe('Order');
    expect(nodeName(result, rel.target)).toBe('Customer');
    expect(nav(rel)).toEqual([false, true]);
  });

  it('keeps the part end of a composition navigable', () => {
    const rel = onlyRelationship(addRelationship(makeEmptyModel(), 'Composition'));
    expect(rel.type).toBe('ClassComposition');
    expect(nav(rel)).toEqual([true, true]);
  });

  it('does not add navigability to an inheritance', () => {
    const rel = onlyRelationship(addRelationship(makeEmptyModel(), 'Inheritance'));
    expect(rel.type).toBe('ClassInheritance');
    expect(rel.data).not.toHaveProperty('sourceNavigable');
    expect(rel.data).not.toHaveProperty('targetNavigable');
  });

  it('updates navigability when modify_relationship changes the type', () => {
    let model = addRelationship(makeEmptyModel(), 'Association');

    model = modifyRelationship(model, { relationshipType: 'Unidirectional' });
    let rel = onlyRelationship(model);
    expect(rel.type).toBe('ClassBidirectional');
    expect(nav(rel)).toEqual([false, true]);

    model = modifyRelationship(model, { relationshipType: 'Composition' });
    rel = onlyRelationship(model);
    expect(rel.type).toBe('ClassComposition');
    expect(nav(rel)).toEqual([true, true]);

    model = modifyRelationship(model, { relationshipType: 'Inheritance' });
    rel = onlyRelationship(model);
    expect(rel.type).toBe('ClassInheritance');
    expect(rel.data).not.toHaveProperty('sourceNavigable');
  });

  it('leaves navigability untouched when only the multiplicity changes', () => {
    let model = addRelationship(makeEmptyModel(), 'Unidirectional');
    model = modifyRelationship(model, { targetMultiplicity: '1' });
    const rel = onlyRelationship(model);
    expect(nav(rel)).toEqual([false, true]);
  });
});

describe('ClassDiagramConverter relationships', () => {
  const converter = new ClassDiagramConverter();

  it('emits explicit per-end navigability for every association', () => {
    const result: any = converter.convertCompleteSystem({
      classes: [
        { className: 'Order' },
        { className: 'Customer' },
        { className: 'OrderLine' },
        { className: 'VipCustomer' },
      ],
      relationships: [
        { type: 'Association', source: 'Order', target: 'Customer' },
        { type: 'Unidirectional', source: 'OrderLine', target: 'Customer' },
        { type: 'Composition', source: 'OrderLine', target: 'Order' },
        { type: 'Inheritance', source: 'VipCustomer', target: 'Customer' },
      ],
    });
    const rels = result.edges as any[];
    const byType = (type: string) => rels.filter((r) => r.type === type);

    expect(rels.some((r) => r.type === 'ClassUnidirectional')).toBe(false);
    const [assoc, uni] = byType('ClassBidirectional');
    expect(nav(assoc)).toEqual([true, true]);
    expect(nav(uni)).toEqual([false, true]);
    const [composition] = byType('ClassComposition');
    expect(composition.data.sourceNavigable).toBe(true);
    const [inheritance] = byType('ClassInheritance');
    expect(inheritance.data).not.toHaveProperty('sourceNavigable');
  });
});
