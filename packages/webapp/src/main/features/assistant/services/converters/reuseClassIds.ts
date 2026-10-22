/**
 * Copy element ids from the current class diagram onto a rebuilt system spec,
 * so GUI and object diagrams that reference those ids keep working after a
 * whole-diagram rebuild. ClassDiagramConverter then uses the spec ids.
 *
 * Name matches win over ids already in the spec. A spec id is kept only when
 * nothing matched by name, the id is free, and the current model has no
 * element of another kind under it. No id is handed out twice.
 */

const CLASSIFIER_TYPES = new Set(['Class', 'AbstractClass', 'Interface', 'Enumeration']);
const NOT_ASSOCIATIONS = new Set(['ClassOCLLink', 'ClassLinkRel']);
const OWN_KIND_RELATIONSHIPS = new Set(['ClassInheritance', 'ClassRealization', 'ClassDependency']);

const norm = (value: unknown): string => (typeof value === 'string' ? value.trim().toLowerCase() : '');

/** "+ title: str" -> "title", "read(x: int): str" -> "read". */
const memberName = (value: unknown): string =>
  typeof value === 'string' ? norm(value.replace(/^\s*[+\-#~]\s*/, '').split(/[:(]/)[0]) : '';

/** Inheritance-like links keep their own kind; associations of any flavour share one. */
const relationshipKind = (type: unknown): string => {
  const t = typeof type === 'string' ? type.trim() : '';
  const full = /^class/i.test(t) ? t : `Class${t.charAt(0).toUpperCase()}${t.slice(1).toLowerCase()}`;
  if (full === 'ClassGeneralization') return 'ClassInheritance';
  return OWN_KIND_RELATIONSHIPS.has(full) ? full : 'association';
};

export function reuseExistingClassIds(systemSpec: any, currentModel: any): any {
  const elements: Record<string, any> = currentModel?.elements ?? {};
  const relationships: Record<string, any> = currentModel?.relationships ?? {};
  if (!systemSpec || !Array.isArray(systemSpec.classes) || Object.keys(elements).length === 0) {
    return systemSpec;
  }

  const spec = JSON.parse(JSON.stringify(systemSpec));
  const claimed = new Set<string>();
  const take = (item: any, id: string | undefined): boolean => {
    if (!id || claimed.has(id)) return false;
    item.id = id;
    claimed.add(id);
    return true;
  };
  // Second pass for items no name matched: keep a usable spec id, else drop it.
  const keepOwnId = (item: any, ownId: unknown, isSameKind: (id: string) => boolean) => {
    delete item.id;
    if (typeof ownId !== 'string' || !ownId) return;
    const knownElsewhere = (ownId in elements || ownId in relationships) && !isSameKind(ownId);
    if (!knownElsewhere) take(item, ownId);
  };

  const classes: any[] = spec.classes.filter((c: any) => c && typeof c === 'object');
  const isClassifier = (id: string) => CLASSIFIER_TYPES.has(elements[id]?.type);
  const existingClasses = Object.values(elements).filter((e: any) => CLASSIFIER_TYPES.has(e?.type));

  const unmatchedClasses = new Map<any, unknown>();
  for (const cls of classes) {
    const ownId = cls.id;
    const match = existingClasses.find((e: any) => norm(e.name) === norm(cls.className));
    if (!take(cls, match?.id)) unmatchedClasses.set(cls, ownId);
  }
  unmatchedClasses.forEach((ownId, cls) => keepOwnId(cls, ownId, isClassifier));

  const memberLists: Array<[string, 'ClassAttribute' | 'ClassMethod']> = [
    ['attributes', 'ClassAttribute'],
    ['methods', 'ClassMethod'],
  ];
  const unmatchedMembers = new Map<any, [unknown, string]>();
  for (const cls of classes) {
    for (const [list, type] of memberLists) {
      if (!Array.isArray(cls[list])) continue;
      const siblings = Object.values(elements).filter(
        (e: any) => e?.type === type && cls.id !== undefined && e.owner === cls.id,
      );
      for (const member of cls[list]) {
        if (!member || typeof member !== 'object') continue;
        const ownId = member.id;
        const match = siblings.find((e: any) => memberName(e.name) === memberName(member.name));
        if (!take(member, match?.id)) unmatchedMembers.set(member, [ownId, type]);
      }
    }
  }
  unmatchedMembers.forEach(([ownId, type], member) =>
    keepOwnId(member, ownId, (id) => elements[id]?.type === type),
  );

  const classIdByName = new Map<string, string>();
  classes.forEach((cls) => cls.id && classIdByName.set(cls.className, cls.id));
  const existingRels = Object.values(relationships).filter(
    (r: any) => r?.source?.element && r?.target?.element && !NOT_ASSOCIATIONS.has(r.type),
  );
  const pairKey = (kind: string, a: string, b: string) => `${kind}|${[a, b].sort().join('|')}`;
  const specRels: any[] = Array.isArray(spec.relationships)
    ? spec.relationships.filter((r: any) => r && typeof r === 'object')
    : [];
  const ends = (rel: any): [string, string] | null => {
    const s = classIdByName.get(rel.sourceClass ?? rel.source);
    const t = classIdByName.get(rel.targetClass ?? rel.target);
    return s && t ? [s, t] : null;
  };

  const unmatchedRels = new Map<any, unknown>();
  for (const rel of specRels) {
    const ownId = rel.id;
    const e = ends(rel);
    const kind = relationshipKind(rel.type);
    const match = e
      ? existingRels.find(
          (r: any) =>
            !claimed.has(r.id) &&
            relationshipKind(r.type) === kind &&
            pairKey(kind, r.source.element, r.target.element) === pairKey(kind, e[0], e[1]) &&
            norm(r.name) === norm(rel.name),
        )
      : undefined;
    if (!take(rel, (match as any)?.id)) unmatchedRels.set(rel, ownId);
  }
  // A renamed or newly named link: reuse the id when the pair has exactly one on each side.
  const countBy = (items: any[], key: (item: any) => string | null) => {
    const counts = new Map<string, number>();
    items.forEach((item) => {
      const k = key(item);
      if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
    });
    return counts;
  };
  const specKey = (rel: any) => {
    const e = ends(rel);
    return e ? pairKey(relationshipKind(rel.type), e[0], e[1]) : null;
  };
  const existingKey = (r: any) => pairKey(relationshipKind(r.type), r.source.element, r.target.element);
  const unclaimedRels = existingRels.filter((r: any) => !claimed.has(r.id));
  const specCounts = countBy([...unmatchedRels.keys()], specKey);
  const existingCounts = countBy(unclaimedRels, existingKey);
  unmatchedRels.forEach((ownId, rel) => {
    const k = specKey(rel);
    if (k && specCounts.get(k) === 1 && existingCounts.get(k) === 1) {
      const match = unclaimedRels.find((r: any) => existingKey(r) === k);
      if (take(rel, (match as any)?.id)) return;
    }
    keepOwnId(rel, ownId, (id) => id in relationships);
  });

  return spec;
}
