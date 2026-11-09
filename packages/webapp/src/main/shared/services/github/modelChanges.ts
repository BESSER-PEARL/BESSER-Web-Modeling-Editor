/**
 * What a teammate changed in the class diagrams between two versions of a repository's model.
 * Layout is ignored, and so are the fields the editor adds when it rewrites a loaded model.
 */
import type { RepoCommit } from '../../api/github';
import type { BesserProject } from '../../types/project';
import {
  bareMemberName,
  classModelElements,
  classRelationships,
  type ClassModelElement,
  type ClassRelationship,
} from './modelAttribution';
import { hasClass, relationshipIds } from './modelGeometry';

export interface ModelChanges {
  added: ClassModelElement[];
  changed: (ClassModelElement & { previousName: string })[];
  removed: ClassModelElement[];
  addedRelationships: ClassRelationship[];
  relationshipsRemoved: number;
}

const VISIBILITY_BY_SYMBOL: Record<string, string> = { '+': 'public', '-': 'private', '#': 'protected', '~': 'package' };

/** What an element reads as: `+ email: str` and `email` typed `str` are the same attribute. */
function signature({ name, type, visibility, kind, ownerId }: ClassModelElement): string {
  if (!ownerId) return `${kind ?? ''}|${name.trim()}`;
  const symbol = name.trim().match(/^[+\-#~]/)?.[0];
  const body = name.trim().replace(/^[+\-#~]\s*/, '');
  // A method's parameters have colons of their own: its type comes after the closing parenthesis.
  const colon = body.indexOf(':', body.lastIndexOf(')') + 1);
  const bare = colon >= 0 ? body.slice(0, colon).trim() : body;
  const typeInName = colon >= 0 ? body.slice(colon + 1).trim() : '';
  const visible = visibility ?? (symbol ? VISIBILITY_BY_SYMBOL[symbol] : 'public');
  return `${visible}|${bare}|${typeInName || type || 'str'}`;
}

export function diffClassModels(base: BesserProject | null, head: BesserProject): ModelChanges {
  const before = base ? classModelElements(base) : new Map<string, ClassModelElement>();
  const after = classModelElements(head);
  const relationshipsBefore = classRelationships(base);
  const relationshipsAfter = classRelationships(head);
  const changes: ModelChanges = {
    added: [],
    changed: [],
    removed: [],
    addedRelationships: [...relationshipsAfter.values()].filter(({ id }) => !relationshipsBefore.has(id)),
    relationshipsRemoved: [...relationshipsBefore.keys()].filter((id) => !relationshipsAfter.has(id)).length,
  };
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

export const hasModelChanges = (changes: ModelChanges): boolean =>
  changes.added.length + changes.changed.length + changes.removed.length + changes.addedRelationships.length + changes.relationshipsRemoved > 0;

/**
 * What of the drawing to mark: a new or renamed class whole, but on any other class only its
 * new and changed rows, since the rest of that class is not news.
 */
export function incomingMarks(changes: ModelChanges) {
  const changedElements = [...changes.added, ...changes.changed];
  const wholeClasses = new Set(changedElements.filter((element) => !element.ownerId).map((element) => element.id));
  const rows = changedElements.filter((element) => element.ownerId && !wholeClasses.has(element.ownerId));
  return { wholeClasses, rows };
}

/** The point halfway along a path, for a label on a line. */
export function pathMidpoint(points: { x: number; y: number }[]): { x: number; y: number } | null {
  if (!points.length) return null;
  const segments = points.slice(1).map((point, index) => Math.hypot(point.x - points[index].x, point.y - points[index].y));
  let remaining = segments.reduce((sum, length) => sum + length, 0) / 2;
  for (const [index, length] of segments.entries()) {
    if (remaining <= length && length > 0) {
      const share = remaining / length;
      const from = points[index];
      const to = points[index + 1];
      return { x: from.x + (to.x - from.x) * share, y: from.y + (to.y - from.y) * share };
    }
    remaining -= length;
  }
  return points[0];
}

/**
 * The ids to draw from `headModel` (a class diagram in either editor format): new
 * relationships, and the classes that are new or changed, whole, since a class is
 * drawn with its members.
 */
export function idsToDraw(changes: ModelChanges, baseModel: unknown, headModel: unknown): string[] {
  const classes = new Set(
    [...changes.added, ...changes.changed].map((element) => element.ownerId ?? element.id),
  );
  const before = new Set(relationshipIds(baseModel));
  const relationships = relationshipIds(headModel).filter((id) => !before.has(id));
  return [...[...classes].filter((id) => hasClass(headModel, id)), ...relationships];
}

/** Who a commit is by: the GitHub account when it matched one, else the git name. */
export const commitAuthor = (commit: RepoCommit): string => commit.author_login ?? commit.author;

/** The one person behind `commits`, or null when several are: merges only join others' work. */
export function soleAuthor(commits: RepoCommit[]): string | null {
  const authors = new Set(commits.filter((commit) => !commit.is_merge).map(commitAuthor));
  return authors.size === 1 ? [...authors][0] : null;
}

/** How a member or class reads in a change line: a rename shows both names. */
export const renameLabel = (label: string, previousName: string, name: string): string => {
  const before = bareMemberName(previousName);
  return before && before !== bareMemberName(name) ? `${before} → ${label}` : label;
};
