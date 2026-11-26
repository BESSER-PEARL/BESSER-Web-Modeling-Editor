/**
 * What the assistant changed in a diagram: the elements and relationships it added, modified and
 * deleted, kept for its last few edits so the canvas can mark them, newest first. Only the marks
 * are kept, in this browser (`agentChangeMarks.ts`); the model is never touched. Reads Apollon
 * models, the format of every diagram the assistant draws on the canvas.
 */
import { isUMLModel } from '../../types/project';
import { bareMemberName } from '../github/modelAttribution';
import { readAgentChanges, writeAgentChanges } from '../storage/agentChangeMarks';

// How many of the assistant's edits stay marked; older ones are drawn fainter.
export const MAX_AGENT_ITERATIONS = 3;

// Where an element is drawn is not a change to it.
const LAYOUT_KEYS = new Set(['bounds', 'path', 'isManuallyLayouted']);
const END_LAYOUT_KEYS = new Set(['direction', 'bounds']);

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** An element or relationship the assistant deleted, with where it was, to draw it as a ghost. */
export interface DeletedMark {
  id: string;
  label: string;
  relationship?: boolean;
  /** Where it was, in model coordinates; absent when it cannot be drawn where it was. */
  bounds?: Bounds;
  /** A relationship's line, in model coordinates. */
  points?: { x: number; y: number }[];
}

export interface AgentIteration {
  at: string;
  added: string[];
  modified: string[];
  deleted: DeletedMark[];
}

type Loose = Record<string, unknown>;
type ApollonModel = { elements: Record<string, Loose>; relationships: Record<string, Loose> };

const isObject = (value: unknown): value is Loose => !!value && typeof value === 'object' && !Array.isArray(value);

function apollon(model: unknown): ApollonModel {
  const value = isUMLModel(model) ? (model as unknown as Loose) : {};
  return {
    elements: isObject(value.elements) ? (value.elements as Record<string, Loose>) : {},
    relationships: isObject(value.relationships) ? (value.relationships as Record<string, Loose>) : {},
  };
}

const isBounds = (value: unknown): value is Bounds =>
  isObject(value) && ['x', 'y', 'width', 'height'].every((key) => typeof value[key] === 'number');

/**
 * JSON with sorted keys, so two equal objects read the same whatever order their keys came in. An undefined
 * key is left out, as JSON does: the editor keeps unset fields as undefined, a JSON copy of the model drops them.
 */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (isObject(value)) {
    const keys = Object.keys(value).filter((key) => value[key] !== undefined).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/**
 * What an element or relationship is, without where it is drawn. Lists of child ids (a class's
 * attributes and methods) are left out too: a new or deleted child is marked on its own.
 */
function content(item: Loose, ids: Set<string>): string {
  const kept: Loose = {};
  for (const [key, value] of Object.entries(item)) {
    if (LAYOUT_KEYS.has(key)) continue;
    if (Array.isArray(value) && value.every((entry) => typeof entry === 'string' && ids.has(entry))) continue;
    if ((key === 'source' || key === 'target') && isObject(value)) {
      kept[key] = Object.fromEntries(Object.entries(value).filter(([endKey]) => !END_LAYOUT_KEYS.has(endKey)));
    } else kept[key] = value;
  }
  return stable(kept);
}

const nameOf = (item: Loose | undefined): string => (typeof item?.name === 'string' ? item.name.trim() : '');

/** How an element reads in a list: `Book`, or `Book.title` for a member. */
export function elementName(id: string, elements: Record<string, Loose>): string {
  const element = elements[id];
  const name = nameOf(element) || (typeof element?.type === 'string' ? element.type : id);
  const owner = typeof element?.owner === 'string' ? nameOf(elements[element.owner]) : '';
  return owner ? `${owner}.${bareMemberName(name)}` : name;
}

/** How a relationship reads in a list: its name, else `Guest – Review`. */
export function relationshipName(id: string, model: ApollonModel): string {
  const relationship = model.relationships[id];
  const name = nameOf(relationship);
  if (name) return name;
  const end = (side: unknown) => {
    const elementId = isObject(side) && typeof side.element === 'string' ? side.element : '';
    return (elementId && nameOf(model.elements[elementId])) || '?';
  };
  return `${end(relationship?.source)} – ${end(relationship?.target)}`;
}

/** The changes from `before` to `after`, two Apollon models; everything is added when there was no model. */
export function diffDiagramModels(before: unknown, after: unknown): Omit<AgentIteration, 'at'> {
  const base = apollon(before);
  const head = apollon(after);
  const ids = new Set([
    ...Object.keys(base.elements),
    ...Object.keys(head.elements),
    ...Object.keys(base.relationships),
    ...Object.keys(head.relationships),
  ]);
  const added: string[] = [];
  const modified = new Set<string>();
  const deleted: DeletedMark[] = [];

  for (const kind of ['elements', 'relationships'] as const) {
    for (const [id, item] of Object.entries(head[kind])) {
      const previous = base[kind][id];
      if (!previous) added.push(id);
      else if (content(previous, ids) !== content(item, ids)) modified.add(id);
    }
  }

  const baseIds = Object.keys(base.elements);
  // A model rewritten with new ids would be all ghosts under all new elements: list what went, draw nothing.
  const replaced = baseIds.length > 0 && baseIds.every((id) => !head.elements[id]);
  for (const [id, element] of Object.entries(base.elements)) {
    if (head.elements[id]) continue;
    const owner = typeof element.owner === 'string' ? element.owner : undefined;
    if (owner && head.elements[owner]) {
      // A deleted row would be drawn over the rows that moved up: mark its class changed instead.
      modified.add(owner);
      deleted.push({ id, label: elementName(id, base.elements) });
    } else if (!owner || !base.elements[owner]) {
      // Deleted with its owner, it goes with the owner's ghost.
      deleted.push({
        id,
        label: elementName(id, base.elements),
        ...(!replaced && isBounds(element.bounds) ? { bounds: element.bounds } : {}),
      });
    }
  }
  for (const [id, relationship] of Object.entries(base.relationships)) {
    if (head.relationships[id]) continue;
    const { bounds, path } = relationship;
    const points =
      !replaced && isBounds(bounds) && Array.isArray(path)
        ? path.filter(isObject).map((point) => ({ x: bounds.x + Number(point.x), y: bounds.y + Number(point.y) }))
        : [];
    deleted.push({
      id,
      label: relationshipName(id, base),
      relationship: true,
      ...(points.length > 1 && points.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y)) ? { points } : {}),
    });
  }
  return { added, modified: [...modified].filter((id) => !added.includes(id)), deleted };
}

export const hasAgentChanges = ({ added, modified, deleted }: Omit<AgentIteration, 'at'>): boolean =>
  added.length + modified.length + deleted.length > 0;

/** Note one assistant edit of a diagram: its changes become the newest marks. */
export function recordAgentIteration(projectId: string, diagramId: string, before: unknown, after: unknown, at = new Date()): void {
  if (!isUMLModel(after)) return;
  const changes = diffDiagramModels(before, after);
  if (!hasAgentChanges(changes)) return;
  const iterations = [{ at: at.toISOString(), ...changes }, ...readAgentChanges(projectId, diagramId)];
  writeAgentChanges(projectId, diagramId, iterations.slice(0, MAX_AGENT_ITERATIONS));
}

/** The user undid the assistant's last edit: its marks go with it. */
export function dropLatestAgentIteration(projectId: string, diagramId: string): void {
  const iterations = readAgentChanges(projectId, diagramId);
  if (iterations.length) writeAgentChanges(projectId, diagramId, iterations.slice(1));
}

export const clearAgentChanges = (projectId: string, diagramId: string): void => writeAgentChanges(projectId, diagramId, []);
