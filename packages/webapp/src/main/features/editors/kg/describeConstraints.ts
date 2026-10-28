/** Turn a constraint spec (or list of specs) into a plain-language sentence.
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
 *
 * `t` is threaded in as a parameter rather than read off the i18n singleton.
 * These are plain functions called during render, so the singleton would
 * return the right language only as long as some ancestor happens to
 * re-render on `languageChanged`. Taking `t` makes that dependency
 * type-checked: a caller must hold a `t` from `useTranslation()`, which is
 * what re-runs them — and `[t]` is a valid `useMemo` dependency, since
 * react-i18next hands back a new `t` identity on every language switch.
 * Do not wrap the calling components in `React.memo` without adding `t` to
 * their comparison.
 */

import type { TFunction } from 'i18next';

import type { KGConstraintSpec, KGNestedShape } from './types';

const K = 'editors.kg.constraints.describe';

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

function fmtList(t: TFunction, value: unknown): string {
  if (!Array.isArray(value)) return shortIri(value);
  if (value.length === 0) return t(`${K}.noneList`, { defaultValue: '(none)' });
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

/** Plain-language label for a single spec (no leading target name). Used both
 *  for spec-row titles and as a fallback chip label. */
export function describeSpec(t: TFunction, spec: KGConstraintSpec, targetName?: string): string {
  const tn = targetName ? `\`${targetName}\`` : t(`${K}.theValue`, { defaultValue: 'the value' });
  const count = Number(spec.value ?? 0);
  const cls = shortIri(spec.on_class);
  switch (spec.kind) {
    case 'minCardinality':
      return t(`${K}.minCardinality`, { count, defaultValue: `Must have at least ${count} value(s)` });
    case 'maxCardinality':
      return t(`${K}.maxCardinality`, { count, defaultValue: `May have at most ${count} value(s)` });
    case 'exactCardinality':
      return t(`${K}.exactCardinality`, { count, defaultValue: `Must have exactly ${count} value(s)` });
    case 'minQualifiedCardinality':
      return t(`${K}.minQualifiedCardinality`, {
        count,
        class: cls,
        defaultValue: `At least ${count} value(s) of class ${cls}`,
      });
    case 'maxQualifiedCardinality':
      return t(`${K}.maxQualifiedCardinality`, {
        count,
        class: cls,
        defaultValue: `At most ${count} value(s) of class ${cls}`,
      });
    case 'exactQualifiedCardinality':
      return t(`${K}.exactQualifiedCardinality`, {
        count,
        class: cls,
        defaultValue: `Exactly ${count} value(s) of class ${cls}`,
      });
    case 'someValuesFrom':
      return t(`${K}.someValuesFrom`, {
        class: shortIri(spec.value),
        defaultValue: `Some value must be of class ${shortIri(spec.value)}`,
      });
    case 'allValuesFrom':
      return t(`${K}.allValuesFrom`, {
        class: shortIri(spec.value),
        defaultValue: `All values must be of class ${shortIri(spec.value)}`,
      });
    case 'hasValue':
      return t(`${K}.hasValue`, {
        target: tn,
        value: fmtLiteral(spec.value),
        defaultValue: `${tn} must equal ${fmtLiteral(spec.value)}`,
      });
    case 'hasSelf':
      return spec.value
        ? t(`${K}.hasSelfTrue`, { target: tn, defaultValue: `${tn} is reflexive (self-loop)` })
        : t(`${K}.hasSelfFalse`, { target: tn, defaultValue: `${tn} is not reflexive` });
    case 'nodeKind':
      return t(`${K}.nodeKind`, {
        target: tn,
        kind: shortIri(spec.value),
        defaultValue: `${tn} must be a ${shortIri(spec.value)}`,
      });
    case 'datatype':
      return t(`${K}.datatype`, {
        datatype: shortIri(spec.value),
        defaultValue: `Of datatype ${shortIri(spec.value)}`,
      });
    case 'pattern':
      return t(`${K}.pattern`, {
        target: tn,
        regex: spec.value ?? '',
        defaultValue: `${tn} must match regex \`${spec.value ?? ''}\``,
      });
    case 'flags':
      return t(`${K}.flags`, {
        flags: spec.value ?? '',
        defaultValue: `Pattern flags: \`${spec.value ?? ''}\``,
      });
    case 'minLength':
      return t(`${K}.minLength`, { value: spec.value ?? 0, defaultValue: `Length ≥ ${spec.value ?? 0}` });
    case 'maxLength':
      return t(`${K}.maxLength`, { value: spec.value ?? 0, defaultValue: `Length ≤ ${spec.value ?? 0}` });
    case 'minInclusive':
      return t(`${K}.minInclusive`, { value: spec.value ?? '?', defaultValue: `Value ≥ ${spec.value ?? '?'}` });
    case 'maxInclusive':
      return t(`${K}.maxInclusive`, { value: spec.value ?? '?', defaultValue: `Value ≤ ${spec.value ?? '?'}` });
    case 'minExclusive':
      return t(`${K}.minExclusive`, { value: spec.value ?? '?', defaultValue: `Value > ${spec.value ?? '?'}` });
    case 'maxExclusive':
      return t(`${K}.maxExclusive`, { value: spec.value ?? '?', defaultValue: `Value < ${spec.value ?? '?'}` });
    case 'languageIn':
      return t(`${K}.languageIn`, {
        list: fmtList(t, spec.value),
        defaultValue: `Allowed languages: ${fmtList(t, spec.value)}`,
      });
    case 'uniqueLang':
      return spec.value
        ? t(`${K}.uniqueLangTrue`, { defaultValue: 'Each language at most once' })
        : t(`${K}.uniqueLangFalse`, { defaultValue: 'Languages may repeat' });
    case 'in':
      return t(`${K}.in`, {
        target: tn,
        list: fmtList(t, spec.value),
        defaultValue: `${tn} must be one of: ${fmtList(t, spec.value)}`,
      });
    case 'oneOf':
      return t(`${K}.oneOf`, {
        list: fmtList(t, spec.value),
        defaultValue: `Class is the set: ${fmtList(t, spec.value)}`,
      });
    case 'equivalentClasses':
      return t(`${K}.equivalentClasses`, {
        list: fmtList(t, spec.value),
        defaultValue: `Equivalent to ${fmtList(t, spec.value)}`,
      });
    case 'disjointWith':
      return t(`${K}.disjointWith`, {
        list: fmtList(t, spec.value),
        defaultValue: `Disjoint with ${fmtList(t, spec.value)}`,
      });
    case 'subClassOf':
      return t(`${K}.subClassOf`, {
        class: shortIri(spec.value),
        defaultValue: `Sub-class of ${shortIri(spec.value)}`,
      });
    case 'complementOf':
      return t(`${K}.complementOf`, {
        class: shortIri(spec.value),
        defaultValue: `Complement of ${shortIri(spec.value)}`,
      });
    case 'unionOf':
      return t(`${K}.unionOf`, {
        list: fmtList(t, spec.value),
        defaultValue: `Union of ${fmtList(t, spec.value)}`,
      });
    case 'intersectionOf':
      return t(`${K}.intersectionOf`, {
        list: fmtList(t, spec.value),
        defaultValue: `Intersection of ${fmtList(t, spec.value)}`,
      });
    case 'disjointUnionOf':
      return t(`${K}.disjointUnionOf`, {
        list: fmtList(t, spec.value),
        defaultValue: `Disjoint union of ${fmtList(t, spec.value)}`,
      });
    case 'hasKey':
      return t(`${K}.hasKey`, {
        list: fmtList(t, spec.value),
        defaultValue: `Identified by ${fmtList(t, spec.value)}`,
      });
    case 'shaclClosed':
      return spec.value
        ? t(`${K}.shaclClosedTrue`, { defaultValue: 'Closed shape (no extra properties allowed)' })
        : t(`${K}.shaclClosedFalse`, { defaultValue: 'Open shape' });
    case 'shaclIgnoredProperties':
      return t(`${K}.shaclIgnoredProperties`, {
        list: fmtList(t, spec.value),
        defaultValue: `Closed-shape exceptions: ${fmtList(t, spec.value)}`,
      });
    case 'shaclDisjoint':
      return t(`${K}.shaclDisjoint`, {
        class: shortIri(spec.value),
        defaultValue: `SHACL-disjoint from ${shortIri(spec.value)}`,
      });
    case 'shaclSeverity':
      return t(`${K}.shaclSeverity`, {
        severity: shortIri(spec.value),
        defaultValue: `Severity: ${shortIri(spec.value)}`,
      });
    case 'shaclMessage':
      return t(`${K}.shaclMessage`, {
        message: fmtLiteral(spec.value),
        defaultValue: `Message: ${fmtLiteral(spec.value)}`,
      });
    case 'shaclName':
      return t(`${K}.shaclName`, {
        name: fmtLiteral(spec.value),
        defaultValue: `Name: ${fmtLiteral(spec.value)}`,
      });
    case 'shaclDescription':
      return t(`${K}.shaclDescription`, {
        description: fmtLiteral(spec.value),
        defaultValue: `Description: ${fmtLiteral(spec.value)}`,
      });
    case 'shaclDeactivated':
      return spec.value
        ? t(`${K}.shaclDeactivatedTrue`, { defaultValue: 'Disabled' })
        : t(`${K}.shaclDeactivatedFalse`, { defaultValue: 'Enabled' });
    case 'shaclOrder':
      return t(`${K}.shaclOrder`, { value: spec.value ?? '?', defaultValue: `Order: ${spec.value ?? '?'}` });
    case 'shaclGroup':
      return t(`${K}.shaclGroup`, {
        group: shortIri(spec.value),
        defaultValue: `In group ${shortIri(spec.value)}`,
      });
    case 'shaclNot':
      return t(`${K}.shaclNot`, {
        shapes: describeNestedShapeList(t, spec.value, 1),
        defaultValue: `Must NOT satisfy ${describeNestedShapeList(t, spec.value, 1)}`,
      });
    case 'shaclAnd':
      return t(`${K}.shaclAnd`, {
        shapes: describeNestedShapeList(t, spec.value),
        defaultValue: `Must satisfy ALL of: ${describeNestedShapeList(t, spec.value)}`,
      });
    case 'shaclOr':
      return t(`${K}.shaclOr`, {
        shapes: describeNestedShapeList(t, spec.value),
        defaultValue: `Must satisfy ANY of: ${describeNestedShapeList(t, spec.value)}`,
      });
    case 'shaclXone':
      return t(`${K}.shaclXone`, {
        shapes: describeNestedShapeList(t, spec.value),
        defaultValue: `Must satisfy EXACTLY ONE of: ${describeNestedShapeList(t, spec.value)}`,
      });
    default:
      // Deliberately the raw discriminator: an unknown kind has no key, and
      // `t(spec.kind)` would render a bogus dotted path instead.
      return spec.kind;
  }
}

/** Plain-English summary of a list of nested-shape slots (the value of a
 *  logical operator like `sh:and`). Slots resolve as:
 *  - `{ ref }` → `→ <node-id>` (caller may swap in a label later)
 *  - `{ specs }` → `{ <inline spec summary> }`
 *  ``maxItems`` truncates the rendered list (defaults to all). */
export function describeNestedShapeList(
  t: TFunction,
  value: unknown,
  maxItems: number = Infinity,
  targetName?: string,
): string {
  if (!Array.isArray(value) || value.length === 0) {
    return t(`${K}.noShapes`, { defaultValue: '(no shapes)' });
  }
  const items = (value as KGNestedShape[]).slice(0, maxItems);
  const rendered = items.map((slot) => {
    if (slot && typeof slot === 'object' && 'ref' in (slot as any)) {
      return `→ ${(slot as any).ref || '?'}`;
    }
    const inline = slot && typeof slot === 'object' && 'specs' in (slot as any)
      ? ((slot as any).specs as KGConstraintSpec[])
      : [];
    return `{ ${describeSpecList(t, inline, targetName)} }`;
  });
  if (items.length < (value as unknown[]).length) rendered.push('…');
  return rendered.join('; ');
}

/** Single-sentence summary of a constraint node's full spec list, suitable
 *  for the inspector's live preview block. */
export function describeSpecList(t: TFunction, specs: KGConstraintSpec[], targetName?: string): string {
  if (!specs || specs.length === 0) {
    return t(`${K}.empty`, { defaultValue: 'No constraints yet — pick one from the picker below.' });
  }
  // Try to fuse min/max cardinality into a single phrase.
  const minC = specs.find((s) => s.kind === 'minCardinality');
  const maxC = specs.find((s) => s.kind === 'maxCardinality');
  const fused: string[] = [];
  if (minC && maxC) {
    const min = Number(minC.value ?? 0);
    const max = Number(maxC.value ?? 0);
    if (min === max) {
      fused.push(t(`${K}.fusedExact`, { count: min, defaultValue: `Must have exactly ${min} value(s)` }));
    } else {
      // min !== max here, so max is always >= 2 -- no plural form needed.
      fused.push(t(`${K}.fusedRange`, { min, max, defaultValue: `Must have between ${min} and ${max} values` }));
    }
  }
  const others = specs.filter((s) => {
    if (fused.length > 0 && (s.kind === 'minCardinality' || s.kind === 'maxCardinality')) return false;
    return true;
  });
  const parts = [...fused, ...others.map((s) => describeSpec(t, s, targetName))];
  return parts.join('; ') + '.';
}

/** Very short chip label for canvas overlays. Pick the most informative spec
 *  and shorten to ≤ 12 chars.
 *
 *  NOTE: currently unreferenced — the canvas chips it was written for are not
 *  wired up. Left untranslated rather than shipping ~13 unused keys across six
 *  locales; thread `t` through it the same way as `describeSpec` if it is ever
 *  put back into use. */
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
