/**
 * The sync core: pure conversion between the form's `Instance` tree and an
 * Apollon `UserDiagram` `UMLModel`.
 *
 * The output shape (UserModelName boxes + UserModelAttribute criteria +
 * optional UserModelIcon + ObjectLink relationships) is identical to what the
 * assistant's `UserDiagramConverter` and the graphical editor produce, so a
 * profile authored in the form is indistinguishable from one drawn by hand.
 */

import type { UMLModel, UserPersonalizationSpec } from '@besser/wme';
import { isPersonalizationSpecEmpty, isUserPersonalizationSpec } from '@besser/wme';
import { AttrValue, Instance, OPERATORS, Operator } from './types';
import { MetaNode, MetaTree, ROOT_CLASS_NAME } from './metamodel-tree';
import { splitUserDiagramIntoProfiles } from '../../../shared/utils/user-profile-graph';

/**
 * Stable, order-insensitive JSON of a personalization spec for change-detection.
 * Recursively sorts object keys so semantically-equal specs always stringify
 * identically. Returns '' for an empty/absent spec.
 */
const personalizationSignature = (spec?: UserPersonalizationSpec | null): string => {
  if (isPersonalizationSpecEmpty(spec)) return '';
  const sortValue = (value: any): any => {
    if (Array.isArray(value)) return value.map(sortValue);
    if (value && typeof value === 'object') {
      return Object.keys(value)
        .sort()
        .reduce((acc: Record<string, any>, k) => {
          acc[k] = sortValue(value[k]);
          return acc;
        }, {});
    }
    return value;
  };
  return JSON.stringify(sortValue(spec));
};

let keyCounter = 0;
/** Unique, deterministic-per-session React key for a form instance. */
export const makeInstanceKey = (className: string): string => `${className}-k${keyCounter++}`;

const normalizeOperator = (raw?: string): Operator => {
  if (typeof raw !== 'string') return '==';
  const op = raw.trim() === '=' ? '==' : raw.trim();
  return (OPERATORS as readonly string[]).includes(op) ? (op as Operator) : '==';
};

/** Render a criterion the way the editor does: `age >= 18`, or `age = ` when unset (equality as `=`). */
const attrDisplayName = (attr: AttrValue): string => {
  const symbol = attr.operator === '==' ? '=' : attr.operator;
  return `${attr.name} ${symbol} ${attr.value ?? ''}`;
};

/** Split a criterion name like `age >= 18` into its parts. */
const parseCriterion = (raw?: string): { name: string; operator: Operator; value: string } => {
  if (!raw) return { name: '', operator: '==', value: '' };
  const m = raw.match(/^(.*?)(<=|>=|==|=|<|>)(.*)$/);
  if (!m) return { name: raw.trim(), operator: '==', value: '' };
  return {
    name: m[1].trim(),
    operator: normalizeOperator(m[2]),
    value: m[3].trim(),
  };
};

/* ------------------------------------------------------------------ */
/*  Form Instance factory                                              */
/* ------------------------------------------------------------------ */

/** Build a fresh, empty instance for a metamodel class (no criteria, no parts). */
export const createEmptyInstance = (metaNode: MetaNode): Instance => ({
  key: makeInstanceKey(metaNode.className),
  className: metaNode.className,
  classId: metaNode.classId,
  icon: metaNode.icon,
  attributes: metaNode.attributes.map((a) => ({
    attributeId: a.id,
    name: a.name,
    type: a.type,
    enumValues: a.enumValues,
    operator: '==' as Operator,
    value: '',
  })),
  children: {},
});

/* ------------------------------------------------------------------ */
/*  Instance tree  ->  UMLModel                                        */
/* ------------------------------------------------------------------ */

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Collect existing box bounds keyed by their element id, for position reuse. */
const collectExistingBoundsById = (model?: UMLModel | null): Record<string, Bounds> => {
  const out: Record<string, Bounds> = {};
  if (!model?.elements) return out;
  Object.values(model.elements as Record<string, any>)
    .filter((el: any) => el?.type === 'UserModelName')
    .forEach((el: any) => {
      if (el.id && el.bounds) out[el.id] = el.bounds;
    });
  return out;
};

const instanceDisplayName = (className: string, ordinal: number): string =>
  `${className.charAt(0).toLowerCase() + className.slice(1)}_${ordinal + 1}`;

/** Name of the identity attribute on the root User element (see the metamodel). */
export const USER_NAME_ATTRIBUTE = 'name';

/** Read the value of the root User `name` attribute from a form instance. */
const rootNameValue = (instance: Instance): string => {
  const attr = instance.attributes.find((a) => a.name === USER_NAME_ATTRIBUTE);
  return attr && attr.value != null ? String(attr.value).trim() : '';
};

const addLink = (
  relationships: Record<string, any>,
  linkId: string,
  parentBoxId: string,
  childBoxId: string,
): void => {
  // Shape mirrors the assistant's UserDiagramConverter output, which the editor
  // is known to accept for UserModelName boxes.
  relationships[linkId] = {
    id: linkId,
    type: 'ObjectLink',
    source: {
      element: parentBoxId,
      direction: 'Right',
      bounds: { x: 0, y: 0, width: 0, height: 0 },
    },
    target: {
      element: childBoxId,
      direction: 'Left',
      bounds: { x: 0, y: 0, width: 0, height: 0 },
    },
    bounds: { x: 0, y: 0, width: 0, height: 0 },
    name: '',
    path: [
      { x: 100, y: 10 },
      { x: 0, y: 10 },
    ],
    isManuallyLayouted: false,
  };
};

/**
 * Serialise one or more profile `Instance` trees into a single `UserDiagram`
 * `UMLModel` (boxes + criteria + links). Multiple roots share one canvas.
 *
 * Shared boxes: an instance that carries a `boxId` already emitted by an earlier
 * profile (a box reachable from two Users) is emitted **once** — the first
 * profile wins its attributes/personalization/subtree — and every later parent
 * simply gets its own `ObjectLink` to that existing box. This preserves sharing
 * on a build → parse → build round-trip instead of duplicating the box.
 */
export const buildUserDiagramModel = (
  profiles: Instance | Instance[] | null,
  _tree: MetaTree,
  existingModel?: UMLModel | null,
): UMLModel => {
  const roots = (Array.isArray(profiles) ? profiles : profiles ? [profiles] : []).filter(Boolean);

  const elements: Record<string, any> = {};
  const relationships: Record<string, any> = {};
  const existingBounds = collectExistingBoundsById(existingModel);

  let counter = 0;
  const nextId = (prefix: string) => `up_${prefix}_${counter++}`;

  const ordinalByClass: Record<string, number> = {};
  const xCursorByDepth: Record<number, number> = {};
  // boxId (source identity) -> new element id, so a box shared across profiles
  // is emitted only once but linked from each parent.
  const emittedByBoxId = new Map<string, string>();

  // Returns the new-model id of the box this instance maps to (existing when shared).
  const emit = (instance: Instance, parentBoxId: string | null, depth: number, rootIndex: number): string => {
    if (instance.boxId && emittedByBoxId.has(instance.boxId)) {
      const existingId = emittedByBoxId.get(instance.boxId)!;
      if (parentBoxId) addLink(relationships, nextId('link'), parentBoxId, existingId);
      return existingId; // shared box already emitted (with its subtree) — just link
    }

    const ord = ordinalByClass[instance.className] ?? 0;
    ordinalByClass[instance.className] = ord + 1;

    // Emit every metamodel attribute as a row (not just the ones with a value),
    // so all fields are present on the canvas box and can be edited manually
    // there. Unset attributes render as `name = `.
    const rows = instance.attributes;
    const height = 50 + rows.length * 30;

    // Position: reuse the existing layout by box identity when we can, else
    // place on a simple grid (each profile's User offset across the top, parts
    // in rows below; the depth cursor is shared so profiles don't overlap).
    const preserved = instance.boxId ? existingBounds[instance.boxId] : undefined;
    let x: number;
    let y: number;
    if (preserved) {
      x = preserved.x;
      y = preserved.y;
    } else if (depth === 0) {
      x = 600 + rootIndex * 320;
      y = 40;
    } else {
      const col = xCursorByDepth[depth] ?? 0;
      xCursorByDepth[depth] = col + 1;
      x = 40 + col * 260;
      y = 40 + depth * 200;
    }

    // The root User box is labelled with the profile name (its `name` attribute)
    // so the canvas node reads meaningfully even in icon-view where attribute
    // rows are hidden; other boxes keep the generated `class_n` display name.
    const rootName = instance.className === ROOT_CLASS_NAME ? rootNameValue(instance) : '';
    const displayName = rootName || instanceDisplayName(instance.className, ord);

    const boxId = nextId('name');
    if (instance.boxId) emittedByBoxId.set(instance.boxId, boxId);
    const box: any = {
      type: 'UserModelName',
      id: boxId,
      name: displayName,
      owner: null,
      bounds: { x, y, width: 200, height },
      attributes: [] as string[],
      methods: [],
    };
    if (instance.className) box.className = instance.className;
    if (instance.classId) box.classId = instance.classId;
    if (!isPersonalizationSpecEmpty(instance.personalization)) {
      box.personalization = instance.personalization;
    }

    if (instance.icon && typeof instance.icon === 'string' && instance.icon.trim() !== '') {
      const iconId = nextId('icon');
      elements[iconId] = {
        type: 'UserModelIcon',
        id: iconId,
        name: '',
        owner: boxId,
        bounds: { x, y, width: 50, height: 50 },
        icon: instance.icon,
      };
      box.icon = iconId;
    }

    let currentY = y + 40;
    rows.forEach((attr) => {
      const attrId = nextId('attr');
      box.attributes.push(attrId);
      const attrEl: any = {
        id: attrId,
        name: attrDisplayName(attr),
        type: 'UserModelAttribute',
        owner: boxId,
        bounds: { x: x + 1, y: currentY, width: 198, height: 30 },
        attributeOperator: attr.operator,
      };
      if (attr.attributeId) attrEl.attributeId = attr.attributeId;
      if (!isPersonalizationSpecEmpty(attr.personalization)) {
        attrEl.personalization = attr.personalization;
      }
      elements[attrId] = attrEl;
      currentY += 30;
    });

    elements[boxId] = box;

    if (parentBoxId) addLink(relationships, nextId('link'), parentBoxId, boxId);

    Object.values(instance.children).forEach((list) => {
      list.forEach((child) => emit(child, boxId, depth + 1, rootIndex));
    });

    return boxId;
  };

  roots.forEach((root, rootIndex) => emit(root, null, 0, rootIndex));

  return {
    version: '3.0.0',
    type: 'UserDiagram',
    size: { width: 1400, height: 740 },
    elements,
    relationships,
    interactive: { elements: {}, relationships: {} },
    assessments: {},
  } as unknown as UMLModel;
};

/* ------------------------------------------------------------------ */
/*  UMLModel  ->  Instance tree                                        */
/* ------------------------------------------------------------------ */

/** Read an instance's attribute values, overlaying stored criteria onto the metamodel attributes. */
const readAttributes = (
  metaNode: MetaNode,
  box: any,
  elements: Record<string, any>,
): AttrValue[] => {
  // Start from the metamodel attributes (defaults), so the form always offers
  // the full set of fields even when only some carry criteria.
  const result: AttrValue[] = metaNode.attributes.map((a) => ({
    attributeId: a.id,
    name: a.name,
    type: a.type,
    enumValues: a.enumValues,
    operator: '==' as Operator,
    value: '',
  }));

  const childIds: string[] = Array.isArray(box?.attributes) ? box.attributes : [];
  childIds.forEach((childId) => {
    const attrEl = elements[childId];
    if (!attrEl || attrEl.type !== 'UserModelAttribute') return;
    const parsed = parseCriterion(attrEl.name);
    const operator = attrEl.attributeOperator
      ? normalizeOperator(attrEl.attributeOperator)
      : parsed.operator;

    // Match to a metamodel attribute by id first, then by name.
    const target =
      (attrEl.attributeId && result.find((r) => r.attributeId === attrEl.attributeId)) ||
      result.find((r) => r.name === parsed.name);

    const personalization = isUserPersonalizationSpec(attrEl.personalization)
      ? (attrEl.personalization as UserPersonalizationSpec)
      : undefined;

    if (target) {
      target.operator = operator;
      target.value = parsed.value;
      if (!isPersonalizationSpecEmpty(personalization)) target.personalization = personalization;
    } else if (parsed.name) {
      // Criterion not present in the metamodel — keep it so nothing is lost.
      result.push({
        attributeId: attrEl.attributeId,
        name: parsed.name,
        operator,
        value: parsed.value,
        ...(isPersonalizationSpecEmpty(personalization) ? {} : { personalization }),
      });
    }
  });

  return result;
};

/** Build the `Instance` tree for one profile sub-model by walking its links. */
const buildProfileInstance = (subModel: UMLModel, rootBoxId: string, tree: MetaTree): Instance | null => {
  const rootMeta = tree.root;
  if (!rootMeta) return null;

  const elements = (subModel.elements || {}) as Record<string, any>;
  const relationships = (subModel.relationships || {}) as Record<string, any>;

  const boxById: Record<string, any> = {};
  Object.values(elements)
    .filter((el: any) => el?.type === 'UserModelName')
    .forEach((el: any) => {
      boxById[el.id] = el;
    });

  // Undirected box adjacency within this profile.
  const adjacency: Record<string, string[]> = {};
  Object.values(relationships).forEach((rel: any) => {
    const s = rel?.source?.element;
    const t = rel?.target?.element;
    if (typeof s !== 'string' || typeof t !== 'string') return;
    if (!boxById[s] || !boxById[t]) return;
    (adjacency[s] ||= []).push(t);
    (adjacency[t] ||= []).push(s);
  });

  const visited = new Set<string>();

  // Recursively build an instance from a box, matching linked neighbour boxes to
  // this class's metamodel children by className. `visited` is marked before
  // recursion so an in-profile diamond attaches each shared box to its first
  // parent only (first-parent-wins).
  const build = (metaNode: MetaNode, box: any): Instance => {
    visited.add(box.id);
    const instance: Instance = {
      key: makeInstanceKey(metaNode.className),
      className: metaNode.className,
      classId: metaNode.classId,
      icon: metaNode.icon,
      attributes: readAttributes(metaNode, box, elements),
      children: {},
      boxId: box.id,
    };

    if (isUserPersonalizationSpec(box.personalization) && !isPersonalizationSpecEmpty(box.personalization)) {
      instance.personalization = box.personalization as UserPersonalizationSpec;
    }

    // Group not-yet-visited neighbour boxes by class name.
    const neighboursByClass: Record<string, any[]> = {};
    (adjacency[box.id] || []).forEach((nid) => {
      if (visited.has(nid)) return;
      const nbBox = boxById[nid];
      if (!nbBox) return;
      const cn = nbBox.className || nbBox.name || '';
      if (!cn) return;
      (neighboursByClass[cn] ||= []).push(nbBox);
    });

    metaNode.children.forEach((childRef) => {
      const childMeta = tree.byClassName[childRef.className];
      if (!childMeta) return;
      const childBoxes = (neighboursByClass[childRef.className] || []).filter((cb) => !visited.has(cb.id));
      if (childBoxes.length === 0) return; // part not present -> disabled

      if (childRef.multiplicity === 'single') {
        instance.children[childRef.className] = [build(childMeta, childBoxes[0])];
      } else {
        instance.children[childRef.className] = childBoxes.map((cb) => build(childMeta, cb));
      }
    });

    return instance;
  };

  const rootBox = boxById[rootBoxId];
  if (!rootBox) return null;
  return build(rootMeta, rootBox);
};

/**
 * Parse every user profile on a `UserDiagram` into its own `Instance` tree.
 * A profile is a `User` box plus its reachable subgraph ("Users are walls" —
 * see user-profile-graph). Returns [] when there is no `User` box.
 */
export const parseUserDiagramProfiles = (
  model: UMLModel | null | undefined,
  tree: MetaTree,
): Instance[] => {
  if (!tree.root) return [];
  return splitUserDiagramIntoProfiles(model)
    .map((sub) => buildProfileInstance(sub.model, sub.rootBoxId, tree))
    .filter((instance): instance is Instance => instance !== null);
};

/**
 * Parse the *first* user profile on a model (back-compat single-profile view).
 * Falls back to an empty root instance when the diagram has no `User` box.
 */
export const parseUserDiagramModel = (model: UMLModel | null | undefined, tree: MetaTree): Instance | null => {
  const rootMeta = tree.root;
  if (!rootMeta) return null;
  const profiles = parseUserDiagramProfiles(model, tree);
  return profiles[0] ?? createEmptyInstance(rootMeta);
};

/**
 * Compact, order-insensitive signature of an instance tree used to detect
 * whether a reparsed model actually differs from the current form state
 * (so the live-sync listener can avoid redundant re-renders / write loops).
 */
export const instanceSignature = (instance: Instance | null): string => {
  if (!instance) return '';
  const attrs = instance.attributes
    // Keep an attribute if it carries a value OR a personalization spec —
    // otherwise a spec on an unset attribute would be invisible to
    // change-detection and the two views would silently drift.
    .filter(
      (a) =>
        (a.value != null && String(a.value).trim() !== '') ||
        !isPersonalizationSpecEmpty(a.personalization),
    )
    .map((a) => `${a.name}${a.operator}${a.value}#${personalizationSignature(a.personalization)}`)
    .sort()
    .join('|');
  const children = Object.keys(instance.children)
    .sort()
    .map((cn) => `${cn}:[${instance.children[cn].map(instanceSignature).sort().join(',')}]`)
    .join(';');
  return `${instance.className}{${attrs}}(${children})@${personalizationSignature(instance.personalization)}`;
};
