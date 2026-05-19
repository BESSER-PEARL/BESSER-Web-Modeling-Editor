/** OWL2 DL edge-creation rules.
 *
 * Single source of truth for which source → target node-type combinations are
 * allowed when the user authors a new edge — either via the canvas
 * click-connect handler or via the inspector's "Add connection" form. Existing
 * edges (e.g. imported from external ontologies that happen to violate a rule)
 * are not retroactively removed; this only blocks NEW creation.
 *
 * Rationale per source kind: see the README / the plan that introduced this
 * file for the full justification. Highlights:
 *  - Literals can never be subjects of an RDF triple → empty allowed set.
 *  - Class is a TBox concept; standard OWL predicates connect class↔class or
 *    class↔(blank class expression). No edges to individuals/properties/literals.
 *  - Property is a TBox concept; domain/range to class, sub/equiv/inverse to
 *    other properties, ranges may be anonymous class expressions (blank).
 *  - Individual is an ABox node; rdf:type → class, object props → individuals
 *    or blanks, datatype props → literals.
 *  - Blank nodes (anonymous resources / class expressions / list spines) can
 *    reference any non-constraint node.
 *  - Constraint nodes only point at their declared targets (existing rules).
 */

import type { KGNodeType } from './types';

export const KG_EDGE_RULES: Record<KGNodeType, { allowed: KGNodeType[]; reason: string }> = {
  class: {
    allowed: ['class', 'blank'],
    reason:
      'A class can only link to another class or to a blank node (class expression).',
  },
  individual: {
    allowed: ['class', 'individual', 'literal', 'blank'],
    reason:
      'An individual can link to a class (rdf:type), other individuals or blank nodes (object properties), or literals (datatype properties).',
  },
  property: {
    allowed: ['class', 'property', 'blank'],
    reason:
      'A property can link to a class (rdfs:domain / rdfs:range), to another property (subPropertyOf / inverseOf / equivalentProperty), or to a blank node (anonymous class expression).',
  },
  literal: {
    allowed: [],
    reason: 'A literal cannot be the subject of an OWL/RDF relation.',
  },
  blank: {
    allowed: ['class', 'individual', 'property', 'literal', 'blank'],
    reason:
      'A blank node (anonymous resource) may reference any non-constraint node.',
  },
  nodeConstraint: {
    allowed: ['class', 'propertyConstraint'],
    reason:
      'A NodeConstraint can only target a class (constraintTargetClass) or group a PropertyConstraint (sh:property).',
  },
  propertyConstraint: {
    allowed: ['property'],
    reason:
      'A PropertyConstraint can only target a property (constraintTargetProperty).',
  },
};

export function isEdgeAllowed(source: KGNodeType, target: KGNodeType): boolean {
  return KG_EDGE_RULES[source]?.allowed.includes(target) ?? false;
}

export function explainEdgeRejection(source: KGNodeType, target: KGNodeType): string {
  return (
    KG_EDGE_RULES[source]?.reason ??
    `Connections from "${source}" to "${target}" are not allowed under OWL2 DL.`
  );
}

/** Inverse lookup: which source node types are allowed to point AT `target`?
 *  Used by the inspector's "Add connection" form when the user picks an
 *  incoming direction. */
export function sourceTypesAllowedToTarget(target: KGNodeType): KGNodeType[] {
  return (Object.entries(KG_EDGE_RULES) as [KGNodeType, { allowed: KGNodeType[] }][])
    .filter(([, rule]) => rule.allowed.includes(target))
    .map(([src]) => src);
}
