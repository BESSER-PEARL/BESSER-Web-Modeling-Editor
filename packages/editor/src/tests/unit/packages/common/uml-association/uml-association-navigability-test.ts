import { backwardsCompatibleModel } from '../../../../../main/compat';
import { ModelState } from '../../../../../main/components/store/model-state';
import { UMLModel, UMLRelationship } from '../../../../../main/typings';
import { UMLRelationships } from '../../../../../main/packages/uml-relationships';
import { UMLAssociation } from '../../../../../main/packages/common/uml-association/uml-association';
import {
  canToggleNavigability,
  normalizeAssociationNavigability,
  resolveAssociationNavigability,
} from '../../../../../main/packages/common/uml-association/uml-association-navigability';

const end = (element: string, navigable?: boolean) => ({
  element,
  direction: 'Up',
  multiplicity: '',
  role: '',
  ...(navigable === undefined ? {} : { navigable }),
});

const relationship = (id: string, type: string, sourceNavigable?: boolean, targetNavigable?: boolean) =>
  ({
    id,
    name: '',
    type,
    owner: null,
    bounds: { x: 0, y: 0, width: 100, height: 1 },
    path: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ],
    source: end('a', sourceNavigable),
    target: end('b', targetNavigable),
  }) as unknown as UMLRelationship;

const model = (...relationships: UMLRelationship[]): UMLModel =>
  ({
    version: '3.0.0',
    type: 'ClassDiagram',
    size: { width: 0, height: 0 },
    interactive: { elements: {}, relationships: {} },
    elements: {},
    relationships: Object.fromEntries(relationships.map((r) => [r.id, r])),
    assessments: {},
  }) as UMLModel;

describe('association navigability migration', () => {
  it('loads a legacy ClassUnidirectional as ClassBidirectional with the source end not navigable', () => {
    const migrated = backwardsCompatibleModel(model(relationship('r', 'ClassUnidirectional')));
    const r = migrated.relationships.r as any;
    expect(r.type).toEqual('ClassBidirectional');
    expect(r.source.navigable).toBe(false);
    expect(r.target.navigable).toBe(true);
  });

  it('fills in both ends navigable for a ClassBidirectional without flags', () => {
    const migrated = backwardsCompatibleModel(model(relationship('r', 'ClassBidirectional')));
    const r = migrated.relationships.r as any;
    expect(r.type).toEqual('ClassBidirectional');
    expect(r.source.navigable).toBe(true);
    expect(r.target.navigable).toBe(true);
  });

  it('keeps explicit flags and returns an already normalized model unchanged', () => {
    const input = model(relationship('r', 'ClassBidirectional', false, true), relationship('d', 'ClassDependency'));
    expect(backwardsCompatibleModel(input)).toBe(input);
  });

  it('repairs invalid flags (composition part end, both ends off)', () => {
    const migrated = backwardsCompatibleModel(
      model(relationship('c', 'ClassComposition', false, true), relationship('b', 'ClassBidirectional', false, false)),
    );
    expect((migrated.relationships.c as any).source.navigable).toBe(true);
    expect((migrated.relationships.b as any).target.navigable).toBe(true);
  });

  it('deserializes legacy data into the new shape', () => {
    const state = ModelState.fromModel(
      model(relationship('u', 'ClassUnidirectional'), relationship('b', 'ClassBidirectional')),
    );
    const u = state.elements!.u as any;
    const b = state.elements!.b as any;
    expect(u.type).toEqual('ClassBidirectional');
    expect([u.source.navigable, u.target.navigable]).toEqual([false, true]);
    expect([b.source.navigable, b.target.navigable]).toEqual([true, true]);
  });

  it('builds a runtime ClassUnidirectional as a plain association with the legacy navigability', () => {
    const created = new UMLRelationships.ClassUnidirectional({ source: { element: 'a' }, target: { element: 'b' } });
    expect(created.type).toEqual('ClassBidirectional');
    expect((created as UMLAssociation).source.navigable).toBe(false);
    expect((created as UMLAssociation).target.navigable).toBe(true);
    expect((created.serialize() as any).type).toEqual('ClassBidirectional');
  });
});

describe('navigability rules', () => {
  it('resolves legacy defaults', () => {
    expect(resolveAssociationNavigability({ type: 'ClassUnidirectional', source: {}, target: {} })).toEqual({
      source: false,
      target: true,
    });
    expect(resolveAssociationNavigability({ type: 'ClassAggregation', source: {}, target: {} })).toEqual({
      source: true,
      target: true,
    });
  });

  it('never lets the last navigable end or the composition part end be switched off', () => {
    const oneWay = { type: 'ClassBidirectional', source: { navigable: false }, target: { navigable: true } };
    expect(canToggleNavigability(oneWay, 'source')).toBe(true);
    expect(canToggleNavigability(oneWay, 'target')).toBe(false);
    const composition = { type: 'ClassComposition', source: { navigable: true }, target: { navigable: true } };
    expect(canToggleNavigability(composition, 'source')).toBe(false);
    expect(canToggleNavigability(composition, 'target')).toBe(true);
  });

  it('leaves relationships without navigability untouched', () => {
    const dependency = { type: 'ClassDependency', source: {}, target: {} };
    expect(normalizeAssociationNavigability(dependency)).toBe(dependency);
  });
});
