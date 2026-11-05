/**
 * What a teammate changed in the class diagrams between two versions of a repository's model.
 * Layout is ignored, and so are the fields the editor adds when it rewrites a loaded model.
 */
import type { BesserProject } from '../../types/project';
import { bareMemberName, classModelElements, type ClassModelElement } from './modelAttribution';

export interface ModelChanges {
  added: ClassModelElement[];
  changed: (ClassModelElement & { previousName: string })[];
  removed: ClassModelElement[];
}

/** What a member or class reads as: `+ email: str` and `email` typed `str` are the same attribute. */
const signature = ({ name, type }: ClassModelElement): string => {
  const typeInName = name.includes(':') ? name.split(':').slice(1).join(':').trim() : '';
  return `${bareMemberName(name)}|${typeInName || type || ''}`;
};

export function diffClassModels(base: BesserProject | null, head: BesserProject): ModelChanges {
  const before = base ? classModelElements(base) : new Map<string, ClassModelElement>();
  const after = classModelElements(head);
  const changes: ModelChanges = { added: [], changed: [], removed: [] };
  for (const [id, element] of after) {
    const previous = before.get(id);
    if (!previous) changes.added.push(element);
    else if (signature(previous) !== signature(element)) changes.changed.push({ ...element, previousName: previous.name });
  }
  for (const [id, element] of before) {
    if (!after.has(id)) changes.removed.push(element);
  }
  return changes;
}

type ApollonModel = { elements?: Record<string, unknown>; relationships?: Record<string, unknown> };

/**
 * The ids to draw from `headModel` (an Apollon diagram): new relationships, and the
 * classes that are new or changed, whole, since a class is drawn with its members.
 */
export function idsToDraw(changes: ModelChanges, baseModel: unknown, headModel: unknown): string[] {
  const head = (headModel ?? {}) as ApollonModel;
  const base = (baseModel ?? {}) as ApollonModel;
  const classes = new Set(
    [...changes.added, ...changes.changed].map((element) => element.ownerId ?? element.id),
  );
  const relationships = Object.keys(head.relationships ?? {}).filter((id) => !base.relationships?.[id]);
  return [...[...classes].filter((id) => head.elements?.[id]), ...relationships];
}
