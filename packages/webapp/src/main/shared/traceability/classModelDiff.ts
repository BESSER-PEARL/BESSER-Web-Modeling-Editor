import type { ChangeKind } from '../types/traceability';

/**
 * What changed between two versions of a class diagram, element by element.
 *
 * Only what reaches the B-UML model is compared: layout (position, size,
 * colours, paths) is ignored, and element types are reported by their B-UML
 * metaclass name, the same names the backend's trace uses. A reference to
 * another element (an attribute's owner, an association end) is compared by
 * id and reported by name, so renaming a class does not show up as a change of
 * every association attached to it.
 */

export interface ElementChange {
  kind: ChangeKind;
  elementId: string;
  /** B-UML metaclass: `Class`, `Enumeration`, `Property`, `EnumerationLiteral`, `Method`, `Constraint`,
   *  `BinaryAssociation`, `Generalization`. */
  elementType: string;
  /** Display name after the change (before it, for a deletion). */
  name: string;
  /** The owning element (a class for an attribute), or null for a top-level element. */
  parentElementId: string | null;
  /** The owner's metaclass and name, so a recorder can file the change under an owner it has not seen yet. */
  parent?: { elementType: string; name: string };
  feature?: string;
  oldValue?: string;
  newValue?: string;
}

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

/** A compared value: `key` decides whether it changed, `display` is what is recorded. */
interface FeatureValue {
  key: string;
  display: string;
}

interface Snapshot {
  elementType: string;
  name: string;
  parentElementId: string | null;
  features: Record<string, FeatureValue>;
  /** Created and deleted in this order: types, then their members, then relationships. */
  rank: number;
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

const value = (raw: unknown, absent: unknown = ''): FeatureValue => {
  const resolved = raw === undefined || raw === null ? absent : raw;
  const text = String(resolved);
  return { key: text, display: text };
};

const reference = (id: string | null | undefined, names: Map<string, string>): FeatureValue => ({
  key: id ?? '',
  display: (id && names.get(id)) || '',
});

function snapshot(model: ClassModelLike | null | undefined): Map<string, Snapshot> {
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
        elementType: 'Constraint', name: name || 'constraint', parentElementId: null, rank: 1,
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
  const before = snapshot(previous);
  const after = snapshot(next);
  const created: ElementChange[] = [];
  const updated: ElementChange[] = [];
  const deleted: ElementChange[] = [];

  const ownerOf = (parentElementId: string | null, snapshots: Map<string, Snapshot>) => {
    const owner = parentElementId ? snapshots.get(parentElementId) : undefined;
    return owner ? { parent: { elementType: owner.elementType, name: owner.name } } : {};
  };

  for (const [id, now] of after) {
    const old = before.get(id);
    const base = {
      elementId: id, elementType: now.elementType, name: now.name, parentElementId: now.parentElementId,
      ...ownerOf(now.parentElementId, after),
    };
    if (!old || old.elementType !== now.elementType) {
      if (old) deleted.push({ ...base, kind: 'DELETED', name: old.name, elementType: old.elementType, oldValue: old.name });
      created.push({ ...base, kind: 'CREATED', newValue: now.name });
      continue;
    }
    for (const [feature, current] of Object.entries(now.features)) {
      const previousValue = old.features[feature];
      if (previousValue && previousValue.key !== current.key) {
        updated.push({ ...base, kind: 'UPDATED', feature, oldValue: previousValue.display, newValue: current.display });
      }
    }
  }
  for (const [id, old] of before) {
    if (!after.has(id)) {
      deleted.push({
        kind: 'DELETED', elementId: id, elementType: old.elementType, name: old.name,
        parentElementId: old.parentElementId, oldValue: old.name, ...ownerOf(old.parentElementId, before),
      });
    }
  }

  const rank = (changes: ElementChange[], snapshots: Map<string, Snapshot>) =>
    changes.sort((a, b) => (snapshots.get(a.elementId)?.rank ?? 0) - (snapshots.get(b.elementId)?.rank ?? 0));
  // Owners are created before their members and deleted after them.
  return [...rank(created, after), ...updated, ...rank(deleted, before).reverse()];
}
