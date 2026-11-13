/**
 * Where a class diagram draws its classes, members and relationships, in model
 * coordinates, for marks laid over the canvas. Reads both editor formats: the
 * old editor's `elements` / `relationships` (with `bounds` and `path`) and
 * React Flow `nodes` / `edges`.
 */

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

type Loose = Record<string, unknown>;

// The library's class layout (LAYOUT in packages/library/lib/constants.ts).
const HEADER_HEIGHT = 40;
const HEADER_HEIGHT_WITH_STEREOTYPE = 50;
const ROW_HEIGHT = 30;

const isObject = (value: unknown): value is Loose => !!value && typeof value === 'object';
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const v3Elements = (model: unknown): Record<string, Loose> =>
  isObject(model) && isObject(model.elements) ? (model.elements as Record<string, Loose>) : {};
const v3Relationships = (model: unknown): Record<string, Loose> =>
  isObject(model) && isObject(model.relationships) ? (model.relationships as Record<string, Loose>) : {};
const v4Nodes = (model: unknown): Loose[] =>
  isObject(model) && Array.isArray(model.nodes) ? model.nodes.filter(isObject) : [];
const v4Edges = (model: unknown): Loose[] =>
  isObject(model) && Array.isArray(model.edges) ? model.edges.filter(isObject) : [];

const v3Bounds = (element: Loose | undefined): Bounds | null => {
  const bounds = element?.bounds;
  if (!isObject(bounds) || ![bounds.x, bounds.y, bounds.width, bounds.height].every(isNumber)) return null;
  return bounds as unknown as Bounds;
};

/** A node's box in model coordinates; a child node's position is relative to its parent. */
function nodeBounds(nodes: Loose[], node: Loose, depth = 0): Bounds | null {
  const position = node.position;
  const measured = isObject(node.measured) ? node.measured : {};
  const width = isNumber(node.width) ? node.width : measured.width;
  const height = isNumber(node.height) ? node.height : measured.height;
  if (!isObject(position) || !isNumber(position.x) || !isNumber(position.y) || !isNumber(width) || !isNumber(height)) {
    return null;
  }
  let { x, y } = position as { x: number; y: number };
  if (typeof node.parentId === 'string' && depth < 20) {
    const parent = nodes.find((candidate) => candidate.id === node.parentId);
    const parentBounds = parent ? nodeBounds(nodes, parent, depth + 1) : null;
    if (parentBounds) {
      x += parentBounds.x;
      y += parentBounds.y;
    }
  }
  return { x, y, width, height };
}

/** The ids of the classes (not members) the model draws. */
export function classIds(model: unknown): string[] {
  return [
    ...Object.entries(v3Elements(model)).filter(([, element]) => v3Bounds(element) && !element.owner).map(([id]) => id),
    ...v4Nodes(model).filter((node) => typeof node.id === 'string').map((node) => node.id as string),
  ];
}

export const hasClass = (model: unknown, id: string): boolean =>
  !!v3Elements(model)[id] || v4Nodes(model).some((node) => node.id === id);

export const relationshipIds = (model: unknown): string[] => [
  ...Object.keys(v3Relationships(model)),
  ...v4Edges(model).flatMap((edge) => (typeof edge.id === 'string' ? [edge.id] : [])),
];

/** Where a class (or, in the old format, any element) is drawn. */
export function elementBounds(model: unknown, id: string): Bounds | null {
  const v3 = v3Bounds(v3Elements(model)[id]);
  if (v3) return v3;
  const nodes = v4Nodes(model);
  const node = nodes.find((candidate) => candidate.id === id);
  return node ? nodeBounds(nodes, node) : null;
}

/**
 * Where a member row is drawn. A React Flow class lists its attributes, then its
 * methods, under the header; a wrapped row makes this an estimate.
 */
export function memberBounds(model: unknown, id: string): Bounds | null {
  const v3 = v3Bounds(v3Elements(model)[id]);
  if (v3) return v3;
  const nodes = v4Nodes(model);
  for (const node of nodes) {
    const data = isObject(node.data) ? node.data : {};
    const rows = [data.attributes, data.methods].flatMap((list) => (Array.isArray(list) ? list.filter(isObject) : []));
    const index = rows.findIndex((row) => row.id === id);
    if (index < 0) continue;
    const box = nodeBounds(nodes, node);
    if (!box) return null;
    const header = data.stereotype ? HEADER_HEIGHT_WITH_STEREOTYPE : HEADER_HEIGHT;
    return { x: box.x, y: box.y + header + index * ROW_HEIGHT, width: box.width, height: ROW_HEIGHT };
  }
  return null;
}

const center = (box: Bounds): Point => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

/** A relationship's line: its stored route, else straight between the centres of its ends. */
export function relationshipPoints(model: unknown, id: string): Point[] | null {
  const relationship = v3Relationships(model)[id];
  if (relationship) {
    const bounds = v3Bounds(relationship);
    const path = relationship.path;
    return bounds && Array.isArray(path)
      ? path.filter(isObject).map((point) => ({ x: bounds.x + Number(point.x), y: bounds.y + Number(point.y) }))
      : null;
  }
  const edge = v4Edges(model).find((candidate) => candidate.id === id);
  if (!edge) return null;
  const points = isObject(edge.data) && Array.isArray(edge.data.points) ? edge.data.points.filter(isObject) : [];
  if (points.length >= 2 && points.every((point) => isNumber(point.x) && isNumber(point.y))) {
    return points as unknown as Point[];
  }
  const source = typeof edge.source === 'string' ? elementBounds(model, edge.source) : null;
  const target = typeof edge.target === 'string' ? elementBounds(model, edge.target) : null;
  return source && target ? [center(source), center(target)] : null;
}
