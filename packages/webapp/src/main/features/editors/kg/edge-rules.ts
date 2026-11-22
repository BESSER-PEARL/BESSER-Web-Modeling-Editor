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

import i18n from '../../../shared/i18n';

import type { KGNodeType } from './types';

/** The English `reason` strings below are the i18n `defaultValue`s; the live
 *  copy lives under `editors.kg.edgeRules.<type>.reason`. */
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

/** OWL / RDF / RDFS / XSD / SHACL framework namespaces. IRIs in these are
 *  *vocabulary* terms — `owl:Class`, `owl:Restriction`, `xsd:string`,
 *  `sh:NodeShape`, etc. — not user-modelled concepts. OWL2 DL's "punning"
 *  rule allows declarations like `:Foo rdf:type owl:Class` even though strict
 *  node-type rules would forbid the corresponding class → individual edge, so
 *  we short-circuit the gate whenever either endpoint is a vocabulary term.
 *  The same applies to a shape declaring `:MyShape rdf:type sh:NodeShape`.
 *
 *  Mirrors `_META_VOCAB_NAMESPACES` in
 *  `besser/BUML/notations/kg_to_buml/_common.py`. */
export const META_VOCAB_NAMESPACES = [
  'http://www.w3.org/2002/07/owl#',
  'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  'http://www.w3.org/2000/01/rdf-schema#',
  'http://www.w3.org/2001/XMLSchema#',
  'http://www.w3.org/ns/shacl#',
] as const;

export function isMetaVocab(iri: string | undefined | null): boolean {
  if (!iri) return false;
  return META_VOCAB_NAMESPACES.some((ns) => iri.startsWith(ns));
}

/** Short CURIE-style prefix per meta-vocabulary namespace. Used by the
 *  canvas to render vocabulary nodes as e.g. `owl:Class`, `xsd:string`. */
export const META_VOCAB_PREFIXES: Record<string, string> = {
  'http://www.w3.org/2002/07/owl#': 'owl',
  'http://www.w3.org/1999/02/22-rdf-syntax-ns#': 'rdf',
  'http://www.w3.org/2000/01/rdf-schema#': 'rdfs',
  'http://www.w3.org/2001/XMLSchema#': 'xsd',
  'http://www.w3.org/ns/shacl#': 'sh',
};

/** Returns the short prefix (`owl`, `rdf`, `rdfs`, `xsd`) for a meta-vocab
 *  IRI, or `null` if `iri` is not in any of the four namespaces. */
export function vocabPrefix(iri: string | undefined | null): string | null {
  if (!iri) return null;
  for (const ns of Object.keys(META_VOCAB_PREFIXES)) {
    if (iri.startsWith(ns)) return META_VOCAB_PREFIXES[ns];
  }
  return null;
}

/** Returns `<prefix>:<localName>` for a meta-vocab IRI, or `null` otherwise.
 *  When the IRI ends with the namespace exactly (no local part), returns
 *  just the prefix. */
export function formatVocabLabel(iri: string | undefined | null): string | null {
  if (!iri) return null;
  for (const ns of Object.keys(META_VOCAB_PREFIXES)) {
    if (iri.startsWith(ns)) {
      const local = iri.slice(ns.length);
      return local ? `${META_VOCAB_PREFIXES[ns]}:${local}` : META_VOCAB_PREFIXES[ns];
    }
  }
  return null;
}

export function isEdgeAllowed(
  source: KGNodeType,
  target: KGNodeType,
  sourceIri?: string | null,
  targetIri?: string | null,
): boolean {
  // Vocabulary-side carve-out for OWL "punning": either endpoint lying in the
  // owl/rdf/rdfs/xsd namespace bypasses the strict node-type matrix. Without
  // this, edges like `:Person rdf:type owl:Class` couldn't be authored by
  // hand even though they're the standard way OWL declares a class.
  if (isMetaVocab(sourceIri) || isMetaVocab(targetIri)) return true;
  return KG_EDGE_RULES[source]?.allowed.includes(target) ?? false;
}

/** Rejection message for a disallowed source → target pair.
 *
 *  Reads the i18n singleton rather than taking a `t` parameter: the only
 *  caller is the Cytoscape `canConnect` gesture callback, which is registered
 *  once at canvas init — a captured `t` would go stale on a language switch.
 *  Render-time consumers must use `edgeRuleReason()` from `./i18n-keys`
 *  instead, so the string stays subscribed to `useTranslation`. */
export function explainEdgeRejection(source: KGNodeType, target: KGNodeType): string {
  const rule = KG_EDGE_RULES[source];
  if (rule) {
    return i18n.t(`editors.kg.edgeRules.${source}.reason`, { defaultValue: rule.reason });
  }
  return i18n.t('editors.kg.edgeRules.genericRejection', {
    source,
    target,
    defaultValue: `Connections from "${source}" to "${target}" are not allowed under OWL2 DL.`,
  });
}

/** Inverse lookup: which source node types are allowed to point AT `target`?
 *  Used by the inspector's "Add connection" form when the user picks an
 *  incoming direction. */
export function sourceTypesAllowedToTarget(target: KGNodeType): KGNodeType[] {
  return (Object.entries(KG_EDGE_RULES) as [KGNodeType, { allowed: KGNodeType[] }][])
    .filter(([, rule]) => rule.allowed.includes(target))
    .map(([src]) => src);
}
