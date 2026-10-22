/**
 * Copy element ids from the current class diagram onto a rebuilt system spec,
 * so GUI and object diagrams that reference those ids keep working after a
 * whole-diagram rebuild. ClassDiagramConverter then uses the spec ids.
 * Matching rule shared with the backend: BESSER docs/source/web_editor_backend.rst, "Class Diagrams: Element Ids".
 */

import { mapAssistantRelationshipType } from '../shared/relationshipMapping';

const CLASSIFIER_TYPES = new Set(['Class', 'AbstractClass', 'Interface', 'Enumeration']);
const NOT_ASSOCIATIONS = new Set(['ClassOCLLink', 'ClassLinkRel']);
const MEMBER_LISTS = [
  ['attributes', 'ClassAttribute'],
  ['methods', 'ClassMethod'],
] as const;

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** "+ title: str" -> "title", "read(x: int): str" -> "read". */
const memberName = (value: unknown): string => text(text(value).replace(/^[+\-#~]\s*/, '').split(/[:(]/)[0]);

/** Associations of every flavour share one kind; inheritance, realization and dependency keep their own. */
const relationshipKind = (type: unknown): string => {
  const mapping = mapAssistantRelationshipType(typeof type === 'string' ? type : undefined);
  return mapping.navigable ? 'association' : mapping.type;
};

/** First unclaimed candidate with this name, preferring an exact-case match over a case-insensitive one. */
function findByName(candidates: any[], name: string, nameOf: (candidate: any) => string, claimed: Set<string>) {
  if (!name) return undefined;
  const free = candidates.filter((candidate) => !claimed.has(candidate.id));
  return (
    free.find((candidate) => nameOf(candidate) === name) ??
    free.find((candidate) => nameOf(candidate).toLowerCase() === name.toLowerCase())
  );
}

function claim(item: any, id: string, claimed: Set<string>) {
  item.id = id;
  claimed.add(id);
}

/** Rebuild specs carry no ids; drop any, so only name matches decide. Returns how many were dropped. */
function dropSpecIds(classes: any[], relationships: any[]): number {
  const items = [
    ...classes,
    ...classes.flatMap((cls) => MEMBER_LISTS.flatMap(([list]) => (Array.isArray(cls[list]) ? cls[list] : []))),
    ...relationships,
  ];
  let dropped = 0;
  for (const item of items) {
    if (item && typeof item === 'object' && 'id' in item) {
      delete item.id;
      dropped++;
    }
  }
  return dropped;
}

function matchClasses(classes: any[], elements: Record<string, any>, claimed: Set<string>) {
  const existing = Object.values(elements).filter((e: any) => CLASSIFIER_TYPES.has(e?.type));
  for (const cls of classes) {
    const match = findByName(existing, text(cls.className), (e) => text(e.name), claimed);
    if (match) claim(cls, match.id, claimed);
  }
}

/** Attributes, enumeration literals and methods, matched within their (already matched) class. */
function matchMembers(classes: any[], elements: Record<string, any>, claimed: Set<string>) {
  for (const cls of classes) {
    if (!cls.id) continue;
    for (const [list, type] of MEMBER_LISTS) {
      if (!Array.isArray(cls[list])) continue;
      const siblings = Object.values(elements).filter((e: any) => e?.type === type && e.owner === cls.id);
      for (const member of cls[list]) {
        if (!member || typeof member !== 'object') continue;
        const match = findByName(siblings, memberName(member.name), (e) => memberName(e.name), claimed);
        if (match) claim(member, match.id, claimed);
      }
    }
  }
}

/**
 * Links match by kind, endpoints (either direction) and name. When replacing, a link whose name
 * changed keeps its id if it is the only one of its kind between the two classes on both sides.
 */
function matchRelationships(
  specRels: any[],
  classes: any[],
  relationships: Record<string, any>,
  claimed: Set<string>,
  guessRenames: boolean,
) {
  const classIdByName = new Map<string, string>();
  classes.forEach((cls) => cls.id && classIdByName.set(cls.className, cls.id));
  const pairKey = (kind: string, a: string, b: string) => `${kind}|${[a, b].sort().join('|')}`;
  const specKey = (rel: any): string | null => {
    const source = classIdByName.get(rel.sourceClass || rel.source);
    const target = classIdByName.get(rel.targetClass || rel.target);
    return source && target ? pairKey(relationshipKind(rel.type), source, target) : null;
  };
  const existingKey = (rel: any) => pairKey(relationshipKind(rel.type), rel.source.element, rel.target.element);
  const existing = Object.values(relationships).filter(
    (r: any) => r?.source?.element && r?.target?.element && !NOT_ASSOCIATIONS.has(r.type),
  );

  const unmatched: any[] = [];
  for (const rel of specRels) {
    const key = specKey(rel);
    const match = key
      ? existing.find(
          (r: any) =>
            !claimed.has(r.id) && existingKey(r) === key && text(r.name).toLowerCase() === text(rel.name).toLowerCase(),
        )
      : undefined;
    if (match) claim(rel, (match as any).id, claimed);
    else unmatched.push(rel);
  }
  if (!guessRenames) return;

  const free = existing.filter((r: any) => !claimed.has(r.id));
  for (const rel of unmatched) {
    const key = specKey(rel);
    if (!key) continue;
    const specSame = unmatched.filter((r) => specKey(r) === key);
    const existingSame = free.filter((r) => existingKey(r) === key);
    if (specSame.length === 1 && existingSame.length === 1) claim(rel, (existingSame[0] as any).id, claimed);
  }
}

/**
 * Return a copy of ``systemSpec`` whose classes, members and relationships carry the ids of their
 * counterparts in ``currentModel``. No id is handed out twice; unmatched elements get none, so the
 * converter mints fresh ones. ``guessRenames`` is for replacing only: when merging, a renamed link
 * is a new link.
 */
export function reuseExistingClassIds(
  systemSpec: any,
  currentModel: any,
  { guessRenames }: { guessRenames: boolean },
): any {
  const elements: Record<string, any> = currentModel?.elements ?? {};
  if (!systemSpec || !Array.isArray(systemSpec.classes) || Object.keys(elements).length === 0) {
    return systemSpec;
  }

  const spec = JSON.parse(JSON.stringify(systemSpec));
  const classes: any[] = spec.classes.filter((c: any) => c && typeof c === 'object');
  const specRels: any[] = Array.isArray(spec.relationships)
    ? spec.relationships.filter((r: any) => r && typeof r === 'object')
    : [];

  const dropped = dropSpecIds(classes, specRels);
  if (dropped > 0) {
    console.warn(`[reuseExistingClassIds] Ignored ${dropped} id(s) in the rebuild spec; elements are matched by name.`);
  }

  const claimed = new Set<string>();
  matchClasses(classes, elements, claimed);
  matchMembers(classes, elements, claimed);
  matchRelationships(specRels, classes, currentModel?.relationships ?? {}, claimed, guessRenames);
  return spec;
}
