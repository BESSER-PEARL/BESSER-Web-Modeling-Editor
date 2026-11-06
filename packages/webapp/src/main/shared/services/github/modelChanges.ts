/**
 * What a teammate changed in the class diagrams between two versions of a repository's model.
 * Layout is ignored, and so are the fields the editor adds when it rewrites a loaded model.
 */
import type { RepoCommit } from '../../api/github';
import type { BesserProject } from '../../types/project';
import { bareMemberName, classModelElements, type ClassModelElement } from './modelAttribution';

export interface ModelChanges {
  added: ClassModelElement[];
  changed: (ClassModelElement & { previousName: string })[];
  removed: ClassModelElement[];
  relationshipsAdded: number;
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

type ApollonModel = { elements?: Record<string, unknown>; relationships?: Record<string, unknown> };

const relationshipIds = (project: BesserProject | null): Set<string> =>
  new Set(
    (project?.diagrams?.ClassDiagram ?? []).flatMap((diagram) =>
      Object.keys((diagram?.model as ApollonModel | null | undefined)?.relationships ?? {}),
    ),
  );

export function diffClassModels(base: BesserProject | null, head: BesserProject): ModelChanges {
  const before = base ? classModelElements(base) : new Map<string, ClassModelElement>();
  const after = classModelElements(head);
  const relationshipsBefore = relationshipIds(base);
  const relationshipsAfter = relationshipIds(head);
  const changes: ModelChanges = {
    added: [],
    changed: [],
    removed: [],
    relationshipsAdded: [...relationshipsAfter].filter((id) => !relationshipsBefore.has(id)).length,
    relationshipsRemoved: [...relationshipsBefore].filter((id) => !relationshipsAfter.has(id)).length,
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
  changes.added.length + changes.changed.length + changes.removed.length + changes.relationshipsAdded + changes.relationshipsRemoved > 0;

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
