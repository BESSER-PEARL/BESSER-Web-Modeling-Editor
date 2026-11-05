/**
 * Who added a class or attribute (`project.attribution`, stamped by the backend
 * on each save to GitHub, see its `model_attribution.py`) and what a pull
 * brought in. Reads both editor formats: Apollon `elements`, React Flow `nodes`.
 */
import type { BesserProject, ElementAttribution } from '../../types/project';

export interface ClassModelElement {
  id: string;
  name: string;
  /** The class a member belongs to; absent on a class. */
  ownerId?: string;
  /** A member's type, when the editor keeps it apart from the name. */
  type?: string;
  /** A member's visibility, when the editor keeps it apart from the name. */
  visibility?: string;
  /** A class's kind: Class, AbstractClass, Interface, Enumeration. */
  kind?: string;
}

const APOLLON_CLASS_TYPES = new Set(['Class', 'AbstractClass', 'Interface', 'Enumeration']);
const APOLLON_MEMBER_TYPES = new Set(['ClassAttribute', 'ClassMethod']);

type Loose = Record<string, unknown>;

const isObject = (value: unknown): value is Loose => !!value && typeof value === 'object';

const memberRows = (data: Loose): Loose[] =>
  [data.attributes, data.methods].flatMap((rows) => (Array.isArray(rows) ? rows.filter(isObject) : []));

/**
 * The well-formed records of an attribution block. The block comes from a file in a repository,
 * which anyone with write access can edit, so nothing about its shape is taken on trust.
 */
export function parseRecords(block: unknown): Map<string, ElementAttribution> {
  const records = new Map<string, ElementAttribution>();
  if (!block || typeof block !== 'object') return records;
  for (const [id, value] of Object.entries(block)) {
    const { addedBy, addedAt } = (value ?? {}) as Partial<Record<keyof ElementAttribution, unknown>>;
    if (typeof addedBy === 'string' && addedBy && typeof addedAt === 'string') records.set(id, { addedBy, addedAt });
  }
  return records;
}

export const elementRecords = (project: BesserProject | null | undefined): Map<string, ElementAttribution> =>
  parseRecords(project?.attribution);

/** The classes and members of a project's class diagrams, by id. */
export function classModelElements(project: BesserProject): Map<string, ClassModelElement> {
  const found = new Map<string, ClassModelElement>();
  const add = (id: unknown, name: unknown, ownerId?: string, details: Loose = {}) => {
    if (typeof id !== 'string') return;
    const { attributeType, visibility, type } = details;
    found.set(id, {
      id,
      name: typeof name === 'string' ? name : '',
      ownerId,
      ...(typeof attributeType === 'string' ? { type: attributeType } : {}),
      ...(typeof visibility === 'string' ? { visibility } : {}),
      ...(!ownerId && typeof type === 'string' ? { kind: type } : {}),
    });
  };
  for (const diagram of project.diagrams?.ClassDiagram ?? []) {
    const model = diagram?.model as unknown as Loose | null | undefined;
    const elements = (model?.elements ?? {}) as Record<string, Loose>;
    for (const [id, element] of Object.entries(elements)) {
      if (APOLLON_CLASS_TYPES.has(element?.type as string)) add(id, element.name, undefined, element);
      if (APOLLON_MEMBER_TYPES.has(element?.type as string)) add(id, element.name, element.owner as string, element);
    }
    const nodes = Array.isArray(model?.nodes) ? model.nodes.filter(isObject) : [];
    for (const node of nodes) {
      if (node.type !== 'class') continue;
      const data = isObject(node.data) ? node.data : {};
      add(node.id, data.name);
      for (const row of memberRows(data)) add(row.id, row.name, node.id as string, row);
    }
  }
  return found;
}

/**
 * What `incoming` adds over `local`: elements `local` lacks that have a record.
 * A model nobody credited (an older editor's, a hand edit) marks nothing, and
 * nor does an element the repo already held at the last sync (`synced`):
 * `local` lost that one by deleting it.
 */
export function newElementIds(incoming: BesserProject, local: BesserProject, synced?: readonly string[]): string[] {
  const known = classModelElements(local);
  const held = new Set(synced);
  const records = elementRecords(incoming);
  return [...classModelElements(incoming).keys()].filter((id) => !known.has(id) && !held.has(id) && records.has(id));
}

/** A member's bare name: `+ title: str` is `title`, `+ lend(days: int)` is `lend`. */
export const bareMemberName = (name: string): string => name.replace(/^\s*[-+#~]\s*/, '').split(/[:(]/)[0].trim();

/** How an element reads in a list: `Book`, or `Book.title` for a member. */
export function elementLabel(element: ClassModelElement, elements: Map<string, ClassModelElement>): string {
  if (!element.ownerId) return element.name;
  const owner = elements.get(element.ownerId)?.name;
  const member = bareMemberName(element.name);
  return owner ? `${owner}.${member}` : member;
}
