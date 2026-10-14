/**
 * Generate a deterministic Object Diagram from a Class Diagram (v4-native).
 *
 * Walks v4 `model.nodes[]` / `model.edges[]` directly. No v3↔v4
 * conversion seam.
 *
 * For every concrete `class` node in the source class diagram (skipping
 * abstract / interface / enumeration variants identified by
 * `data.stereotype`), the helper produces one `objectName` node on the
 * object diagram, with one row per source `data.attributes` entry on the
 * generated `data.attributes`. Slot values come from the source
 * attribute's `defaultValue` when set, otherwise from {@link sampleByName}
 * based on the attribute's name and type.
 *
 * For every class-level association edge (`ClassBidirectional`, legacy
 * `ClassUnidirectional`, `ClassAggregation`, `ClassComposition`) the
 * helper creates a single `ObjectLink` edge between the generated objects
 * on each side. Inheritance, realization, and dependency edges are
 * skipped — those are static-structure relationships that don't have a
 * meaningful runtime instance.
 *
 * The helper is **additive**: existing objects whose `data.classId` is
 * already on the canvas are skipped (they're still valid link endpoints
 * if a relevant association needs them), so re-running after manual edits
 * doesn't wipe the user's work. Inheritance is honoured — child classes
 * inherit ancestor `data.attributes` rows (deduplicated by name).
 */
import { NAVIGABLE_ASSOCIATION_TYPES, UMLDiagramType, UMLModel } from '@besser/wme';

interface ScaffoldOptions {
  /** Source class-diagram model (v4 UMLModel). */
  classModel: UMLModel;
  /** Current object-diagram model (v4 UMLModel) — used to skip already
   *  instantiated classes and to compute the next free X position. */
  objectModel: UMLModel;
}

const ID_PREFIX = 'gen';
let idCounter = 0;
const newId = (kind: string): string => {
  idCounter += 1;
  // Random suffix scoped to this run keeps IDs unique even if the helper
  // runs many times in the same session (counter alone would collide on
  // page reload).
  return `${ID_PREFIX}_${kind}_${Date.now().toString(36)}_${idCounter}_${Math.random().toString(36).slice(2, 7)}`;
};

/** Built-in primitive types. Anything else in `attributeType` is treated
 *  as a custom type — looked up in the class model (Enumeration → first
 *  literal) and otherwise passed through as a literal type-name placeholder.
 */
const PRIMITIVE_TYPES = new Set([
  'int', 'integer', 'long',
  'float', 'double', 'decimal',
  'bool', 'boolean',
  'str', 'string', 'text',
  'date', 'datetime', 'time',
  'any',
]);

/** Type-only fallback when no name-based heuristic matches. Strings are
 *  returned unquoted: the editor displays the value as-is and the
 *  validator's date type-check rejects a quoted date string.
 */
const fallbackForType = (attributeType?: string): string => {
  switch ((attributeType ?? '').toLowerCase()) {
    case 'int':
    case 'integer':
    case 'long':
      return '1';
    case 'float':
    case 'double':
    case 'decimal':
      return '1.0';
    case 'bool':
    case 'boolean':
      return 'true';
    case 'str':
    case 'string':
    case 'text':
      return 'sample';
    case 'date':
      return '2026-01-01';
    case 'datetime':
      return '2026-01-01T00:00:00';
    case 'time':
      return '00:00:00';
    default:
      return '';
  }
};

/** Resolve an enumeration's first literal by name (v4). Enumerations are
 *  v4 nodes with `type: 'class'` and `data.stereotype === 'Enumeration'`
 *  (PascalCase, per `ClassType.Enumeration`); literals live in
 *  `data.attributes` as ClassifierMember rows.
 */
const firstEnumLiteral = (
  enumName: string | undefined,
  classModel: UMLModel,
): string | undefined => {
  if (!enumName) return undefined;
  const enumNode = (classModel.nodes ?? []).find((n: any) => {
    const data = (n.data as any) || {};
    // Stereotype is PascalCase per the canonical enum
    // (`ClassType.Enumeration === 'Enumeration'`); older data may be
    // lowercase, so compare case-insensitively.
    const isEnumNode =
      n.type === 'class' && String(data.stereotype ?? '').toLowerCase() === 'enumeration';
    // Tolerate v3-shaped leaks where `n.type === 'Enumeration'`.
    const isLegacyEnum = n.type === 'Enumeration';
    return (isEnumNode || isLegacyEnum) && data.name === enumName;
  });
  if (!enumNode) return undefined;
  const data = (enumNode.data as any) || {};
  const literals: any[] = Array.isArray(data.attributes) ? data.attributes : [];
  for (const lit of literals) {
    if (lit && typeof lit.name === 'string' && lit.name.length > 0) return lit.name;
  }
  return undefined;
};

/** Does `value` parse as the attribute's primitive type? Unknown / custom
 *  types accept anything. */
const fitsType = (value: string, attributeType: string | undefined): boolean => {
  switch ((attributeType ?? '').toLowerCase()) {
    case 'int':
    case 'integer':
    case 'long':
      return /^-?\d+$/.test(value);
    case 'float':
    case 'double':
    case 'decimal':
      return /^-?\d+(\.\d+)?$/.test(value);
    case 'bool':
    case 'boolean':
      return value === 'true' || value === 'false';
    case 'date':
      return /^\d{4}-\d{2}-\d{2}$/.test(value);
    case 'datetime':
      return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value);
    case 'time':
      return /^\d{2}:\d{2}:\d{2}$/.test(value);
    default:
      return true;
  }
};

/** Name-aware sample-value generator. Looks at the attribute name's whole
 *  words (`homeCity`, `home_city` -> home, city), so the user gets
 *  `email = alice@example.com` instead of `email = sample`, while
 *  `capacity` never matches "city". A sample that does not fit the
 *  attribute's type falls back to {@link fallbackForType}.
 */
const sampleByName = (
  rawName: string | undefined,
  attributeType: string | undefined,
  classModel: UMLModel,
): string => {
  // Custom type — most commonly an Enumeration. Use the first literal as
  // a sensible default. If the type isn't a known enum we fall through to
  // the type-only fallback (which returns '' for unknown types so the
  // user is prompted to fill it in).
  const type = (attributeType ?? '').toLowerCase();
  if (attributeType && !PRIMITIVE_TYPES.has(type)) {
    const literal = firstEnumLiteral(attributeType, classModel);
    if (literal) return literal;
  }
  const value = sampleForWords(rawName ?? '', type);
  return value !== undefined && fitsType(value, attributeType) ? value : fallbackForType(attributeType);
};

const sampleForWords = (rawName: string, type: string): string | undefined => {
  const words = rawName
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const compact = words.join('');
  const last = words[words.length - 1] ?? '';
  const has = (...keys: string[]) => keys.some((k) => words.includes(k));
  const hasCompound = (...keys: string[]) => keys.some((k) => compact.includes(k));
  const isNumeric = ['int', 'integer', 'long', 'float', 'double', 'decimal'].includes(type);
  const isBool = ['bool', 'boolean'].includes(type);

  // Booleans first — names like `isActive` should win over a generic match
  if (isBool || ['is', 'has', 'can', 'should'].includes(words[0] ?? '')) {
    if (has('active', 'enabled', 'valid', 'available', 'published', 'visible', 'allowed', 'verified')) return 'true';
    if (has('deleted', 'disabled', 'hidden', 'blocked', 'locked', 'expired', 'archived')) return 'false';
    if (isBool) return 'true';
  }

  // Identifiers
  if (last === 'id') return isNumeric ? '1' : 'id-1';
  if (has('uuid', 'guid')) return '00000000-0000-0000-0000-000000000001';

  // People / addresses
  if (hasCompound('firstname', 'givenname')) return 'Alice';
  if (hasCompound('lastname', 'surname', 'familyname')) return 'Smith';
  if (hasCompound('fullname', 'displayname')) return 'Alice Smith';
  if (hasCompound('username')) return 'alice';
  if (last === 'name') return 'Sample';
  if (has('email', 'mail')) return 'alice@example.com';
  if (has('phone', 'mobile', 'tel', 'telephone')) return '+1-555-0100';
  if (has('address', 'street')) return '123 Main St';
  if (has('city', 'town')) return 'Springfield';
  if (has('country', 'nation', 'nationality')) return 'France';
  if (has('zip', 'postal', 'postcode', 'zipcode')) return '10001';

  // Dimensions / counts / numerics
  if (has('age') && isNumeric) return '25';
  if (has('year') && isNumeric) return '2026';
  if (has('month') && isNumeric) return '1';
  if (has('day') && isNumeric) return '1';
  if (has('price', 'cost', 'amount', 'total', 'salary', 'fee', 'balance')) return type === 'int' ? '10' : '9.99';
  if (has('rating', 'score', 'rank')) return type === 'int' ? '5' : '4.5';
  if (has('count', 'quantity', 'qty', 'stock', 'number', 'capacity') && isNumeric) return '10';
  if (has('page', 'pages') && isNumeric) return '200';
  if (has('weight') && isNumeric) return type === 'int' ? '70' : '70.5';
  if (has('height', 'width', 'length', 'size', 'depth')) return type === 'int' ? '100' : '10.0';

  // Dates / times
  if (type === 'datetime' || last === 'at' || has('timestamp')) return '2026-01-01T00:00:00';
  if (type === 'date' || has('birthdate', 'birthday', 'birth', 'date', 'created', 'updated', 'release', 'published', 'start', 'end')) {
    return '2026-01-01';
  }
  if (type === 'time') return '00:00:00';

  // Web / media
  if (has('url', 'website', 'webpage', 'link', 'href') || hasCompound('webpage')) return 'https://example.com';
  if (has('image', 'photo', 'picture', 'avatar', 'icon')) return 'https://example.com/image.png';

  // Auth-ish
  if (has('login', 'handle')) return 'alice';
  if (has('password')) return 'password';
  if (has('token', 'secret', 'apikey') || hasCompound('apikey')) return 'changeme';

  // Free text
  if (has('title', 'subject', 'label')) return 'Sample Title';
  if (has('description', 'summary', 'comment', 'note', 'body', 'content')) return 'Sample description';
  if (has('status', 'state')) return 'active';
  if (has('language', 'lang', 'locale')) return 'en';
  if (has('currency')) return 'USD';
  if (has('color', 'colour')) return '#000000';

  return undefined;
};

const OBJECT_NAME_WIDTH = 240;
const OBJECT_NAME_HEADER_HEIGHT = 40;
const ATTRIBUTE_HEIGHT = 25;
const HORIZONTAL_GAP = 50;

/**
 * Class-level relationship types the helper turns into `ObjectLink`s.
 * Inheritance / realization / dependency are intentionally excluded —
 * those describe static structure, not object-level relations. Navigability
 * is irrelevant here: an object link exists regardless of which ends are
 * navigable.
 */
const ASSOCIATION_TYPES = new Set<string>(NAVIGABLE_ASSOCIATION_TYPES);

export interface ScaffoldResult {
  model: UMLModel;
  created: number;
  skipped: number;
  links: number;
}

/** Pull a value to seed an object slot. Source-attribute `defaultValue`
 *  takes precedence so a deliberate model-level default is never lost;
 *  otherwise we ask {@link sampleByName} for a realistic stand-in based
 *  on the attribute's name and type, including enum-literal lookup for
 *  non-primitive types via `classModel`.
 */
const seedValue = (attr: any, classModel: UMLModel): string => {
  const explicit = attr?.defaultValue;
  if (explicit !== undefined && explicit !== null && String(explicit).length > 0) {
    return String(explicit);
  }
  return sampleByName(attr?.name, attr?.attributeType, classModel);
};

/**
 * v4 helper: is this a "concrete" Class node (not abstract/interface/enum)?
 *
 * The migrator collapses all v3 classifier subtypes into `node.type ===
 * 'class'` discriminated by `data.stereotype`. We also tolerate a v3-leak
 * where the modifier accidentally writes `node.type === 'Class'` for
 * back-compat — see ClassDiagramModifier.addClass which mirrors the
 * stereotype to the legacy type label.
 */
const isConcreteClassNode = (n: any): boolean => {
  if (!n || typeof n !== 'object') return false;
  const data = (n.data as any) || {};
  const isV4Class = n.type === 'class';
  const isLegacyClass = n.type === 'Class';
  if (!(isV4Class || isLegacyClass)) return false;
  const stereotype = (data.stereotype || '').toString().toLowerCase();
  if (stereotype === 'abstract' || stereotype === 'interface' || stereotype === 'enumeration') return false;
  return true;
};

/**
 * Walk the inheritance graph from `classNodeId` upward and collect all
 * ancestor `data.attributes` rows (deepest-first wins; child rows
 * override parent rows of the same name).
 *
 * Inheritance edges in v4 are `ClassInheritance` with `source = child`
 * and `target = parent`.
 */
const collectInheritedAttributes = (
  classNode: any,
  classModel: UMLModel,
): any[] => {
  const visited = new Set<string>();
  const ordered: any[] = [];
  const stack: string[] = [classNode.id];
  const nodesById = new Map<string, any>();
  for (const n of (classModel.nodes ?? []) as any[]) nodesById.set(n.id, n);

  // Walk parents first → push their attribute rows; then this class's
  // rows shadow them.
  const parents: any[] = [];
  const queue: string[] = [classNode.id];
  while (queue.length) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const e of (classModel.edges ?? []) as any[]) {
      if (e.type === 'ClassInheritance' && e.source === id) {
        const parent = nodesById.get(e.target);
        if (parent) {
          parents.push(parent);
          queue.push(parent.id);
        }
      }
    }
    // Suppress unused warning
    void stack;
  }

  // Deepest ancestor first so child rows dedupe on top.
  for (let i = parents.length - 1; i >= 0; i--) {
    const data = (parents[i].data as any) || {};
    const rows: any[] = Array.isArray(data.attributes) ? data.attributes : [];
    for (const r of rows) ordered.push(r);
  }
  const ownData = (classNode.data as any) || {};
  const ownRows: any[] = Array.isArray(ownData.attributes) ? ownData.attributes : [];
  for (const r of ownRows) ordered.push(r);

  // Dedupe by attribute name (last-write-wins so child overrides parent).
  const byName = new Map<string, any>();
  for (const row of ordered) {
    const key = (row?.name || '').toString().toLowerCase();
    if (!key) continue;
    byName.set(key, row);
  }
  return Array.from(byName.values());
};

export const scaffoldObjectsFromClasses = ({
  classModel,
  objectModel,
}: ScaffoldOptions): ScaffoldResult => {
  // Defensive copies so we never mutate the live editor model.
  const inputNodes: any[] = Array.isArray((objectModel as any).nodes) ? (objectModel as any).nodes : [];
  const inputEdges: any[] = Array.isArray((objectModel as any).edges) ? (objectModel as any).edges : [];
  const outNodes: any[] = inputNodes.map((n) => ({ ...n, data: { ...(n.data ?? {}) } }));
  const outEdges: any[] = inputEdges.map((e) => ({ ...e, data: { ...(e.data ?? {}) } }));

  // Source class ID → object node ID, so links can target them. Pre-populated
  // from existing canvas objects so links connect to user-created instances
  // too, not just freshly generated ones.
  const objectByClassId = new Map<string, string>();
  for (const n of outNodes) {
    if (n.type !== 'objectName') continue;
    const data = (n.data as any) || {};
    if (typeof data.classId === 'string' && data.classId) {
      objectByClassId.set(data.classId, n.id);
    }
  }

  // `<class>_<n>` names, as the palette seeds them, with the next free n.
  const takenNames = new Set(
    outNodes.map((n) => (n.data as any)?.name).filter((name): name is string => typeof name === 'string'),
  );
  const nextFreeName = (className: string): string => {
    const prefix = `${className.charAt(0).toLowerCase()}${className.slice(1)}_`;
    let n = 1;
    while (takenNames.has(`${prefix}${n}`)) n += 1;
    takenNames.add(`${prefix}${n}`);
    return `${prefix}${n}`;
  };

  // Compute the next free X by looking at where existing objects end.
  let nextX = 0;
  for (const n of outNodes) {
    if (n.type !== 'objectName') continue;
    const right = (n.position?.x ?? 0) + (n.width ?? OBJECT_NAME_WIDTH);
    if (right + HORIZONTAL_GAP > nextX) nextX = right + HORIZONTAL_GAP;
  }

  let created = 0;
  let skipped = 0;

  for (const sourceClass of (classModel.nodes ?? []) as any[]) {
    if (!isConcreteClassNode(sourceClass)) continue;
    if (objectByClassId.has(sourceClass.id)) {
      skipped += 1;
      continue;
    }

    const sourceAttributes = collectInheritedAttributes(sourceClass, classModel);
    const sourceData = (sourceClass.data as any) || {};
    const sourceClassName: string = sourceData.name ?? 'object';

    const objectId = newId('obj');
    const attrRows = sourceAttributes.map((attr: any) => {
      const value = seedValue(attr, classModel);
      return {
        id: newId('attr'),
        // Bare name: the object row renders "name = value" from `value` itself.
        name: attr.name,
        attributeType: attr.attributeType ?? 'str',
        // Back-pointer to the source class attribute so future edits in
        // the class diagram can be reconciled if we ever add a sync
        // feature.
        attributeId: attr.id,
        value,
      };
    });

    const totalHeight = OBJECT_NAME_HEADER_HEIGHT + sourceAttributes.length * ATTRIBUTE_HEIGHT;
    const instanceName = nextFreeName(sourceClassName);

    outNodes.push({
      id: objectId,
      type: 'objectName',
      position: { x: nextX, y: 0 },
      width: OBJECT_NAME_WIDTH,
      height: totalHeight,
      measured: { width: OBJECT_NAME_WIDTH, height: totalHeight },
      data: {
        name: instanceName,
        classId: sourceClass.id,
        className: sourceClassName,
        attributes: attrRows,
        methods: [],
      },
    });

    objectByClassId.set(sourceClass.id, objectId);
    created += 1;
    nextX += OBJECT_NAME_WIDTH + HORIZONTAL_GAP;
  }

  // Track which class associations already have an ObjectLink so we don't
  // duplicate when the helper is re-run (multiple class associations
  // between the same two classes still emit distinct links per
  // associationId).
  const existingLinkAssociationIds = new Set<string>();
  for (const e of outEdges) {
    if (e.type !== 'ObjectLink') continue;
    const data = (e.data as any) || {};
    if (typeof data.associationId === 'string') existingLinkAssociationIds.add(data.associationId);
  }

  let links = 0;
  for (const rel of (classModel.edges ?? []) as any[]) {
    if (!rel || typeof rel !== 'object') continue;
    if (!ASSOCIATION_TYPES.has(rel.type)) continue;
    if (existingLinkAssociationIds.has(rel.id)) continue;

    const sourceClassId = rel.source;
    const targetClassId = rel.target;
    const sourceObjectId = sourceClassId ? objectByClassId.get(sourceClassId) : undefined;
    const targetObjectId = targetClassId ? objectByClassId.get(targetClassId) : undefined;
    // If either side has no object on the canvas (abstract class, missing
    // generation, etc.) we skip silently rather than emit a half-broken
    // link.
    if (!sourceObjectId || !targetObjectId) continue;

    const linkId = newId('link');
    outEdges.push({
      id: linkId,
      type: 'ObjectLink',
      source: sourceObjectId,
      target: targetObjectId,
      sourceHandle: (rel.sourceHandle as string) || 'right',
      targetHandle: (rel.targetHandle as string) || 'left',
      data: {
        name: ((rel.data as any) || {}).name ?? '',
        associationId: rel.id,
        points: [
          { x: 0, y: 0 },
          { x: 0, y: 0 },
        ],
        isManuallyLayouted: false,
      },
    });
    links += 1;
  }

  const v4Model: UMLModel = {
    ...(objectModel as any),
    version: '4.0.0',
    type: (objectModel as any).type ?? UMLDiagramType.ObjectDiagram,
    nodes: outNodes,
    edges: outEdges,
    interactive: (objectModel as any).interactive ?? { elements: {}, relationships: {} },
    assessments: (objectModel as any).assessments ?? {},
  } as UMLModel;

  return { model: v4Model, created, skipped, links };
};
