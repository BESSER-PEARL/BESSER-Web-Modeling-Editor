import { KG_CONSTRAINT_TARGET_CLASS, KG_CONSTRAINT_TARGET_PROPERTY, KG_SH_PROPERTY } from './types';
import type { KGNodeType } from './types';

export interface EdgePredicateDefault {
  /** Display label for the edge. Empty when the pair has no default. */
  label: string;
  /** Canonical predicate IRI, when one applies. */
  iri?: string;
}

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const RDFS_SUBCLASS_OF = 'http://www.w3.org/2000/01/rdf-schema#subClassOf';

/** Canonical predicate for a brand-new edge between these two node types.
 *
 *  Two things depend on getting this right:
 *  - Constraint links (`nodeConstraint` / `propertyConstraint` sources) must
 *    carry their internal `besser.local` IRI or the preflight reports the
 *    constraint as unattached.
 *  - `individual → class` and `class → class` default to rdf:type /
 *    rdfs:subClassOf so the orphan detector and the consistency check have a
 *    structurally meaningful triple to work with.
 *
 *  Returns `{ label: '' }` for pairs with no sensible default — the user
 *  names the predicate themselves in the inspector.
 *
 *  Shared by the canvas drag-to-connect gesture (`CytoscapeCanvas`) and the
 *  inspector's "Add connection" form, which must stay in agreement. */
export function defaultPredicateFor(
  source: KGNodeType | string | undefined,
  target: KGNodeType | string | undefined,
): EdgePredicateDefault {
  if (source === 'propertyConstraint' && target === 'property') {
    return { label: 'constraintTargetProperty', iri: KG_CONSTRAINT_TARGET_PROPERTY };
  }
  if (source === 'nodeConstraint' && target === 'class') {
    return { label: 'constraintTargetClass', iri: KG_CONSTRAINT_TARGET_CLASS };
  }
  if (source === 'nodeConstraint' && target === 'propertyConstraint') {
    return { label: 'property', iri: KG_SH_PROPERTY };
  }
  if (source === 'individual' && target === 'class') {
    return { label: 'type', iri: RDF_TYPE };
  }
  if (source === 'class' && target === 'class') {
    return { label: 'subClassOf', iri: RDFS_SUBCLASS_OF };
  }
  return { label: '' };
}
