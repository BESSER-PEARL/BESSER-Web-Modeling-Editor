/** Turn a constraint spec (or list of specs) into plain English.
 *
 * Used for:
 *  - the spec-row label inside the inspector (each row reads "Must have at
 *    least 1 value" instead of `sh:minCount = 1`),
 *  - the live preview shown at the top of the constraint inspector,
 *  - the constraint chips overlaid on Class / Property nodes in the canvas.
 *
 * The helper is intentionally tolerant of partial / in-progress specs (e.g.
 * the user just clicked "Numeric range" but hasn't filled the bounds yet) —
 * it falls back to a generic label rather than throwing.
 */

import type { KGConstraintSpec, KGNestedShape } from './types';

const XSD_PREFIX = 'http://www.w3.org/2001/XMLSchema#';

function shortIri(iri: unknown): string {
  if (typeof iri !== 'string') return String(iri ?? '?');
  if (iri.startsWith(XSD_PREFIX)) return `xsd:${iri.slice(XSD_PREFIX.length)}`;
  const hash = iri.lastIndexOf('#');
  if (hash >= 0 && hash < iri.length - 1) return iri.slice(hash + 1);
  const slash = iri.lastIndexOf('/');
  if (slash >= 0 && slash < iri.length - 1) return iri.slice(slash + 1);
  return iri;
}

function fmtList(value: unknown): string {
  if (!Array.isArray(value)) return shortIri(value);
  if (value.length === 0) return '(none)';
  return value.map((v) => shortIri(v)).join(', ');
}

function fmtLiteral(value: unknown): string {
  if (value && typeof value === 'object' && 'value' in (value as any)) {
    const v = (value as any).value;
    return typeof v === 'string' ? `"${v}"` : String(v);
  }
  if (typeof value === 'string') return `"${value}"`;
  if (value === null || value === undefined) return '?';
  return String(value);
}

/** Plain-English label for a single spec (no leading target name). Used both
 *  for spec-row titles and as a fallback chip label. */
export function describeSpec(spec: KGConstraintSpec, targetName?: string): string {
  const tn = targetName ? `\`${targetName}\`` : 'the value';
  switch (spec.kind) {
    case 'minCardinality':
      return `Must have at least ${spec.value ?? 0} value(s)`;
    case 'maxCardinality':
      return `May have at most ${spec.value ?? 0} value(s)`;
    case 'exactCardinality':
      return `Must have exactly ${spec.value ?? 0} value(s)`;
    case 'minQualifiedCardinality':
      return `At least ${spec.value ?? 0} value(s) of class ${shortIri(spec.on_class)}`;
    case 'maxQualifiedCardinality':
      return `At most ${spec.value ?? 0} value(s) of class ${shortIri(spec.on_class)}`;
    case 'exactQualifiedCardinality':
      return `Exactly ${spec.value ?? 0} value(s) of class ${shortIri(spec.on_class)}`;
    case 'someValuesFrom':
      return `Some value must be of class ${shortIri(spec.value)}`;
    case 'allValuesFrom':
      return `All values must be of class ${shortIri(spec.value)}`;
    case 'hasValue':
      return `${tn} must equal ${fmtLiteral(spec.value)}`;
    case 'hasSelf':
      return spec.value ? `${tn} is reflexive (self-loop)` : `${tn} is not reflexive`;
    case 'nodeKind':
      return `${tn} must be a ${shortIri(spec.value)}`;
    case 'datatype':
      return `Of datatype ${shortIri(spec.value)}`;
    case 'pattern':
      return `${tn} must match regex \`${spec.value ?? ''}\``;
    case 'flags':
      return `Pattern flags: \`${spec.value ?? ''}\``;
    case 'minLength':
      return `Length ≥ ${spec.value ?? 0}`;
    case 'maxLength':
      return `Length ≤ ${spec.value ?? 0}`;
    case 'minInclusive':
      return `Value ≥ ${spec.value ?? '?'}`;
    case 'maxInclusive':
      return `Value ≤ ${spec.value ?? '?'}`;
    case 'minExclusive':
      return `Value > ${spec.value ?? '?'}`;
    case 'maxExclusive':
      return `Value < ${spec.value ?? '?'}`;
    case 'languageIn':
      return `Allowed languages: ${fmtList(spec.value)}`;
    case 'uniqueLang':
      return spec.value ? 'Each language at most once' : 'Languages may repeat';
    case 'in':
      return `${tn} must be one of: ${fmtList(spec.value)}`;
    case 'oneOf':
      return `Class is the set: ${fmtList(spec.value)}`;
    case 'equivalentClasses':
      return `Equivalent to ${fmtList(spec.value)}`;
    case 'disjointWith':
      return `Disjoint with ${fmtList(spec.value)}`;
    case 'subClassOf':
      return `Sub-class of ${shortIri(spec.value)}`;
    case 'complementOf':
      return `Complement of ${shortIri(spec.value)}`;
    case 'unionOf':
      return `Union of ${fmtList(spec.value)}`;
    case 'intersectionOf':
      return `Intersection of ${fmtList(spec.value)}`;
    case 'disjointUnionOf':
      return `Disjoint union of ${fmtList(spec.value)}`;
    case 'hasKey':
      return `Identified by ${fmtList(spec.value)}`;
    case 'shaclClosed':
      return spec.value ? 'Closed shape (no extra properties allowed)' : 'Open shape';
    case 'shaclIgnoredProperties':
      return `Closed-shape exceptions: ${fmtList(spec.value)}`;
    case 'shaclDisjoint':
      return `SHACL-disjoint from ${shortIri(spec.value)}`;
    case 'shaclSeverity':
      return `Severity: ${shortIri(spec.value)}`;
    case 'shaclMessage':
      return `Message: ${fmtLiteral(spec.value)}`;
    case 'shaclName':
      return `Name: ${fmtLiteral(spec.value)}`;
    case 'shaclDescription':
      return `Description: ${fmtLiteral(spec.value)}`;
    case 'shaclDeactivated':
      return spec.value ? 'Disabled' : 'Enabled';
    case 'shaclOrder':
      return `Order: ${spec.value ?? '?'}`;
    case 'shaclGroup':
      return `In group ${shortIri(spec.value)}`;
    case 'shaclNot':
      return `Must NOT satisfy ${describeNestedShapeList(spec.value, 1)}`;
    case 'shaclAnd':
      return `Must satisfy ALL of: ${describeNestedShapeList(spec.value)}`;
    case 'shaclOr':
      return `Must satisfy ANY of: ${describeNestedShapeList(spec.value)}`;
    case 'shaclXone':
      return `Must satisfy EXACTLY ONE of: ${describeNestedShapeList(spec.value)}`;
    default:
      return spec.kind;
  }
}

/** Plain-English summary of a list of nested-shape slots (the value of a
 *  logical operator like `sh:and`). Slots resolve as:
 *  - `{ ref }` → `→ <node-id>` (caller may swap in a label later)
 *  - `{ specs }` → `{ <inline spec summary> }`
 *  ``maxItems`` truncates the rendered list (defaults to all). */
export function describeNestedShapeList(
  value: unknown,
  maxItems: number = Infinity,
  targetName?: string,
): string {
  if (!Array.isArray(value) || value.length === 0) return '(no shapes)';
  const items = (value as KGNestedShape[]).slice(0, maxItems);
  const rendered = items.map((slot) => {
    if (slot && typeof slot === 'object' && 'ref' in (slot as any)) {
      return `→ ${(slot as any).ref || '?'}`;
    }
    const inline = slot && typeof slot === 'object' && 'specs' in (slot as any)
      ? ((slot as any).specs as KGConstraintSpec[])
      : [];
    return `{ ${describeSpecList(inline, targetName)} }`;
  });
  if (items.length < (value as unknown[]).length) rendered.push('…');
  return rendered.join('; ');
}

/** Single-sentence summary of a constraint node's full spec list, suitable
 *  for the inspector's live preview block. */
export function describeSpecList(specs: KGConstraintSpec[], targetName?: string): string {
  if (!specs || specs.length === 0) return 'No constraints yet — pick one from the picker below.';
  // Try to fuse min/max cardinality into a single phrase.
  const minC = specs.find((s) => s.kind === 'minCardinality');
  const maxC = specs.find((s) => s.kind === 'maxCardinality');
  const fused: string[] = [];
  if (minC && maxC) {
    const min = Number(minC.value ?? 0);
    const max = Number(maxC.value ?? 0);
    if (min === max) {
      fused.push(`Must have exactly ${min} value(s)`);
    } else {
      fused.push(`Must have between ${min} and ${max} value(s)`);
    }
  }
  const others = specs.filter((s) => {
    if (fused.length > 0 && (s.kind === 'minCardinality' || s.kind === 'maxCardinality')) return false;
    return true;
  });
  const parts = [...fused, ...others.map((s) => describeSpec(s, targetName))];
  return parts.join('; ') + '.';
}

/** Very short chip label for canvas overlays. Pick the most informative spec
 *  and shorten to ≤ 12 chars. */
export function shortChipLabel(spec: KGConstraintSpec): string {
  switch (spec.kind) {
    case 'minCardinality':
    case 'maxCardinality': {
      const min = Number(spec.value ?? 0);
      return spec.kind === 'minCardinality' ? `${min}..` : `..${min}`;
    }
    case 'exactCardinality':
      return `=${spec.value ?? 0}`;
    case 'datatype':
      return shortIri(spec.value);
    case 'pattern':
      return 'regex';
    case 'in':
    case 'oneOf':
      return 'enum';
    case 'disjointWith':
      return 'disjoint';
    case 'equivalentClasses':
      return 'equiv';
    case 'hasKey':
      return 'key';
    case 'shaclClosed':
      return 'closed';
    case 'someValuesFrom':
      return `∃ ${shortIri(spec.value)}`;
    case 'allValuesFrom':
      return `∀ ${shortIri(spec.value)}`;
    case 'hasValue':
      return `= ${fmtLiteral(spec.value)}`;
    default:
      return spec.kind;
  }
}
