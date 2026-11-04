/**
 * Who added a class or attribute (`project.attribution`, stamped by the backend
 * on each save to GitHub, see its `model_attribution.py`) and what a pull
 * brought in. Reads both editor formats: Apollon `elements`, React Flow `nodes`.
 */
import type { BesserProject } from '../../types/project';

export interface ClassModelElement {
  id: string;
  name: string;
  /** The class a member belongs to; absent on a class. */
  ownerId?: string;
}

const APOLLON_CLASS_TYPES = new Set(['Class', 'AbstractClass', 'Interface', 'Enumeration']);
const APOLLON_MEMBER_TYPES = new Set(['ClassAttribute', 'ClassMethod']);

type Loose = Record<string, unknown>;

const memberRows = (data: Loose): Loose[] =>
  [data.attributes, data.methods].flatMap((rows) => (Array.isArray(rows) ? (rows as Loose[]) : []));

/** The classes and members of a project's class diagrams, by id. */
export function classModelElements(project: BesserProject): Map<string, ClassModelElement> {
  const found = new Map<string, ClassModelElement>();
  const add = (id: unknown, name: unknown, ownerId?: string) => {
    if (typeof id === 'string') found.set(id, { id, name: typeof name === 'string' ? name : '', ownerId });
  };
  for (const diagram of project.diagrams?.ClassDiagram ?? []) {
    const model = diagram?.model as unknown as Loose | null | undefined;
    const elements = (model?.elements ?? {}) as Record<string, Loose>;
    for (const [id, element] of Object.entries(elements)) {
      if (APOLLON_CLASS_TYPES.has(element?.type as string)) add(id, element.name);
      if (APOLLON_MEMBER_TYPES.has(element?.type as string)) add(id, element.name, element.owner as string);
    }
    const nodes = Array.isArray(model?.nodes) ? (model?.nodes as Loose[]) : [];
    for (const node of nodes) {
      if (node?.type !== 'class') continue;
      const data = (node.data ?? {}) as Loose;
      add(node.id, data.name);
      for (const row of memberRows(data)) add(row.id, row.name, node.id as string);
    }
  }
  return found;
}

/**
 * What `incoming` adds over `local`: elements `local` lacks that have a record.
 * A model nobody credited (an older editor's, a hand edit) marks nothing.
 */
export function newElementIds(incoming: BesserProject, local: BesserProject): string[] {
  const known = classModelElements(local);
  return [...classModelElements(incoming).keys()].filter((id) => !known.has(id) && !!incoming.attribution?.[id]);
}

/** A member's bare name: `+ title: str` is `title`, `+ lend(days: int)` is `lend`. */
const bareMemberName = (name: string): string => name.replace(/^\s*[-+#~]\s*/, '').split(/[:(]/)[0].trim();

/** How an element reads in a list: `Book`, or `Book.title` for a member. */
export function elementLabel(element: ClassModelElement, elements: Map<string, ClassModelElement>): string {
  if (!element.ownerId) return element.name;
  const owner = elements.get(element.ownerId)?.name;
  const member = bareMemberName(element.name);
  return owner ? `${owner}.${member}` : member;
}
