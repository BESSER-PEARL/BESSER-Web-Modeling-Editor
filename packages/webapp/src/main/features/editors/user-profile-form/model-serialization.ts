/**
 * The sync core: pure conversion between the form's `Instance` tree and an
 * Apollon `UserDiagram` `UMLModel`.
 *
 * The output shape (UserModelName boxes + UserModelAttribute criteria +
 * optional UserModelIcon + ObjectLink relationships) is identical to what the
 * assistant's `UserDiagramConverter` and the graphical editor produce, so a
 * profile authored in the form is indistinguishable from one drawn by hand.
 */

import type { UMLModel } from '@besser/wme';
import { AttrValue, Instance, OPERATORS, Operator } from './types';
import { MetaNode, MetaTree, ROOT_CLASS_NAME } from './metamodel-tree';

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

/** Collect existing box bounds keyed by `className#ordinal` for position reuse. */
const collectExistingBounds = (model?: UMLModel | null): Record<string, Bounds> => {
  const out: Record<string, Bounds> = {};
  if (!model?.elements) return out;
  const ordinals: Record<string, number> = {};
  Object.values(model.elements as Record<string, any>)
    .filter((el: any) => el?.type === 'UserModelName')
    .forEach((el: any) => {
      const cn = el.className || el.name || 'unknown';
      const ord = ordinals[cn] ?? 0;
      ordinals[cn] = ord + 1;
      if (el.bounds) out[`${cn}#${ord}`] = el.bounds;
    });
  return out;
};

const instanceDisplayName = (className: string, ordinal: number): string =>
  `${className.charAt(0).toLowerCase() + className.slice(1)}_${ordinal + 1}`;

export const buildUserDiagramModel = (
  root: Instance | null,
  _tree: MetaTree,
  existingModel?: UMLModel | null,
): UMLModel => {
  const elements: Record<string, any> = {};
  const relationships: Record<string, any> = {};
  const existingBounds = collectExistingBounds(existingModel);

  let counter = 0;
  const nextId = (prefix: string) => `up_${prefix}_${counter++}`;

  const ordinalByClass: Record<string, number> = {};
  const xCursorByDepth: Record<number, number> = {};

  const emit = (instance: Instance, parentBoxId: string | null, depth: number): void => {
    const ord = ordinalByClass[instance.className] ?? 0;
    ordinalByClass[instance.className] = ord + 1;

    // Emit every metamodel attribute as a row (not just the ones with a value),
    // so all fields are present on the canvas box and can be edited manually
    // there. Unset attributes render as `name = `.
    const rows = instance.attributes;
    const height = 50 + rows.length * 30;

    // Position: reuse the existing layout when we can match a box, else place
    // on a simple per-depth grid (User centred at top, parts in rows below).
    const preserved = existingBounds[`${instance.className}#${ord}`];
    let x: number;
    let y: number;
    if (preserved) {
      x = preserved.x;
      y = preserved.y;
    } else if (depth === 0) {
      x = 600;
      y = 40;
    } else {
      const col = xCursorByDepth[depth] ?? 0;
      xCursorByDepth[depth] = col + 1;
      x = 40 + col * 260;
      y = 40 + depth * 200;
    }

    const boxId = nextId('name');
    const box: any = {
      type: 'UserModelName',
      id: boxId,
      name: instanceDisplayName(instance.className, ord),
      owner: null,
      bounds: { x, y, width: 200, height },
      attributes: [] as string[],
      methods: [],
    };
    if (instance.className) box.className = instance.className;
    if (instance.classId) box.classId = instance.classId;

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
      elements[attrId] = attrEl;
      currentY += 30;
    });

    elements[boxId] = box;

    if (parentBoxId) {
      const linkId = nextId('link');
      // Shape mirrors the assistant's UserDiagramConverter output, which the
      // editor is known to accept for UserModelName boxes.
      relationships[linkId] = {
        id: linkId,
        type: 'ObjectLink',
        source: {
          element: parentBoxId,
          direction: 'Right',
          bounds: { x: 0, y: 0, width: 0, height: 0 },
        },
        target: {
          element: boxId,
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
    }

    Object.values(instance.children).forEach((list) => {
      list.forEach((child) => emit(child, boxId, depth + 1));
    });
  };

  if (root) emit(root, null, 0);

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

    if (target) {
      target.operator = operator;
      target.value = parsed.value;
    } else if (parsed.name) {
      // Criterion not present in the metamodel — keep it so nothing is lost.
      result.push({
        attributeId: attrEl.attributeId,
        name: parsed.name,
        operator,
        value: parsed.value,
      });
    }
  });

  return result;
};

export const parseUserDiagramModel = (model: UMLModel | null | undefined, tree: MetaTree): Instance | null => {
  const rootMeta = tree.root;
  if (!rootMeta) return null;

  const elements = (model?.elements || {}) as Record<string, any>;

  // Group the profile boxes by class name.
  const byClass: Record<string, any[]> = {};
  Object.values(elements)
    .filter((el: any) => el?.type === 'UserModelName')
    .forEach((el: any) => {
      const cn = el.className || el.name || '';
      if (!cn) return;
      (byClass[cn] ||= []).push(el);
    });

  // Recursively build an instance from a metamodel node and its backing box.
  const buildInstance = (metaNode: MetaNode, box: any | undefined): Instance => {
    const instance: Instance = {
      key: makeInstanceKey(metaNode.className),
      className: metaNode.className,
      classId: metaNode.classId,
      icon: metaNode.icon,
      attributes: box ? readAttributes(metaNode, box, elements) : createEmptyInstance(metaNode).attributes,
      children: {},
    };

    metaNode.children.forEach((childRef) => {
      const childMeta = tree.byClassName[childRef.className];
      if (!childMeta) return;
      const childBoxes = byClass[childRef.className] || [];
      if (childBoxes.length === 0) return; // part not present -> disabled

      if (childRef.multiplicity === 'single') {
        instance.children[childRef.className] = [buildInstance(childMeta, childBoxes[0])];
      } else {
        instance.children[childRef.className] = childBoxes.map((cb) => buildInstance(childMeta, cb));
      }
    });

    return instance;
  };

  const rootBox = (byClass[ROOT_CLASS_NAME] || [])[0];
  return buildInstance(rootMeta, rootBox);
};

/**
 * Compact, order-insensitive signature of an instance tree used to detect
 * whether a reparsed model actually differs from the current form state
 * (so the live-sync listener can avoid redundant re-renders / write loops).
 */
export const instanceSignature = (instance: Instance | null): string => {
  if (!instance) return '';
  const attrs = instance.attributes
    .filter((a) => a.value != null && String(a.value).trim() !== '')
    .map((a) => `${a.name}${a.operator}${a.value}`)
    .sort()
    .join('|');
  const children = Object.keys(instance.children)
    .sort()
    .map((cn) => `${cn}:[${instance.children[cn].map(instanceSignature).sort().join(',')}]`)
    .join(';');
  return `${instance.className}{${attrs}}(${children})`;
};
