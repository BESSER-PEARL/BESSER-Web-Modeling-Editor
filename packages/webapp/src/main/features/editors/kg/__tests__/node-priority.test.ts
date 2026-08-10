import { describe, expect, it } from 'vitest';
import {
  kgNodePriority,
  pickNodeIdsByPriority,
  sortIdsByPriority,
  sortNodesByPriority,
} from '../node-priority';
import type { KGNodeData, KGNodeType } from '../types';

function node(id: string, nodeType: KGNodeType): KGNodeData {
  return { id, nodeType, label: id };
}

/** One of each kind, deliberately in the *reverse* of the wanted order. */
const ONE_OF_EACH: KGNodeData[] = [
  node('lit', 'literal'),
  node('ind', 'individual'),
  node('pc', 'propertyConstraint'),
  node('nc', 'nodeConstraint'),
  node('blank', 'blank'),
  node('prop', 'property'),
  node('cls', 'class'),
];

const WANTED_ORDER = ['cls', 'prop', 'blank', 'nc', 'pc', 'ind', 'lit'];

describe('kgNodePriority', () => {
  it('ranks the node kinds in the display order', () => {
    expect(kgNodePriority('class')).toBeLessThan(kgNodePriority('property'));
    expect(kgNodePriority('property')).toBeLessThan(kgNodePriority('blank'));
    expect(kgNodePriority('blank')).toBeLessThan(kgNodePriority('nodeConstraint'));
    expect(kgNodePriority('nodeConstraint')).toBeLessThan(kgNodePriority('propertyConstraint'));
    expect(kgNodePriority('propertyConstraint')).toBeLessThan(kgNodePriority('individual'));
    expect(kgNodePriority('individual')).toBeLessThan(kgNodePriority('literal'));
  });

  it('sorts unknown / missing kinds last', () => {
    expect(kgNodePriority(undefined)).toBeGreaterThan(kgNodePriority('literal'));
    expect(kgNodePriority('mystery' as KGNodeType)).toBeGreaterThan(kgNodePriority('literal'));
  });
});

describe('sortNodesByPriority', () => {
  it('reorders a mixed list into the display order', () => {
    expect(sortNodesByPriority(ONE_OF_EACH).map((n) => n.id)).toEqual(WANTED_ORDER);
  });

  it('keeps model order within one kind (stable)', () => {
    const nodes = [node('c1', 'class'), node('l1', 'literal'), node('c2', 'class'), node('c3', 'class')];
    expect(sortNodesByPriority(nodes).map((n) => n.id)).toEqual(['c1', 'c2', 'c3', 'l1']);
  });

  it('does not mutate the input', () => {
    const nodes = [...ONE_OF_EACH];
    sortNodesByPriority(nodes);
    expect(nodes.map((n) => n.id)).toEqual(ONE_OF_EACH.map((n) => n.id));
  });
});

describe('pickNodeIdsByPriority', () => {
  it('spends a tight budget on the highest-priority kinds', () => {
    expect(pickNodeIdsByPriority(ONE_OF_EACH, 3)).toEqual(['cls', 'prop', 'blank']);
  });

  it('returns everything (reordered) when the limit exceeds the node count', () => {
    expect(pickNodeIdsByPriority(ONE_OF_EACH, 100)).toEqual(WANTED_ORDER);
  });

  it('returns nothing for a non-positive limit', () => {
    expect(pickNodeIdsByPriority(ONE_OF_EACH, 0)).toEqual([]);
    expect(pickNodeIdsByPriority(ONE_OF_EACH, -5)).toEqual([]);
  });
});

describe('sortIdsByPriority', () => {
  const byId = new Map(ONE_OF_EACH.map((n) => [n.id, n]));

  it('orders candidate ids by the kind of the node they name', () => {
    expect(sortIdsByPriority(['lit', 'cls', 'ind', 'prop'], byId)).toEqual([
      'cls',
      'prop',
      'ind',
      'lit',
    ]);
  });

  it('sorts ids with no matching node last, in their original order', () => {
    expect(sortIdsByPriority(['ghost', 'lit', 'phantom', 'cls'], byId)).toEqual([
      'cls',
      'lit',
      'ghost',
      'phantom',
    ]);
  });
});
