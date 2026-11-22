import { describe, expect, it } from 'vitest';
import { defaultPredicateFor } from '../edge-defaults';
import {
  KG_CONSTRAINT_TARGET_CLASS,
  KG_CONSTRAINT_TARGET_PROPERTY,
  KG_SH_PROPERTY,
} from '../types';

describe('defaultPredicateFor', () => {
  it('tags constraint links with their internal IRIs', () => {
    // These IRIs are what the preflight looks for; without them a constraint
    // node reads as unattached no matter how it was wired up.
    expect(defaultPredicateFor('propertyConstraint', 'property')).toEqual({
      label: 'constraintTargetProperty',
      iri: KG_CONSTRAINT_TARGET_PROPERTY,
    });
    expect(defaultPredicateFor('nodeConstraint', 'class')).toEqual({
      label: 'constraintTargetClass',
      iri: KG_CONSTRAINT_TARGET_CLASS,
    });
    expect(defaultPredicateFor('nodeConstraint', 'propertyConstraint')).toEqual({
      label: 'property',
      iri: KG_SH_PROPERTY,
    });
  });

  it('defaults individual → class to rdf:type', () => {
    expect(defaultPredicateFor('individual', 'class')).toEqual({
      label: 'type',
      iri: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
    });
  });

  it('defaults class → class to rdfs:subClassOf', () => {
    expect(defaultPredicateFor('class', 'class')).toEqual({
      label: 'subClassOf',
      iri: 'http://www.w3.org/2000/01/rdf-schema#subClassOf',
    });
  });

  it('returns an empty label for pairs with no canonical predicate', () => {
    expect(defaultPredicateFor('individual', 'literal')).toEqual({ label: '' });
    expect(defaultPredicateFor('class', 'individual')).toEqual({ label: '' });
  });

  it('is direction-sensitive and tolerates unknown / missing types', () => {
    // The reverse of a defaulted pair must not inherit its predicate.
    expect(defaultPredicateFor('class', 'individual')).toEqual({ label: '' });
    expect(defaultPredicateFor(undefined, undefined)).toEqual({ label: '' });
    expect(defaultPredicateFor('', 'class')).toEqual({ label: '' });
  });
});
