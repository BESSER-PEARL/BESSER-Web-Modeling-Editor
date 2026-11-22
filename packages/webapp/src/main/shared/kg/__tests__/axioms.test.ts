import { describe, expect, it } from 'vitest';

import { axiomKey, mergeAxioms, pruneAxioms, remapAxiomNodeIds } from '../axioms';
import type { KGAxiom } from '../../types/project';

const equivalent = (...ids: string[]): KGAxiom => ({ kind: 'EquivalentClassesAxiom', class_ids: ids });
const subProp = (sub: string, sup: string): KGAxiom => ({
  kind: 'SubPropertyOfAxiom',
  sub_property_id: sub,
  super_property_id: sup,
});

describe('remapAxiomNodeIds', () => {
  const remap = new Map([['b', 'b#imported']]);

  it('renames ids in list fields and in single fields', () => {
    expect(remapAxiomNodeIds(equivalent('a', 'b'), remap)).toEqual(equivalent('a', 'b#imported'));
    expect(remapAxiomNodeIds(subProp('b', 'a'), remap)).toEqual(subProp('b#imported', 'a'));
  });

  it('renames every id field of a kind that has several', () => {
    const union: KGAxiom = { kind: 'DisjointUnionAxiom', union_class_id: 'b', part_class_ids: ['a', 'b'] };

    expect(remapAxiomNodeIds(union, remap)).toEqual({
      kind: 'DisjointUnionAxiom',
      union_class_id: 'b#imported',
      part_class_ids: ['a', 'b#imported'],
    });
  });

  it('returns the same object when no id is renamed', () => {
    const axiom = equivalent('a', 'c');

    expect(remapAxiomNodeIds(axiom, remap)).toBe(axiom);
  });

  it('never touches IRI strings, which are not node ids', () => {
    const imports: KGAxiom = { kind: 'ImportAxiom', target_iri: 'b', source_ontology_iri: 'b' };

    expect(remapAxiomNodeIds(imports, remap)).toBe(imports);
  });

  it('does not mutate its input', () => {
    const axiom = equivalent('a', 'b');
    remapAxiomNodeIds(axiom, remap);

    expect(axiom).toEqual(equivalent('a', 'b'));
  });

  it('renames in a kind it does not know, by value', () => {
    const unknown: KGAxiom = { kind: 'FutureAxiom', some_id: 'b', some_ids: ['a', 'b'], note: 'b' };

    expect(remapAxiomNodeIds(unknown, remap)).toEqual({
      kind: 'FutureAxiom',
      some_id: 'b#imported',
      some_ids: ['a', 'b#imported'],
      note: 'b',
    });
  });
});

describe('pruneAxioms (a node was deleted)', () => {
  it('keeps axioms that mention no deleted node, as the same array', () => {
    const axioms = [equivalent('a', 'b'), subProp('p', 'q')];

    expect(pruneAxioms(axioms, new Set(['zzz']))).toBe(axioms);
  });

  it('drops an equivalence of two classes when one of them is deleted', () => {
    expect(pruneAxioms([equivalent('a', 'b')], new Set(['b']))).toEqual([]);
  });

  it('keeps the rest of a larger equivalence', () => {
    expect(pruneAxioms([equivalent('a', 'b', 'c')], new Set(['b']))).toEqual([equivalent('a', 'c')]);
  });

  it('drops an axiom that relates exactly the deleted node', () => {
    expect(pruneAxioms([subProp('p', 'q')], new Set(['q']))).toEqual([]);
    expect(pruneAxioms([{ kind: 'InversePropertiesAxiom', property_a_id: 'p', property_b_id: 'q' }], new Set(['p']))).toEqual([]);
  });

  it('drops a disjoint union whose union class is deleted, and trims one that lost a part', () => {
    const union: KGAxiom = { kind: 'DisjointUnionAxiom', union_class_id: 'u', part_class_ids: ['a', 'b'] };

    expect(pruneAxioms([union], new Set(['u']))).toEqual([]);
    expect(pruneAxioms([union], new Set(['a']))).toEqual([{ ...union, part_class_ids: ['b'] }]);
    expect(pruneAxioms([union], new Set(['a', 'b']))).toEqual([]);
  });

  it('drops a chain or key whose list became empty, or whose owner is deleted', () => {
    const chain: KGAxiom = { kind: 'PropertyChainAxiom', property_id: 'p', chain_property_ids: ['x', 'y'] };
    const key: KGAxiom = { kind: 'HasKeyAxiom', class_id: 'c', property_ids: ['k'] };

    expect(pruneAxioms([chain], new Set(['x']))).toEqual([{ ...chain, chain_property_ids: ['y'] }]);
    expect(pruneAxioms([chain], new Set(['x', 'y']))).toEqual([]);
    expect(pruneAxioms([chain], new Set(['p']))).toEqual([]);
    expect(pruneAxioms([key], new Set(['k']))).toEqual([]);
    expect(pruneAxioms([key], new Set(['c']))).toEqual([]);
  });

  it('keeps an import declaration, which refers to no node', () => {
    const imports: KGAxiom = { kind: 'ImportAxiom', target_iri: 'http://x/y' };

    expect(pruneAxioms([imports], new Set(['http://x/y']))).toEqual([imports]);
  });

  it('drops an axiom of an unknown kind that mentions the node anywhere', () => {
    const unknown: KGAxiom = { kind: 'FutureAxiom', some_ids: ['a', 'b'] };

    expect(pruneAxioms([unknown], new Set(['b']))).toEqual([]);
    expect(pruneAxioms([unknown], new Set(['c']))).toEqual([unknown]);
  });
});

describe('mergeAxioms', () => {
  it('appends the incoming axioms, renamed to the merged ids', () => {
    const merged = mergeAxioms([equivalent('a', 'b')], [subProp('p', 'q')], new Map([['q', 'q#imported']]));

    expect(merged).toEqual([equivalent('a', 'b'), subProp('p', 'q#imported')]);
  });

  it('leaves out an incoming axiom the graph already has', () => {
    const merged = mergeAxioms([equivalent('a', 'b')], [equivalent('a', 'b'), subProp('p', 'q')], new Map());

    expect(merged).toEqual([equivalent('a', 'b'), subProp('p', 'q')]);
  });

  it('treats the same axiom with the same ids in another order as the same', () => {
    expect(axiomKey(equivalent('a', 'b'))).toBe(axiomKey(equivalent('b', 'a')));
    expect(axiomKey(subProp('p', 'q'))).not.toBe(axiomKey(subProp('q', 'p')));
  });

  it('copes with a graph that has no axioms yet', () => {
    expect(mergeAxioms(undefined, [subProp('p', 'q')], new Map())).toEqual([subProp('p', 'q')]);
    expect(mergeAxioms([subProp('p', 'q')], undefined, new Map())).toEqual([subProp('p', 'q')]);
    expect(mergeAxioms(undefined, undefined, new Map())).toBeUndefined();
  });
});
