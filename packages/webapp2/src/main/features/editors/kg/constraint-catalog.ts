/** Catalog of OWL2 / SHACL Core constraints exposed in the KG editor.
 *
 * Each entry pairs:
 *  - the normalised `kind` discriminator written to `metadata.constraintSpecs`,
 *  - the plain-English `label` shown in the picker and as the spec-row title,
 *  - the OWL / SHACL vocabulary terms (for tooltips and for the export
 *    selector to decide which constraints to emit at which vocab),
 *  - the `valueShape` that determines which value editor to render, and
 *  - context filters: `applicableTo` (NC / PC) and `hiddenWhen.targetPropertyKind`
 *    (Object vs Datatype) so the picker only surfaces relevant options.
 *
 * Mirrors the backend `CONSTRAINT_VOCAB_MAP` / `CONSTRAINT_CATEGORY` tables
 * in `besser/BUML/metamodel/kg/constraint_specs.py`.
 */

export type ConstraintKind = string;

export type Vocab = 'owl' | 'shacl';

export type ConstraintCategory =
  | 'cardinality'
  | 'value'
  | 'datatype'
  | 'enumeration'
  | 'logical'
  | 'classAxiom'
  | 'meta';

export type ValueShape =
  | 'int'
  | 'number'
  | 'string'
  | 'boolean'
  | 'iri'
  | 'class-iri'
  | 'property-iri'
  | 'datatype-iri'
  | 'iri-list'
  | 'literal-list'
  | 'class-iri-list'
  | 'property-iri-list'
  | 'language-list'
  | 'regex'
  | 'literal'
  | 'min-max'
  | 'qualified-cardinality'
  | 'node-kind'
  | 'severity'
  | 'nested-specs';

export interface ConstraintCatalogEntry {
  kind: ConstraintKind;
  label: string;
  description: string;
  category: ConstraintCategory;
  vocab: Vocab[];
  valueShape: ValueShape;
  applicableTo: Array<'nodeConstraint' | 'propertyConstraint'>;
  hiddenWhen?: {
    targetPropertyKind?: 'Object' | 'Datatype';
  };
  /** OWL term shown in the OWL tooltip / chip details. */
  owlTerm?: string;
  /** SHACL term shown in the SHACL tooltip / chip details. */
  shaclTerm?: string;
}

const PC: Array<'propertyConstraint'> = ['propertyConstraint'];
const NC: Array<'nodeConstraint'> = ['nodeConstraint'];
const BOTH: Array<'nodeConstraint' | 'propertyConstraint'> = ['nodeConstraint', 'propertyConstraint'];

export const CONSTRAINT_CATALOG: ConstraintCatalogEntry[] = [
  // --- Cardinality ---------------------------------------------------------
  {
    kind: 'minCardinality',
    label: 'At least N values',
    description: 'The property must have at least N values per instance.',
    category: 'cardinality',
    vocab: ['owl', 'shacl'],
    valueShape: 'int',
    applicableTo: PC,
    owlTerm: 'owl:minCardinality',
    shaclTerm: 'sh:minCount',
  },
  {
    kind: 'maxCardinality',
    label: 'At most N values',
    description: 'The property may have at most N values per instance.',
    category: 'cardinality',
    vocab: ['owl', 'shacl'],
    valueShape: 'int',
    applicableTo: PC,
    owlTerm: 'owl:maxCardinality',
    shaclTerm: 'sh:maxCount',
  },
  {
    kind: 'exactCardinality',
    label: 'Exactly N values',
    description: 'The property must have exactly N values per instance.',
    category: 'cardinality',
    vocab: ['owl'],
    valueShape: 'int',
    applicableTo: PC,
    owlTerm: 'owl:cardinality',
  },
  {
    kind: 'minQualifiedCardinality',
    label: 'At least N of class X',
    description: 'At least N values must be instances of the chosen class.',
    category: 'cardinality',
    vocab: ['owl', 'shacl'],
    valueShape: 'qualified-cardinality',
    applicableTo: PC,
    owlTerm: 'owl:minQualifiedCardinality + owl:onClass',
    shaclTerm: 'sh:qualifiedMinCount + sh:qualifiedValueShape',
  },
  {
    kind: 'maxQualifiedCardinality',
    label: 'At most N of class X',
    description: 'At most N values may be instances of the chosen class.',
    category: 'cardinality',
    vocab: ['owl', 'shacl'],
    valueShape: 'qualified-cardinality',
    applicableTo: PC,
    owlTerm: 'owl:maxQualifiedCardinality + owl:onClass',
    shaclTerm: 'sh:qualifiedMaxCount + sh:qualifiedValueShape',
  },
  {
    kind: 'exactQualifiedCardinality',
    label: 'Exactly N of class X',
    description: 'Exactly N values must be instances of the chosen class.',
    category: 'cardinality',
    vocab: ['owl'],
    valueShape: 'qualified-cardinality',
    applicableTo: PC,
    owlTerm: 'owl:qualifiedCardinality + owl:onClass',
  },

  // --- Value (PC) ----------------------------------------------------------
  {
    kind: 'someValuesFrom',
    label: 'Some value must be a …',
    description: 'At least one value must be an instance of the chosen class.',
    category: 'value',
    vocab: ['owl', 'shacl'],
    valueShape: 'class-iri',
    applicableTo: PC,
    hiddenWhen: { targetPropertyKind: 'Datatype' },
    owlTerm: 'owl:someValuesFrom',
    shaclTerm: 'sh:class (+ sh:qualifiedValueShape)',
  },
  {
    kind: 'allValuesFrom',
    label: 'All values must be a …',
    description: 'Every value must be an instance of the chosen class.',
    category: 'value',
    vocab: ['owl'],
    valueShape: 'class-iri',
    applicableTo: PC,
    hiddenWhen: { targetPropertyKind: 'Datatype' },
    owlTerm: 'owl:allValuesFrom',
  },
  {
    kind: 'hasValue',
    label: 'Must equal',
    description: 'The property must have this specific value (literal or IRI).',
    category: 'value',
    vocab: ['owl', 'shacl'],
    valueShape: 'literal',
    applicableTo: PC,
    owlTerm: 'owl:hasValue',
    shaclTerm: 'sh:hasValue',
  },
  {
    kind: 'hasSelf',
    label: 'Is reflexive',
    description: 'The property relates each individual to itself.',
    category: 'value',
    vocab: ['owl'],
    valueShape: 'boolean',
    applicableTo: PC,
    hiddenWhen: { targetPropertyKind: 'Datatype' },
    owlTerm: 'owl:hasSelf',
  },
  {
    kind: 'nodeKind',
    label: 'Value must be a …',
    description: 'Restrict the kind of node a value can take (IRI, BlankNode, Literal).',
    category: 'value',
    vocab: ['shacl'],
    valueShape: 'node-kind',
    applicableTo: PC,
    shaclTerm: 'sh:nodeKind',
  },

  // --- Datatype / literal (PC, datatype-only) ------------------------------
  {
    kind: 'datatype',
    label: 'Of datatype',
    description: 'Values must be literals of the chosen XSD datatype.',
    category: 'datatype',
    vocab: ['shacl'],
    valueShape: 'datatype-iri',
    applicableTo: PC,
    hiddenWhen: { targetPropertyKind: 'Object' },
    shaclTerm: 'sh:datatype',
  },
  {
    kind: 'pattern',
    label: 'Matches pattern',
    description: 'String values must match this regular expression.',
    category: 'datatype',
    vocab: ['shacl'],
    valueShape: 'regex',
    applicableTo: PC,
    hiddenWhen: { targetPropertyKind: 'Object' },
    shaclTerm: 'sh:pattern',
  },
  {
    kind: 'flags',
    label: 'Pattern flags',
    description: 'Regex flags applied to sh:pattern (e.g. "i" for case-insensitive).',
    category: 'datatype',
    vocab: ['shacl'],
    valueShape: 'string',
    applicableTo: PC,
    hiddenWhen: { targetPropertyKind: 'Object' },
    shaclTerm: 'sh:flags',
  },
  {
    kind: 'minLength',
    label: 'Length is at least N',
    description: 'String length must be at least N characters.',
    category: 'datatype',
    vocab: ['shacl'],
    valueShape: 'int',
    applicableTo: PC,
    hiddenWhen: { targetPropertyKind: 'Object' },
    shaclTerm: 'sh:minLength',
  },
  {
    kind: 'maxLength',
    label: 'Length is at most N',
    description: 'String length must be at most N characters.',
    category: 'datatype',
    vocab: ['shacl'],
    valueShape: 'int',
    applicableTo: PC,
    hiddenWhen: { targetPropertyKind: 'Object' },
    shaclTerm: 'sh:maxLength',
  },
  {
    kind: 'minInclusive',
    label: 'Value ≥ N',
    description: 'Numeric / date values must be at least N (inclusive).',
    category: 'datatype',
    vocab: ['shacl'],
    valueShape: 'number',
    applicableTo: PC,
    hiddenWhen: { targetPropertyKind: 'Object' },
    shaclTerm: 'sh:minInclusive',
  },
  {
    kind: 'maxInclusive',
    label: 'Value ≤ N',
    description: 'Numeric / date values must be at most N (inclusive).',
    category: 'datatype',
    vocab: ['shacl'],
    valueShape: 'number',
    applicableTo: PC,
    hiddenWhen: { targetPropertyKind: 'Object' },
    shaclTerm: 'sh:maxInclusive',
  },
  {
    kind: 'minExclusive',
    label: 'Value > N',
    description: 'Numeric / date values must be strictly greater than N.',
    category: 'datatype',
    vocab: ['shacl'],
    valueShape: 'number',
    applicableTo: PC,
    hiddenWhen: { targetPropertyKind: 'Object' },
    shaclTerm: 'sh:minExclusive',
  },
  {
    kind: 'maxExclusive',
    label: 'Value < N',
    description: 'Numeric / date values must be strictly less than N.',
    category: 'datatype',
    vocab: ['shacl'],
    valueShape: 'number',
    applicableTo: PC,
    hiddenWhen: { targetPropertyKind: 'Object' },
    shaclTerm: 'sh:maxExclusive',
  },
  {
    kind: 'languageIn',
    label: 'Allowed languages',
    description: 'Language-tagged literal values must use one of the listed BCP-47 tags.',
    category: 'datatype',
    vocab: ['shacl'],
    valueShape: 'language-list',
    applicableTo: PC,
    hiddenWhen: { targetPropertyKind: 'Object' },
    shaclTerm: 'sh:languageIn',
  },
  {
    kind: 'uniqueLang',
    label: 'Each language at most once',
    description: 'No two language-tagged values may share a language tag.',
    category: 'datatype',
    vocab: ['shacl'],
    valueShape: 'boolean',
    applicableTo: PC,
    hiddenWhen: { targetPropertyKind: 'Object' },
    shaclTerm: 'sh:uniqueLang',
  },

  // --- Enumeration (NC + PC) -----------------------------------------------
  {
    kind: 'in',
    label: 'One of these values',
    description: 'Values must be one of an enumerated list.',
    category: 'enumeration',
    vocab: ['owl', 'shacl'],
    valueShape: 'literal-list',
    applicableTo: BOTH,
    owlTerm: 'owl:oneOf (over individuals)',
    shaclTerm: 'sh:in',
  },
  {
    kind: 'oneOf',
    label: 'One of these individuals',
    description: 'Class is the enumerated set of these individuals.',
    category: 'enumeration',
    vocab: ['owl', 'shacl'],
    valueShape: 'iri-list',
    applicableTo: NC,
    owlTerm: 'owl:oneOf',
    shaclTerm: 'sh:in',
  },

  // --- Logical -------------------------------------------------------------
  {
    kind: 'shaclNot',
    label: 'Must NOT satisfy',
    description: 'The value must NOT satisfy the inner constraint shape.',
    category: 'logical',
    vocab: ['shacl'],
    valueShape: 'nested-specs',
    applicableTo: BOTH,
    shaclTerm: 'sh:not',
  },
  {
    kind: 'shaclAnd',
    label: 'Must satisfy ALL of',
    description: 'The value must satisfy every inner constraint shape.',
    category: 'logical',
    vocab: ['shacl'],
    valueShape: 'nested-specs',
    applicableTo: BOTH,
    shaclTerm: 'sh:and',
  },
  {
    kind: 'shaclOr',
    label: 'Must satisfy ANY of',
    description: 'The value must satisfy at least one inner constraint shape.',
    category: 'logical',
    vocab: ['shacl'],
    valueShape: 'nested-specs',
    applicableTo: BOTH,
    shaclTerm: 'sh:or',
  },
  {
    kind: 'shaclXone',
    label: 'Must satisfy EXACTLY ONE of',
    description: 'The value must satisfy exactly one of the inner constraint shapes.',
    category: 'logical',
    vocab: ['shacl'],
    valueShape: 'nested-specs',
    applicableTo: BOTH,
    shaclTerm: 'sh:xone',
  },

  // --- Class axioms (NC) ---------------------------------------------------
  {
    kind: 'equivalentClasses',
    label: 'Equivalent to',
    description: 'These classes share all instances.',
    category: 'classAxiom',
    vocab: ['owl'],
    valueShape: 'class-iri-list',
    applicableTo: NC,
    owlTerm: 'owl:equivalentClass',
  },
  {
    kind: 'disjointWith',
    label: 'Disjoint with',
    description: 'No instance may belong to both classes simultaneously.',
    category: 'classAxiom',
    vocab: ['owl', 'shacl'],
    valueShape: 'class-iri-list',
    applicableTo: NC,
    owlTerm: 'owl:disjointWith / owl:AllDisjointClasses',
    shaclTerm: 'sh:disjoint',
  },
  {
    kind: 'disjointUnionOf',
    label: 'Disjoint union of',
    description: 'Class is the disjoint union of the listed classes.',
    category: 'classAxiom',
    vocab: ['owl'],
    valueShape: 'class-iri-list',
    applicableTo: NC,
    owlTerm: 'owl:disjointUnionOf',
  },
  {
    kind: 'subClassOf',
    label: 'Sub-class of',
    description: 'This class is a specialisation of another class.',
    category: 'classAxiom',
    vocab: ['owl'],
    valueShape: 'class-iri',
    applicableTo: NC,
    owlTerm: 'rdfs:subClassOf',
  },
  {
    kind: 'complementOf',
    label: 'Complement of',
    description: 'Class is the set complement of another class.',
    category: 'classAxiom',
    vocab: ['owl', 'shacl'],
    valueShape: 'class-iri',
    applicableTo: NC,
    owlTerm: 'owl:complementOf',
    shaclTerm: 'sh:not',
  },
  {
    kind: 'unionOf',
    label: 'Union of',
    description: 'Class is the union of the listed classes.',
    category: 'classAxiom',
    vocab: ['owl', 'shacl'],
    valueShape: 'class-iri-list',
    applicableTo: NC,
    owlTerm: 'owl:unionOf',
    shaclTerm: 'sh:or',
  },
  {
    kind: 'intersectionOf',
    label: 'Intersection of',
    description: 'Class is the intersection of the listed classes.',
    category: 'classAxiom',
    vocab: ['owl', 'shacl'],
    valueShape: 'class-iri-list',
    applicableTo: NC,
    owlTerm: 'owl:intersectionOf',
    shaclTerm: 'sh:and',
  },
  {
    kind: 'hasKey',
    label: 'Key properties (uniquely identifies)',
    description: 'The listed properties together uniquely identify each instance.',
    category: 'classAxiom',
    vocab: ['owl'],
    valueShape: 'property-iri-list',
    applicableTo: NC,
    owlTerm: 'owl:hasKey',
  },
  {
    kind: 'shaclClosed',
    label: 'Closed shape (no extra properties)',
    description: 'Instances may not carry properties beyond those listed in this shape.',
    category: 'classAxiom',
    vocab: ['shacl'],
    valueShape: 'boolean',
    applicableTo: NC,
    shaclTerm: 'sh:closed',
  },
  {
    kind: 'shaclIgnoredProperties',
    label: 'Ignored properties (closed-shape exceptions)',
    description: 'Properties allowed even when the shape is closed.',
    category: 'classAxiom',
    vocab: ['shacl'],
    valueShape: 'property-iri-list',
    applicableTo: NC,
    shaclTerm: 'sh:ignoredProperties',
  },

  // --- Meta (SHACL) --------------------------------------------------------
  {
    kind: 'shaclSeverity',
    label: 'Severity',
    description: 'Severity of a SHACL validation result that fails this constraint.',
    category: 'meta',
    vocab: ['shacl'],
    valueShape: 'severity',
    applicableTo: BOTH,
    shaclTerm: 'sh:severity',
  },
  {
    kind: 'shaclMessage',
    label: 'Custom message',
    description: 'Human-readable message attached to a validation result.',
    category: 'meta',
    vocab: ['shacl'],
    valueShape: 'string',
    applicableTo: BOTH,
    shaclTerm: 'sh:message',
  },
  {
    kind: 'shaclName',
    label: 'Human-readable name',
    description: 'Display name surfaced by SHACL-aware UIs.',
    category: 'meta',
    vocab: ['shacl'],
    valueShape: 'string',
    applicableTo: BOTH,
    shaclTerm: 'sh:name',
  },
  {
    kind: 'shaclDescription',
    label: 'Description',
    description: 'Free-form description for documentation purposes.',
    category: 'meta',
    vocab: ['shacl'],
    valueShape: 'string',
    applicableTo: BOTH,
    shaclTerm: 'sh:description',
  },
  {
    kind: 'shaclDeactivated',
    label: 'Disabled',
    description: 'When true, validators skip this shape.',
    category: 'meta',
    vocab: ['shacl'],
    valueShape: 'boolean',
    applicableTo: BOTH,
    shaclTerm: 'sh:deactivated',
  },
  {
    kind: 'shaclOrder',
    label: 'Display order',
    description: 'Hint for UI ordering of shapes.',
    category: 'meta',
    vocab: ['shacl'],
    valueShape: 'number',
    applicableTo: BOTH,
    shaclTerm: 'sh:order',
  },
  {
    kind: 'shaclGroup',
    label: 'Group',
    description: 'IRI of a sh:PropertyGroup this shape belongs to.',
    category: 'meta',
    vocab: ['shacl'],
    valueShape: 'iri',
    applicableTo: BOTH,
    shaclTerm: 'sh:group',
  },
];

export const CONSTRAINT_BY_KIND: Map<string, ConstraintCatalogEntry> = new Map(
  CONSTRAINT_CATALOG.map((c) => [c.kind, c]),
);

export const CATEGORY_LABELS: Record<ConstraintCategory, string> = {
  cardinality: 'Cardinality',
  value: 'Value',
  datatype: 'Datatype & format',
  enumeration: 'Enumeration',
  logical: 'Logical',
  classAxiom: 'Class axioms',
  meta: 'Metadata',
};

export const CATEGORY_ORDER: ConstraintCategory[] = [
  'cardinality',
  'value',
  'datatype',
  'enumeration',
  'logical',
  'classAxiom',
  'meta',
];

export interface PickerContext {
  nodeType: 'nodeConstraint' | 'propertyConstraint';
  /** When the constraint is attached to a property, its kind (Object / Datatype)
   *  filters out irrelevant entries from the picker. */
  targetPropertyKind?: 'Object' | 'Datatype';
}

/** Visible catalog entries for the current inspector context. */
export function filterCatalog(ctx: PickerContext): ConstraintCatalogEntry[] {
  return CONSTRAINT_CATALOG.filter((entry) => {
    if (!entry.applicableTo.includes(ctx.nodeType)) return false;
    if (ctx.targetPropertyKind && entry.hiddenWhen?.targetPropertyKind === ctx.targetPropertyKind) {
      return false;
    }
    return true;
  });
}

/** Pre-cooked one-click presets surfaced above the constraint picker. Each
 *  expands into one or more spec rows. */
export interface ConstraintTemplate {
  id: string;
  label: string;
  description: string;
  applicableTo: Array<'nodeConstraint' | 'propertyConstraint'>;
  build: () => Array<{ kind: string; value?: unknown; on_class?: string }>;
}

const XSD_STRING = 'http://www.w3.org/2001/XMLSchema#string';
const XSD_DECIMAL = 'http://www.w3.org/2001/XMLSchema#decimal';
const XSD_ANYURI = 'http://www.w3.org/2001/XMLSchema#anyURI';

export const CONSTRAINT_TEMPLATES: ConstraintTemplate[] = [
  {
    id: 'required',
    label: 'Required',
    description: 'Must have at least one value (minCardinality = 1).',
    applicableTo: PC,
    build: () => [{ kind: 'minCardinality', value: 1 }],
  },
  {
    id: 'optional',
    label: 'Optional',
    description: 'May be missing (minCardinality = 0).',
    applicableTo: PC,
    build: () => [{ kind: 'minCardinality', value: 0 }],
  },
  {
    id: 'single',
    label: 'Single-valued',
    description: 'At most one value (maxCardinality = 1).',
    applicableTo: PC,
    build: () => [{ kind: 'maxCardinality', value: 1 }],
  },
  {
    id: 'required-single',
    label: 'Required & single-valued',
    description: 'Exactly one value (min = max = 1).',
    applicableTo: PC,
    build: () => [
      { kind: 'minCardinality', value: 1 },
      { kind: 'maxCardinality', value: 1 },
    ],
  },
  {
    id: 'required-multi',
    label: 'Required & multi-valued',
    description: 'At least one value, unbounded above.',
    applicableTo: PC,
    build: () => [{ kind: 'minCardinality', value: 1 }],
  },
  {
    id: 'enumeration',
    label: 'Enumeration',
    description: 'Value must be one of an enumerated list — edit the list inline.',
    applicableTo: BOTH,
    build: () => [{ kind: 'in', value: [] }],
  },
  {
    id: 'numeric-range',
    label: 'Numeric range',
    description: 'Decimal-typed value between two bounds.',
    applicableTo: PC,
    build: () => [
      { kind: 'datatype', value: XSD_DECIMAL },
      { kind: 'minInclusive', value: 0 },
      { kind: 'maxInclusive', value: 100 },
    ],
  },
  {
    id: 'string-pattern',
    label: 'String pattern',
    description: 'xsd:string value matching a regex.',
    applicableTo: PC,
    build: () => [
      { kind: 'datatype', value: XSD_STRING },
      { kind: 'pattern', value: '.*' },
    ],
  },
  {
    id: 'email',
    label: 'Email',
    description: 'xsd:string matching a permissive email regex.',
    applicableTo: PC,
    build: () => [
      { kind: 'datatype', value: XSD_STRING },
      { kind: 'pattern', value: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$' },
    ],
  },
  {
    id: 'url',
    label: 'URL',
    description: 'xsd:anyURI typed value.',
    applicableTo: PC,
    build: () => [{ kind: 'datatype', value: XSD_ANYURI }],
  },
  {
    id: 'disjoint',
    label: 'Disjoint with',
    description: 'Class is disjoint with another class — pick the targets inline.',
    applicableTo: NC,
    build: () => [{ kind: 'disjointWith', value: [] }],
  },
  {
    id: 'closed-shape',
    label: 'Closed shape',
    description: 'No properties other than those declared inside this shape are allowed.',
    applicableTo: NC,
    build: () => [
      { kind: 'shaclClosed', value: true },
      { kind: 'shaclIgnoredProperties', value: [] },
    ],
  },
];

export function templatesFor(nodeType: 'nodeConstraint' | 'propertyConstraint'): ConstraintTemplate[] {
  return CONSTRAINT_TEMPLATES.filter((t) => t.applicableTo.includes(nodeType));
}
