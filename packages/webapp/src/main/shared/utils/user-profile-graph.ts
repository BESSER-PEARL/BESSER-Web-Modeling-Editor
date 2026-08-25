/**
 * Split a `UserDiagram` model into its constituent **user profiles**.
 *
 * A single canvas can hold several profiles. A profile is a `User` element plus
 * every element reachable from it through links — with one rule: **Users are
 * walls**. Traversal never crosses another `User` box, so a box linked to two
 * different Users (e.g. a shared "french" `Culture`) belongs to *both* profiles
 * without being duplicated. Each root's reachability is computed independently,
 * which is exactly what makes shared boxes land in every profile that links to
 * them.
 *
 * The per-profile `model` this returns is a self-contained `UserDiagram`
 * `UMLModel` (its member boxes + their `UserModelAttribute`/`UserModelIcon`
 * children + the links among member boxes). It is the same envelope
 * `buildUserDiagramModel` produces, so downstream aggregation / generation /
 * deploy consume it unchanged — each personalization-mapping entry already
 * ships a whole `user_profile` model, so shipping a per-profile sub-model needs
 * no backend contract change.
 *
 * NOTE: this lives in `shared/` because the form, generation, and deploy all
 * consume it. It must not import from any feature (keeps the layering clean),
 * so it carries its own tiny criterion parser rather than reusing the form's.
 */

import type { UMLModel } from '@besser/wme';
// The fixed user metamodel (a ClassDiagram) is a static asset shipped with the
// editor package. We read it here only to learn each containment's multiplicity
// (single `0..1` vs repeatable `0..*`) so the backend-payload merge knows which
// same-class sibling boxes may be fused into one object and which may not. This
// is a data import, not a feature import, so it keeps `shared/` layering clean.
import userMetaModel from '../../../../../editor/src/main/packages/user-modeling/usermetamodel_buml_short.json';

/** Root class name of the user metamodel — the element that heads a profile. */
const ROOT_CLASS_NAME = 'User';
/** Identity attribute on the root `User` element that names the profile. */
const USER_NAME_ATTRIBUTE = 'name';

export interface ProfileSubModel {
  /** Id of the root `User` box this profile is built from. */
  rootBoxId: string;
  /** Profile name from the root User's `name` attribute; '' when unset. */
  name: string;
  /** Self-contained `UserDiagram` model for just this profile's subgraph. */
  model: UMLModel;
}

/**
 * Return `name` if unused, else the next free `<base><n>` (incrementing a
 * trailing number, or appending `_2`, `_3`, … when there isn't one). Mirrors the
 * editor's create-time uniquifier so an already-saved model with duplicate box
 * names still exports a valid (unique-named) object model to the backend.
 */
const uniqueBoxName = (name: string, taken: Set<string>): string => {
  if (!taken.has(name)) return name;
  const match = name.match(/^(.*?)(\d+)$/);
  const base = match ? match[1] : `${name}_`;
  let n = match ? parseInt(match[2], 10) + 1 : 2;
  let candidate = `${base}${n}`;
  while (taken.has(candidate)) candidate = `${base}${++n}`;
  return candidate;
};

/**
 * Return a copy of a `UserDiagram` model in which every `UserModelName` box has
 * a **diagram-wide-unique** `name`. The backend converts a UserDiagram to a
 * B-UML object model and rejects duplicate object names; palette drops all
 * carry a fixed `<class>_1` name, so a canvas saved before create-time
 * uniquification (or drawn in an older build) can hold clashes like two
 * `user_1` / two `personal_Information_1` boxes.
 *
 * Pure: the input model is never mutated, and any box whose name is unchanged
 * keeps its original object reference. Non-UserDiagram models pass through
 * untouched, so callers can apply this unconditionally before sending.
 */
export const uniquifyUserModelNames = (model: any): any => {
  if (!model || model.type !== 'UserDiagram' || !model.elements) return model;

  const taken = new Set<string>();
  let changed = false;
  const elements: Record<string, any> = {};
  for (const [id, el] of Object.entries(model.elements) as [string, any][]) {
    if (el?.type === 'UserModelName' && typeof el.name === 'string') {
      const resolved = uniqueBoxName(el.name, taken);
      taken.add(resolved);
      if (resolved !== el.name) {
        elements[id] = { ...el, name: resolved };
        changed = true;
        continue;
      }
    }
    elements[id] = el;
  }

  return changed ? { ...model, elements } : model;
};

/* ------------------------------------------------------------------ */
/*  Metamodel-aware singleton merge (backend payload only)             */
/* ------------------------------------------------------------------ */

type Multiplicity = 'single' | 'multiple';

const isContainerMult = (m?: string): boolean => typeof m === 'string' && m.trim().startsWith('1');
const isManyMult = (m?: string): boolean => typeof m === 'string' && m.trim().endsWith('*');

let _containment: Map<string, Map<string, Multiplicity>> | null = null;

/**
 * Build (once) the containment multiplicity map from the bundled user metamodel:
 * `parentClassName -> childClassName -> 'single' | 'multiple'`. The container
 * end is the one whose multiplicity starts with `1`; the child is `multiple`
 * when its multiplicity ends with `*`. If a (parent, child) pair is ever
 * declared repeatable, it stays `multiple` (safety — never fuse a repeatable).
 * Mirrors the rule in the form's `buildMetamodelTree`.
 */
const getContainmentMap = (): Map<string, Map<string, Multiplicity>> => {
  if (_containment) return _containment;
  const map = new Map<string, Map<string, Multiplicity>>();
  const data: any = userMetaModel as any;
  const els: Record<string, any> = data?.elements || {};
  const nameById: Record<string, string> = {};
  for (const [id, el] of Object.entries(els) as [string, any][]) {
    if ((el?.type === 'Class' || el?.type === 'AbstractClass') && typeof el.name === 'string') {
      nameById[id] = el.name;
    }
  }
  const rels: Record<string, any> = data?.relationships || {};
  for (const rel of Object.values(rels) as any[]) {
    if (!rel || rel.type === 'ClassInheritance' || rel.type === 'ClassRealization') continue;
    const sn = nameById[rel.source?.element];
    const tn = nameById[rel.target?.element];
    if (!sn || !tn) continue;
    const sm = rel.source?.multiplicity;
    const tm = rel.target?.multiplicity;
    let parent: string;
    let child: string;
    let childMult: string | undefined;
    if (isContainerMult(sm) && !isContainerMult(tm)) {
      parent = sn; child = tn; childMult = tm;
    } else if (isContainerMult(tm) && !isContainerMult(sm)) {
      parent = tn; child = sn; childMult = sm;
    } else {
      parent = sn; child = tn; childMult = tm;
    }
    if (parent === child) continue;
    const inner = map.get(parent) ?? new Map<string, Multiplicity>();
    const mult: Multiplicity = isManyMult(childMult) ? 'multiple' : 'single';
    inner.set(child, inner.get(child) === 'multiple' ? 'multiple' : mult);
    map.set(parent, inner);
  }
  _containment = map;
  return map;
};

/**
 * Fuse same-class sibling boxes that the metamodel caps at **one per parent**
 * into a single object, for the backend payload only.
 *
 * The attribute-granular palette drops each design attribute (age, nationality,
 * gender) as its **own** `Personal_Information` box carrying a single criterion.
 * That is deliberate on the canvas (each is an editable icon), but the backend
 * turns every box into an object, so one User linked to `age` + `nationality`
 * would yield two `Personal_Information` objects — nonsense against a metamodel
 * that allows only `0..1`. This merges those boxes: within each profile, boxes
 * of the same class sharing a parent are fused (attributes + icon + box-level
 * personalization folded onto the first) **only when that (parentClass,
 * childClass) is a `single` containment**. Repeatable children (`Skill`,
 * `Disability`, `Language` at `0..*`) are left as distinct objects.
 *
 * Pure: the input model is never mutated; returns the same reference when there
 * is nothing to merge. Intended for per-profile sub-models (one `User`), but
 * safe on any `UserDiagram` (walls at other `User` boxes, like the profile split).
 */
export const mergeSingletonBoxes = (model: any): any => {
  if (!model || model.type !== 'UserDiagram' || !model.elements) return model;

  const containment = getContainmentMap();
  const elements: Record<string, any> = model.elements;
  const relationships: Record<string, any> = model.relationships || {};

  const boxById: Record<string, any> = {};
  Object.values(elements).forEach((el: any) => {
    if (el?.type === 'UserModelName') boxById[el.id] = el;
  });

  const isUser = (b: any): boolean => b?.className === ROOT_CLASS_NAME;

  // Undirected box adjacency.
  const adjacency: Record<string, Set<string>> = {};
  Object.values(relationships).forEach((rel: any) => {
    const s = rel?.source?.element;
    const t = rel?.target?.element;
    if (typeof s === 'string' && typeof t === 'string' && boxById[s] && boxById[t]) {
      (adjacency[s] ||= new Set()).add(t);
      (adjacency[t] ||= new Set()).add(s);
    }
  });

  // Assign a parent to every non-User box via BFS from each User (walls = other
  // Users), so we can group a box's children by class under it.
  const parentOf: Record<string, string> = {};
  Object.values(boxById)
    .filter(isUser)
    .forEach((root: any) => {
      const queue: string[] = [root.id];
      const seen = new Set<string>([root.id]);
      while (queue.length) {
        const cur = queue.shift()!;
        (adjacency[cur] ? Array.from(adjacency[cur]) : []).forEach((nb) => {
          if (seen.has(nb)) return;
          const nbBox = boxById[nb];
          if (!nbBox || isUser(nbBox)) return; // wall
          seen.add(nb);
          if (parentOf[nb] === undefined) parentOf[nb] = cur;
          queue.push(nb);
        });
      }
    });

  // Group children by (parent, className); a group of ≥2 of a `single` child
  // class is fused into its first box.
  const childrenByParent: Record<string, Record<string, string[]>> = {};
  Object.entries(parentOf).forEach(([boxId, pid]) => {
    const cn = boxById[boxId]?.className;
    if (!cn) return;
    (childrenByParent[pid] ||= {});
    (childrenByParent[pid][cn] ||= []).push(boxId);
  });

  const mergeInto: Record<string, string> = {}; // merged box id -> surviving target id
  Object.entries(childrenByParent).forEach(([pid, byClass]) => {
    const parentClass = boxById[pid]?.className;
    const inner = parentClass ? containment.get(parentClass) : undefined;
    Object.entries(byClass).forEach(([cn, ids]) => {
      if (ids.length < 2) return;
      if (inner?.get(cn) !== 'single') return; // only fuse capped-at-one children
      const [target, ...rest] = ids;
      rest.forEach((r) => (mergeInto[r] = target));
    });
  });

  if (Object.keys(mergeInto).length === 0) return model;

  const hasSpec = (spec: any): boolean => !!spec && typeof spec === 'object' && Object.keys(spec).length > 0;

  // Clone elements, dropping merged boxes; clone each target box so we can grow
  // its attribute list without mutating the input.
  const newElements: Record<string, any> = {};
  Object.entries(elements).forEach(([id, el]: [string, any]) => {
    if (el?.type === 'UserModelName' && mergeInto[id]) return; // merged away
    newElements[id] = el;
  });
  Object.values(mergeInto).forEach((tid) => {
    if (newElements[tid]) {
      newElements[tid] = {
        ...newElements[tid],
        attributes: Array.isArray(newElements[tid].attributes) ? [...newElements[tid].attributes] : [],
      };
    }
  });

  // Fold each merged box's attributes / icon / box-personalization onto its target.
  Object.entries(mergeInto).forEach(([mid, target]) => {
    const mBox = boxById[mid];
    const tBox = newElements[target];
    if (!tBox) return;
    (Array.isArray(mBox.attributes) ? mBox.attributes : []).forEach((aid: string) => {
      if (elements[aid]) {
        newElements[aid] = { ...elements[aid], owner: target };
        tBox.attributes.push(aid);
      }
    });
    if (!tBox.icon && mBox.icon && elements[mBox.icon]) {
      newElements[mBox.icon] = { ...elements[mBox.icon], owner: target };
      tBox.icon = mBox.icon;
    }
    if (!hasSpec(tBox.personalization) && hasSpec(mBox.personalization)) {
      tBox.personalization = mBox.personalization;
    }
  });

  // Rewire relationships: redirect endpoints off merged boxes onto their target,
  // then drop self-links and duplicate box↔box links the merge produced.
  const newRelationships: Record<string, any> = {};
  const seenPairs = new Set<string>();
  Object.entries(relationships).forEach(([rid, rel]: [string, any]) => {
    const s0 = rel?.source?.element;
    const t0 = rel?.target?.element;
    if (typeof s0 !== 'string' || typeof t0 !== 'string') {
      newRelationships[rid] = rel;
      return;
    }
    const s = mergeInto[s0] ?? s0;
    const t = mergeInto[t0] ?? t0;
    if (s === t) return; // collapsed to a self-link
    if (boxById[s] && boxById[t]) {
      const key = s < t ? `${s}|${t}` : `${t}|${s}`;
      if (seenPairs.has(key)) return; // duplicate parent↔target link
      seenPairs.add(key);
    }
    newRelationships[rid] =
      s === s0 && t === t0
        ? rel
        : { ...rel, source: { ...rel.source, element: s }, target: { ...rel.target, element: t } };
  });

  return { ...model, elements: newElements, relationships: newRelationships };
};

/**
 * Transform a whole-canvas `UserDiagram` into the shape the backend accepts:
 * every object owned by exactly one `User` and every `single` containment
 * collapsed to one object.
 *
 * The backend converts a UserDiagram into a B-UML object model whose metamodel
 * (a) rejects duplicate object names and (b) caps each object at one owning
 * `User`. A raw canvas can violate both — a box shared by two Users, and the
 * attribute-granular chips that split one class across several boxes. This:
 *   1. splits the canvas into profiles ("Users are walls" reachability);
 *   2. merges each profile's `single`-cardinality siblings ({@link mergeSingletonBoxes});
 *   3. re-ids every profile's elements/relationships behind a `p{i}_` prefix, so
 *      a shared box becomes a **private copy per User** (one owner each);
 *   4. carries through any element/relationship reachable from no `User`;
 *   5. runs {@link uniquifyUserModelNames} so all object names are distinct.
 *
 * Non-UserDiagram models pass through untouched; a UserDiagram with no `User`
 * box falls back to name-uniquification only. Pure — never mutates the input.
 */
export const flattenUserDiagramForBackend = (model: any): any => {
  if (!model || model.type !== 'UserDiagram' || !model.elements) return model;

  const profiles = splitUserDiagramIntoProfiles(model);
  if (profiles.length === 0) return uniquifyUserModelNames(model);

  const mergedElements: Record<string, any> = {};
  const mergedRelationships: Record<string, any> = {};

  profiles.forEach((profile, i) => {
    const merged = mergeSingletonBoxes(profile.model);
    const subElements = (merged.elements || {}) as Record<string, any>;
    const subRelationships = (merged.relationships || {}) as Record<string, any>;
    const prefix = `p${i}_`;
    const remap = (id: string): string => `${prefix}${id}`;

    Object.entries(subElements).forEach(([id, el]) => {
      const clone: any = { ...el, id: remap(id) };
      if (el.owner) clone.owner = remap(el.owner);
      if (Array.isArray(el.attributes)) clone.attributes = el.attributes.map(remap);
      // `icon` is an id reference only when it points at a real element (chips
      // carry an inline SVG string instead — leave those untouched).
      if (typeof el.icon === 'string' && subElements[el.icon]) clone.icon = remap(el.icon);
      mergedElements[remap(id)] = clone;
    });
    Object.entries(subRelationships).forEach(([rid, rel]) => {
      const clone: any = { ...rel, id: remap(rid) };
      if (rel.source?.element) clone.source = { ...rel.source, element: remap(rel.source.element) };
      if (rel.target?.element) clone.target = { ...rel.target, element: remap(rel.target.element) };
      mergedRelationships[remap(rid)] = clone;
    });
  });

  // Elements reachable from no User (and relationships between two such orphans)
  // keep their original ids so nothing on the canvas is silently dropped.
  const claimed = new Set<string>();
  profiles.forEach((p) => Object.keys((p.model as any).elements || {}).forEach((id) => claimed.add(id)));
  Object.entries(model.elements as Record<string, any>).forEach(([id, el]) => {
    if (!claimed.has(id)) mergedElements[id] = el;
  });
  Object.entries((model.relationships || {}) as Record<string, any>).forEach(([rid, rel]) => {
    const s = rel?.source?.element;
    const t = rel?.target?.element;
    if (!claimed.has(s) && !claimed.has(t)) mergedRelationships[rid] = rel;
  });

  return uniquifyUserModelNames({ ...model, elements: mergedElements, relationships: mergedRelationships });
};

/** Read the value of a named criterion (`name = Alice`) from a raw criterion string. */
const criterionValue = (raw: string, attributeName: string): string | null => {
  const match = String(raw).match(/^(.*?)(?:<=|>=|==|=|<|>)(.*)$/);
  const name = (match ? match[1] : raw).trim();
  if (name !== attributeName) return null;
  return (match ? match[2] : '').trim();
};

/**
 * Read the profile name carried by a `User` box's own sibling `name`
 * `UserModelAttribute`. Returns '' when the attribute is unset/absent — the
 * live source of truth for the profile name (canvas/form edits update this row).
 */
export const readUserBoxName = (box: any, elements: Record<string, any>): string => {
  const attrIds: string[] = Array.isArray(box?.attributes) ? box.attributes : [];
  for (const id of attrIds) {
    const el = elements[id];
    if (el?.type !== 'UserModelAttribute') continue;
    const value = criterionValue(el.name ?? '', USER_NAME_ATTRIBUTE);
    if (value !== null) return value;
  }
  return '';
};

/**
 * Split a `UserDiagram` model into one `ProfileSubModel` per `User` box, using
 * "Users are walls" reachability (see file header). Returns [] when there is no
 * `User` box.
 */
export const splitUserDiagramIntoProfiles = (
  model: UMLModel | null | undefined,
): ProfileSubModel[] => {
  const elements = (model?.elements || {}) as Record<string, any>;
  const relationships = (model?.relationships || {}) as Record<string, any>;

  const boxes = Object.values(elements).filter((el: any) => el?.type === 'UserModelName');
  const boxById: Record<string, any> = {};
  boxes.forEach((box: any) => {
    boxById[box.id] = box;
  });

  const isUserBox = (box: any): boolean => box?.className === ROOT_CLASS_NAME;

  // Undirected adjacency between boxes (attributes hang off `box.attributes`,
  // not relationships, so only box↔box links matter here).
  const adjacency: Record<string, Set<string>> = {};
  const addEdge = (a: string, b: string) => {
    if (!boxById[a] || !boxById[b]) return;
    (adjacency[a] ||= new Set()).add(b);
    (adjacency[b] ||= new Set()).add(a);
  };
  Object.values(relationships).forEach((rel: any) => {
    const s = rel?.source?.element;
    const t = rel?.target?.element;
    if (typeof s === 'string' && typeof t === 'string') addEdge(s, t);
  });

  const buildSubModel = (rootBox: any): ProfileSubModel => {
    // BFS from the root. Include the root; for each neighbour, skip-and-don't-
    // expand any *other* User box (a wall); include + expand every non-User box.
    const memberBoxIds = new Set<string>([rootBox.id]);
    const queue: string[] = [rootBox.id];
    while (queue.length) {
      const current = queue.shift()!;
      const neighbours = adjacency[current] ? Array.from(adjacency[current]) : [];
      for (const nb of neighbours) {
        if (memberBoxIds.has(nb)) continue;
        const nbBox = boxById[nb];
        if (!nbBox || isUserBox(nbBox)) continue; // wall: another User
        memberBoxIds.add(nb);
        queue.push(nb);
      }
    }

    // Assemble a self-contained model: member boxes + their attribute/icon
    // children, plus the links whose both endpoints are members.
    // Box display names must be unique within the emitted object model (the
    // backend rejects duplicate object names). Newly-drawn boxes already get a
    // unique name at create time, but a model saved before that fix can still
    // hold collisions — de-dup here on the way out, cloning any box we rename so
    // the shared canvas model is never mutated.
    const takenNames = new Set<string>();
    const subElements: Record<string, any> = {};
    memberBoxIds.forEach((boxId) => {
      const box = boxById[boxId];
      if (!box) return;
      const resolved = typeof box.name === 'string' ? uniqueBoxName(box.name, takenNames) : box.name;
      if (typeof resolved === 'string') takenNames.add(resolved);
      subElements[boxId] = resolved !== box.name ? { ...box, name: resolved } : box;
      const attrIds: string[] = Array.isArray(box.attributes) ? box.attributes : [];
      attrIds.forEach((aid) => {
        if (elements[aid]) subElements[aid] = elements[aid];
      });
      if (box.icon && elements[box.icon]) subElements[box.icon] = elements[box.icon];
    });

    const subRelationships: Record<string, any> = {};
    Object.entries(relationships).forEach(([rid, rel]: [string, any]) => {
      const s = rel?.source?.element;
      const t = rel?.target?.element;
      if (memberBoxIds.has(s) && memberBoxIds.has(t)) subRelationships[rid] = rel;
    });

    const subModel = {
      version: (model as any)?.version ?? '3.0.0',
      type: 'UserDiagram',
      size: (model as any)?.size ?? { width: 1400, height: 740 },
      elements: subElements,
      relationships: subRelationships,
      interactive: { elements: {}, relationships: {} },
      assessments: {},
    } as unknown as UMLModel;

    return {
      rootBoxId: rootBox.id,
      name: readUserBoxName(rootBox, elements),
      model: subModel,
    };
  };

  return boxes.filter(isUserBox).map(buildSubModel);
};

/**
 * Give every entry a unique, non-empty `name`. Empty names fall back to
 * `user_<n>`; duplicates get a ` (2)`, ` (3)`, … suffix. Used by the mapping
 * builders so each personalization entry is addressable by a distinct name.
 */
export const uniquifyNames = <T extends { name: string }>(entries: T[]): T[] => {
  const used = new Set<string>();
  return entries.map((entry, index) => {
    const base = (entry.name || '').trim() || `user_${index + 1}`;
    let candidate = base;
    let n = 2;
    while (used.has(candidate)) candidate = `${base} (${n++})`;
    used.add(candidate);
    return { ...entry, name: candidate };
  });
};
