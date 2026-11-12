import { diffSnapshots, value } from './modelDiff';
import type { ElementChange, FeatureValue, Snapshot } from './modelDiff';

/**
 * What changed between two versions of a class diagram, element by element (compared in `modelDiff.ts`).
 *
 * Only what reaches the B-UML model is compared: layout (position, size,
 * colours, paths) is ignored. A reference to
 * another element (an attribute's owner, an association end) is compared by
 * id and reported by name, so renaming a class does not show up as a change of
 * every association attached to it.
 */

/** Minimal view of an Apollon model: the fields read here. */
interface EditorElement {
  id: string;
  type: string;
  name?: string;
  owner?: string | null;
  [field: string]: unknown;
}

interface EditorRelationshipEnd {
  element: string;
  role?: string;
  multiplicity?: string;
  navigable?: boolean;
}

interface EditorRelationship {
  id: string;
  type: string;
  name?: string;
  source: EditorRelationshipEnd;
  target: EditorRelationshipEnd;
}

export interface ClassModelLike {
  elements?: Record<string, EditorElement>;
  relationships?: Record<string, EditorRelationship>;
}

const CLASS_TYPES = new Set(['Class', 'AbstractClass', 'Interface']);
const ASSOCIATION_TYPES = new Set(['ClassBidirectional', 'ClassUnidirectional', 'ClassComposition', 'ClassAggregation']);
/** Editor field -> recorded feature, with the value the editor assumes when the field is absent
 *  (a model written by the assistant may omit what the canvas fills in, and that is not a change). */
const PROPERTY_FIELDS: Record<string, { feature: string; absent: unknown }> = {
  attributeType: { feature: 'type', absent: 'str' },
  visibility: { feature: 'visibility', absent: 'public' },
  isOptional: { feature: 'isOptional', absent: false },
  isDerived: { feature: 'isDerived', absent: false },
  isId: { feature: 'isId', absent: false },
  isExternalId: { feature: 'isExternalId', absent: false },
  defaultValue: { feature: 'defaultValue', absent: '' },
};

/** A constraint name made from the start of its OCL is cut at this length. */
const CONSTRAINT_NAME_CHARS = 60;

/** What a constraint box is called in the trace: the names of the invariants it holds (`context Room inv
 *  positivePrice: ...` gives `positivePrice`), else its own name, else the first line of its OCL; the editor
 *  gives the box no name of its own. */
function constraintName(name: string, ocl: unknown): string {
  const text = typeof ocl === 'string' ? ocl : '';
  const invariants = [...text.matchAll(/\binv\s+(\w+)\s*:/g)].map((match) => match[1]);
  if (invariants.length > 0) return invariants.join(', ');
  if (name.trim()) return name;
  const firstLine = text.trim().split('\n')[0].trim();
  if (!firstLine) return 'constraint';
  return firstLine.length > CONSTRAINT_NAME_CHARS ? `${firstLine.slice(0, CONSTRAINT_NAME_CHARS)}…` : firstLine;
}

const reference = (id: string | null | undefined, names: Map<string, string>): FeatureValue => ({
  key: id ?? '',
  display: (id && names.get(id)) || '',
});

/** The class diagram's elements that reach the B-UML model, by editor element id. */
export function snapshotClassModel(model: ClassModelLike | null | undefined): Map<string, Snapshot> {
  const elements = model?.elements ?? {};
  const names = new Map(Object.values(elements).map((e) => [e.id, e.name ?? '']));
  const result = new Map<string, Snapshot>();

  for (const element of Object.values(elements)) {
    const name = element.name ?? '';
    const ownerType = element.owner ? elements[element.owner]?.type : undefined;
    if (CLASS_TYPES.has(element.type)) {
      result.set(element.id, {
        elementType: 'Class', name, parentElementId: null, rank: 0,
        features: { name: value(name), isAbstract: value(element.type === 'AbstractClass') },
      });
    } else if (element.type === 'Enumeration') {
      result.set(element.id, { elementType: 'Enumeration', name, parentElementId: null, rank: 0, features: { name: value(name) } });
    } else if (element.type === 'ClassAttribute' && ownerType === 'Enumeration') {
      result.set(element.id, {
        elementType: 'EnumerationLiteral', name, parentElementId: element.owner ?? null, rank: 1,
        features: { name: value(name), owner: reference(element.owner, names) },
      });
    } else if (element.type === 'ClassAttribute') {
      const features: Record<string, FeatureValue> = { name: value(name), owner: reference(element.owner, names) };
      for (const [field, { feature, absent }] of Object.entries(PROPERTY_FIELDS)) {
        features[feature] = value(element[field], absent);
      }
      result.set(element.id, { elementType: 'Property', name, parentElementId: element.owner ?? null, rank: 1, features });
    } else if (element.type === 'ClassMethod') {
      result.set(element.id, {
        elementType: 'Method', name, parentElementId: element.owner ?? null, rank: 1,
        features: {
          name: value(name), owner: reference(element.owner, names),
          visibility: value(element.visibility, 'public'), code: value(element.code),
        },
      });
    } else if (element.type === 'ClassOCLConstraint') {
      result.set(element.id, {
        elementType: 'Constraint', name: constraintName(name, element.constraint), parentElementId: null, rank: 1,
        features: { name: value(name), constraint: value(element.constraint) },
      });
    }
  }

  for (const rel of Object.values(model?.relationships ?? {})) {
    const source = names.get(rel.source.element) ?? '';
    const target = names.get(rel.target.element) ?? '';
    if (ASSOCIATION_TYPES.has(rel.type)) {
      result.set(rel.id, {
        elementType: 'BinaryAssociation', name: rel.name || `${source} – ${target}`, parentElementId: null, rank: 2,
        features: {
          name: value(rel.name),
          associationKind: value(rel.type),
          source: reference(rel.source.element, names),
          target: reference(rel.target.element, names),
          sourceRole: value(rel.source.role),
          sourceMultiplicity: value(rel.source.multiplicity),
          sourceNavigable: value(rel.source.navigable, true),
          targetRole: value(rel.target.role),
          targetMultiplicity: value(rel.target.multiplicity),
          targetNavigable: value(rel.target.navigable, true),
        },
      });
    } else if (rel.type === 'ClassInheritance') {
      result.set(rel.id, {
        elementType: 'Generalization', name: `${source} → ${target}`, parentElementId: null, rank: 2,
        features: { specific: reference(rel.source.element, names), general: reference(rel.target.element, names) },
      });
    }
  }
  return result;
}

/** The changes that turn `previous` into `next`; empty when only the layout changed. */
export function diffClassModel(
  previous: ClassModelLike | null | undefined,
  next: ClassModelLike | null | undefined,
): ElementChange[] {
  return diffSnapshots(snapshotClassModel(previous), snapshotClassModel(next));
}

/** An element named the way the modeling assistant names it: its B-UML metaclass, its name, and the
 *  class holding it (an attribute's or method's class, an invariant's context, an association's source). */
export interface NamedElementRef {
  type: string;
  name: string;
  owner?: string;
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function namesElement(found: Snapshot, ref: NamedElementRef, snapshots: Map<string, Snapshot>): boolean {
  switch (found.elementType) {
    case 'Method': // the editor names a method by its signature, `checkOut(day: int)`
      return found.name.replace(/\(.*$/, '').trim() === ref.name && ownerMatches(found, ref, snapshots);
    case 'Constraint': // one box holds every invariant of a context: find it by the invariant's name
      return new RegExp(`\\binv\\s+${escapeRegExp(ref.name)}\\s*:`).test(found.features.constraint?.key ?? '');
    case 'BinaryAssociation':
      return found.features.name?.key === ref.name && (!ref.owner || found.features.source?.display === ref.owner);
    default:
      return found.name === ref.name && ownerMatches(found, ref, snapshots);
  }
}

function ownerMatches(found: Snapshot, ref: NamedElementRef, snapshots: Map<string, Snapshot>): boolean {
  if (!ref.owner) return found.parentElementId === null;
  return found.parentElementId !== null && snapshots.get(found.parentElementId)?.name === ref.owner;
}

/** The id of the element of `model` that `ref` names, or undefined when it names none. */
export function findNamedElement(model: ClassModelLike | null | undefined, ref: NamedElementRef): string | undefined {
  const snapshots = snapshotClassModel(model);
  for (const [id, found] of snapshots) {
    if (found.elementType === ref.type && namesElement(found, ref, snapshots)) return id;
  }
  return undefined;
}
