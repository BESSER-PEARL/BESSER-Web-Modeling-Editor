/**
 * The sync core: pure conversion between the form's `Instance` tree and a
 * v4 `UserDiagram` `UMLModel`.
 *
 * The output shape is the library's canonical UserDiagram form — one
 * `UserModelName` node per profile box with its criteria inline on
 * `data.attributes` (`{id, name, attributeOperator, value, attributeId}` rows),
 * the metamodel icon on `data.icon`, and `UserModelLink` edges between a
 * container and its parts. It is identical to what the assistant's
 * `UserDiagramConverter` and the graphical editor produce, so a profile
 * authored in the form is indistinguishable from one drawn by hand.
 *
 * Reading is tolerant: legacy v3 payloads (`elements` / `relationships`
 * records with separate `UserModelAttribute` children) are lifted through
 * the library's v3 → v4 migrator before parsing.
 */

import { convertV3ToV4 } from '@besser/wme';
import type { BesserEdge, BesserNode, UMLModel } from '@besser/wme';
import { AttrValue, Instance, OPERATORS, Operator } from './types';
import { MetaNode, MetaTree, ROOT_CLASS_NAME } from './metamodel-tree';
import { uuid } from '../../../shared/utils/uuid';

/** React Flow node type of a profile box. */
export const USER_NODE_TYPE = 'UserModelName';
/** Edge type linking a container box to one of its parts (rendered like ObjectLink). */
export const USER_LINK_TYPE = 'UserModelLink';

const NODE_WIDTH = 200;
const HEADER_HEIGHT = 50;
const ROW_HEIGHT = 30;

let keyCounter = 0;
/** Unique, deterministic-per-session React key for a form instance. */
export const makeInstanceKey = (className: string): string => `${className}-k${keyCounter++}`;

const normalizeOperator = (raw?: string): Operator => {
  if (typeof raw !== 'string') return '==';
  const op = raw.trim() === '=' ? '==' : raw.trim();
  return (OPERATORS as readonly string[]).includes(op) ? (op as Operator) : '==';
};

/** Split a criterion name like `age >= 18` into its parts (a bare `age` yields an empty value). */
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

const hasValue = (value: unknown): boolean => value !== undefined && value !== null && String(value).trim() !== '';

/* ------------------------------------------------------------------ */
/*  v4 wire-shape helpers                                              */
/* ------------------------------------------------------------------ */

/** One criterion row as stored on `UserModelName.data.attributes`. */
interface UserAttributeRow {
  id: string;
  name: string;
  attributeType?: string;
  attributeOperator?: string;
  attributeId?: string;
  value?: unknown;
}

interface UserNodeData {
  name?: string;
  className?: string;
  classId?: string;
  icon?: string;
  view?: 'icon' | 'attributes';
  attributes?: UserAttributeRow[];
  methods?: unknown[];
}

type UserNode = BesserNode & { data: UserNodeData };

// The UserDiagram node types are registered at runtime, so compare on the raw string.
const isUserNode = (node: BesserNode | undefined): node is UserNode =>
  (node?.type as string | undefined) === USER_NODE_TYPE;

/**
 * Lift whatever the caller hands us to v4 `{nodes, edges}`. `editor.model`
 * is always v4; legacy v3 payloads (persisted before the migration) are run
 * through the library migrator so the parser only walks node arrays.
 */
const toV4 = (model: unknown): UMLModel | null => {
  if (!model || typeof model !== 'object') return null;
  const m = model as Record<string, any>;
  if (Array.isArray(m.nodes)) return m as unknown as UMLModel;
  if (m.elements && typeof m.elements === 'object') {
    try {
      return convertV3ToV4({
        version: '3.0.0',
        type: 'UserDiagram',
        size: { width: 0, height: 0 },
        interactive: { elements: {}, relationships: {} },
        assessments: {},
        relationships: {},
        ...m,
      } as any);
    } catch {
      return null;
    }
  }
  return null;
};

const userNodesOf = (model: UMLModel | null): UserNode[] => (model?.nodes ?? []).filter(isUserNode);

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

const lowerFirst = (className: string): string => className.charAt(0).toLowerCase() + className.slice(1);

/**
 * Build a criterion row for the canvas. The bare attribute name is kept in
 * `name`; the comparator and the value live in their own fields (the node
 * renderer composes `age >= 18` for display, the inspector edits them apart).
 * `value` is only written when set, so an untouched field stays a plain row.
 */
const buildAttributeRow = (attr: AttrValue, id: string): UserAttributeRow => {
  const row: UserAttributeRow = {
    id,
    name: attr.name,
    attributeOperator: attr.operator,
  };
  if (attr.type) row.attributeType = attr.type;
  if (attr.attributeId) row.attributeId = attr.attributeId;
  if (hasValue(attr.value)) row.value = attr.value;
  return row;
};

const collectNodeIds = (instance: Instance | null, out: Set<string>): Set<string> => {
  if (!instance) return out;
  if (instance.nodeId) out.add(instance.nodeId);
  Object.values(instance.children).forEach((list) => list.forEach((child) => collectNodeIds(child, out)));
  return out;
};

/**
 * Write the form's instance tree into the model. Only the boxes the form
 * represents (those `parseUserDiagramModel` reads from `existingModel`) are
 * rewritten, in place and matched by node id; every other node and link is
 * kept as it is. New parts get the next free `<class>_<n>` name and a free
 * spot below their container.
 *
 * New instances are assigned their box id (`instance.nodeId`) here, so the
 * next write of the same form state updates the box instead of adding one.
 */
export const buildUserDiagramModel = (
  root: Instance | null,
  tree: MetaTree,
  existingModel?: UMLModel | null,
): UMLModel => {
  const existing = toV4(existingModel);
  const existingNodes = existing?.nodes ?? [];
  const existingById = new Map(existingNodes.map((n) => [n.id, n]));

  // Boxes the form owns: rewritten (or dropped when removed from the form).
  const owned = collectNodeIds(existing ? parseUserDiagramModel(existing, tree) : null, new Set());
  const ownedOrLegacyRow = (n: BesserNode) =>
    owned.has(n.id) || ((n.type as string) === 'UserModelAttribute' && !!n.parentId && owned.has(n.parentId));
  const kept = existingNodes.filter((n) => !ownedOrLegacyRow(n));

  const nodes: BesserNode[] = [];
  const placed: Array<{ x: number; y: number; width: number; height: number }> = existingNodes.map((n) => ({
    x: n.position?.x ?? 0,
    y: n.position?.y ?? 0,
    width: n.width ?? NODE_WIDTH,
    height: n.height ?? HEADER_HEIGHT,
  }));
  const freeSpot = (x: number, y: number, width: number, height: number) => {
    const overlaps = (px: number) =>
      placed.some((r) => px < r.x + r.width && px + width > r.x && y < r.y + r.height && y + height > r.y);
    while (overlaps(x)) x += NODE_WIDTH + 60;
    return { x, y };
  };

  // Next free `<class>_<n>` per class, over every name already on the canvas.
  const nextOrdinal: Record<string, number> = {};
  const nextName = (className: string): string => {
    const prefix = `${lowerFirst(className)}_`;
    if (nextOrdinal[className] === undefined) {
      nextOrdinal[className] = existingNodes.reduce((max, n) => {
        const name = (n.data as UserNodeData | undefined)?.name;
        const m = typeof name === 'string' && name.startsWith(prefix) ? name.slice(prefix.length).match(/^(\d+)$/) : null;
        return m ? Math.max(max, Number(m[1])) : max;
      }, 0);
    }
    nextOrdinal[className] += 1;
    return `${prefix}${nextOrdinal[className]}`;
  };

  const links: Array<{ source: string; target: string }> = [];

  const emit = (instance: Instance, parent: { id: string; x: number; y: number } | null): void => {
    const previous = instance.nodeId ? existingById.get(instance.nodeId) : undefined;
    const previousData = isUserNode(previous) ? previous.data : undefined;
    const previousRows = Array.isArray(previousData?.attributes) ? previousData.attributes : [];

    // Emit every metamodel attribute as a row (not just the ones with a value),
    // so all fields are present on the canvas box and can be edited manually
    // there. Unset attributes render without a value. Row ids are kept.
    const rows = instance.attributes.map((attr) => {
      const match = previousRows.find(
        (r) => (attr.attributeId && r.attributeId === attr.attributeId) || r.name === attr.name,
      );
      return buildAttributeRow(attr, match?.id ?? uuid());
    });
    const height = HEADER_HEIGHT + rows.length * ROW_HEIGHT;
    const width = previous?.width || NODE_WIDTH;

    let position: { x: number; y: number };
    if (previous?.position) {
      position = { x: previous.position.x, y: previous.position.y };
    } else {
      position = parent ? freeSpot(parent.x, parent.y + 200, width, height) : freeSpot(600, 40, width, height);
      placed.push({ ...position, width, height });
    }

    const boxId = instance.nodeId ?? uuid();
    instance.nodeId = boxId;
    const data: UserNodeData = {
      ...(previousData ?? {}),
      name: previousData?.name || nextName(instance.className),
      attributes: rows,
      methods: previousData?.methods ?? [],
      // Profile boxes render in icon view (the editor's preferred UserDiagram preview).
      view: previousData?.view ?? 'icon',
    };
    if (instance.className) data.className = instance.className;
    if (instance.classId) data.classId = instance.classId;
    if (typeof instance.icon === 'string' && instance.icon.trim() !== '') data.icon = instance.icon;

    nodes.push({
      ...(previous ?? {}),
      id: boxId,
      type: USER_NODE_TYPE as any,
      position,
      width,
      height,
      measured: { width, height },
      data: data as Record<string, any>,
    } as BesserNode);

    if (parent) links.push({ source: parent.id, target: boxId });

    Object.values(instance.children).forEach((list) => {
      list.forEach((child) => emit(child, { id: boxId, ...position }));
    });
  };

  if (root) emit(root, null);

  const allNodes = [...kept, ...nodes];
  const nodeIds = new Set(allNodes.map((n) => n.id));
  // Existing links survive while both ends do; a container->part link is only
  // added when the canvas does not already connect the two boxes.
  const edges: BesserEdge[] = (existing?.edges ?? []).filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));
  links.forEach(({ source, target }) => {
    if (edges.some((e) => e.source === source && e.target === target)) return;
    // Shape mirrors the assistant's UserDiagramConverter output, which the
    // editor is known to accept for UserModelName boxes.
    edges.push({
      id: uuid(),
      type: USER_LINK_TYPE as any,
      source,
      target,
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: '',
        isManuallyLayouted: false,
        // No stored waypoints: the edge auto-routes between the boxes.
        points: [],
      },
    });
  });

  return {
    version: '4.0.0',
    id: existing?.id ?? '',
    title: existing?.title ?? '',
    type: 'UserDiagram',
    nodes: allNodes.filter((n) => !n.parentId || nodeIds.has(n.parentId)),
    edges,
    assessments: existing?.assessments ?? {},
  } as unknown as UMLModel;
};

/* ------------------------------------------------------------------ */
/*  UMLModel  ->  Instance tree                                        */
/* ------------------------------------------------------------------ */

/**
 * All criterion rows of a box: the inline `data.attributes` rows plus any
 * legacy standalone `UserModelAttribute` node still parented to the box.
 */
const criterionRowsOf = (box: UserNode, allNodes: BesserNode[]): UserAttributeRow[] => {
  const inline = Array.isArray(box.data.attributes) ? box.data.attributes : [];
  const standalone = allNodes
    .filter((n) => (n.type as string) === 'UserModelAttribute' && n.parentId === box.id)
    .map((n) => {
      const d = (n.data ?? {}) as Record<string, any>;
      return {
        id: n.id,
        name: typeof d.name === 'string' ? d.name : '',
        attributeType: d.attributeType,
        attributeOperator: d.attributeOperator,
        attributeId: d.attributeId,
        value: d.value,
      } as UserAttributeRow;
    });
  return [...inline, ...standalone];
};

/** Read an instance's attribute values, overlaying stored criteria onto the metamodel attributes. */
const readAttributes = (metaNode: MetaNode, box: UserNode, allNodes: BesserNode[]): AttrValue[] => {
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

  criterionRowsOf(box, allNodes).forEach((row) => {
    if (!row) return;
    // Rows normally carry a bare name with the comparator / value in their
    // own fields; legacy rows embed the whole criterion (`age >= 18`) in
    // `name`. Explicit fields win over anything parsed from the name.
    const parsed = parseCriterion(typeof row.name === 'string' ? row.name : '');
    const operator = row.attributeOperator ? normalizeOperator(row.attributeOperator) : parsed.operator;
    const value = hasValue(row.value) ? String(row.value).trim() : parsed.value;

    // Match to a metamodel attribute by id first, then by name.
    const target =
      (row.attributeId && result.find((r) => r.attributeId === row.attributeId)) ||
      result.find((r) => r.name === parsed.name);

    if (target) {
      target.operator = operator;
      target.value = value;
    } else if (parsed.name) {
      // Criterion not present in the metamodel — keep it so nothing is lost.
      result.push({
        attributeId: row.attributeId,
        name: parsed.name,
        type: row.attributeType,
        operator,
        value,
      });
    }
  });

  return result;
};

export const parseUserDiagramModel = (model: UMLModel | null | undefined, tree: MetaTree): Instance | null => {
  const rootMeta = tree.root;
  if (!rootMeta) return null;

  const v4 = toV4(model);
  const allNodes = v4?.nodes ?? [];

  // Group the profile boxes by class name.
  const byClass: Record<string, UserNode[]> = {};
  userNodesOf(v4).forEach((node) => {
    const cn = node.data.className || node.data.name || '';
    if (!cn) return;
    (byClass[cn] ||= []).push(node);
  });

  // Recursively build an instance from a metamodel node and its backing box.
  const buildInstance = (metaNode: MetaNode, box: UserNode | undefined): Instance => {
    const instance: Instance = {
      key: makeInstanceKey(metaNode.className),
      ...(box ? { nodeId: box.id } : {}),
      className: metaNode.className,
      classId: metaNode.classId,
      icon: metaNode.icon,
      attributes: box ? readAttributes(metaNode, box, allNodes) : createEmptyInstance(metaNode).attributes,
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
