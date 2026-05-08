/**
 * Generate a deterministic Object Diagram from a Class Diagram (v4-native).
 *
 * SA-7b.2: walks v4 `model.nodes[]` / `model.edges[]` directly. No v3↔v4
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
 * For every class-level association edge (`ClassBidirectional`,
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
import { UMLDiagramType, UMLModel } from '@besser/wme';

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
 *  v4 nodes with `type: 'class'` and `data.stereotype === 'enumeration'`;
 *  literals live in `data.attributes` as ClassifierMember rows.
 */
const firstEnumLiteral = (
  enumName: string | undefined,
  classModel: UMLModel,
): string | undefined => {
  if (!enumName) return undefined;
  const enumNode = (classModel.nodes ?? []).find((n: any) => {
    const data = (n.data as any) || {};
    const isEnumNode =
      n.type === 'class' && data.stereotype === 'enumeration';
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

/** Name-aware sample-value generator. Looks at the attribute name first
 *  (case- and word-boundary-insensitive) so the user gets
 *  `email = alice@example.com` instead of `email = sample`. Falls back to
 *  {@link fallbackForType} when no name pattern matches.
 */
const sampleByName = (
  rawName: string | undefined,
  attributeType: string | undefined,
  classModel: UMLModel,
): string => {
  const name = (rawName ?? '').toLowerCase();
  const type = (attributeType ?? '').toLowerCase();
  const isNumeric = ['int', 'integer', 'long', 'float', 'double', 'decimal'].includes(type);
  const isBool = ['bool', 'boolean'].includes(type);

  // Custom type — most commonly an Enumeration. Use the first literal as
  // a sensible default. If the type isn't a known enum we fall through to
  // the type-only fallback (which returns '' for unknown types so the
  // user is prompted to fill it in).
  if (attributeType && !PRIMITIVE_TYPES.has(type)) {
    const literal = firstEnumLiteral(attributeType, classModel);
    if (literal) return literal;
  }

  // Booleans first — names like `isActive` should win over a generic match
  if (isBool || /^(is|has|can|should)[A-Z_]/.test(rawName ?? '')) {
    if (/(active|enabled|valid|available|published|visible|allowed|verified)/.test(name)) return 'true';
    if (/(deleted|disabled|hidden|blocked|locked|expired|archived)/.test(name)) return 'false';
    if (isBool) return 'true';
  }

  // Identifiers
  if (/(^|_)id$|^id$/.test(name)) return isNumeric ? '1' : 'id-1';
  if (/^uuid$|guid/.test(name)) return '00000000-0000-0000-0000-000000000001';

  // People / addresses
  if (/firstname|first_name|givenname/.test(name)) return 'Alice';
  if (/lastname|last_name|surname|familyname/.test(name)) return 'Smith';
  if (/fullname|full_name|displayname/.test(name)) return 'Alice Smith';
  if (/^name$|_name$/.test(name)) return 'Sample';
  if (/(email|mail)/.test(name)) return 'alice@example.com';
  if (/(phone|mobile|tel)/.test(name)) return '+1-555-0100';
  if (/(address|street)/.test(name)) return '123 Main St';
  if (/(city|town)/.test(name)) return 'Springfield';
  if (/(country|nation)/.test(name)) return 'France';
  if (/(zip|postal|postcode)/.test(name)) return '10001';

  // Dimensions / counts / numerics
  if (/age/.test(name) && isNumeric) return '25';
  if (/(year)/.test(name) && isNumeric) return '2026';
  if (/(month)/.test(name) && isNumeric) return '1';
  if (/(day)/.test(name) && isNumeric) return '1';
  if (/(price|cost|amount|total|salary|fee|balance)/.test(name)) {
    return type === 'int' ? '10' : '9.99';
  }
  if (/(rating|score|rank)/.test(name)) return type === 'int' ? '5' : '4.5';
  if (/(count|quantity|qty|stock|number)/.test(name) && isNumeric) return '10';
  if (/pages?/.test(name) && isNumeric) return '200';
  if (/(weight)/.test(name) && isNumeric) return type === 'int' ? '70' : '70.5';
  if (/(height|width|length|size|depth)/.test(name)) {
    return type === 'int' ? '100' : '10.0';
  }

  // Dates / times
  if (type === 'date' || (/(birth(date)?|date|created|updated|release|published|start|end)/.test(name) && type !== 'datetime' && type !== 'time')) {
    return '2026-01-01';
  }
  if (type === 'datetime' || /(at$|timestamp)/.test(name)) {
    return '2026-01-01T00:00:00';
  }
  if (type === 'time') return '00:00:00';

  // Web / media
  if (/(url|website|web_page|webpage|link|href)/.test(name)) return 'https://example.com';
  if (/(image|photo|picture|avatar|icon)/.test(name)) return 'https://example.com/image.png';

  // Auth-ish
  if (/(username|login|handle)/.test(name)) return 'alice';
  if (/password/.test(name)) return 'password';
  if (/token|secret|apikey|api_key/.test(name)) return 'changeme';

  // Free text
  if (/(title|subject|label)/.test(name)) return 'Sample Title';
  if (/(description|summary|comment|note|body|content)/.test(name)) return 'Sample description';
  if (/(status|state)/.test(name)) return 'active';
  if (/(language|lang|locale)/.test(name)) return 'en';
  if (/(currency)/.test(name)) return 'USD';
  if (/(color|colour)/.test(name)) return '#000000';

  return fallbackForType(attributeType);
};

const OBJECT_NAME_WIDTH = 240;
const OBJECT_NAME_HEADER_HEIGHT = 40;
const ATTRIBUTE_HEIGHT = 25;
const HORIZONTAL_GAP = 50;

/** Class-level relationship types the helper turns into `ObjectLink`s.
 *  Inheritance / realization / dependency are intentionally excluded —
 *  those describe static structure, not object-level relations.
 */
const ASSOCIATION_TYPES = new Set([
  'ClassBidirectional',
  'ClassUnidirectional',
  'ClassAggregation',
  'ClassComposition',
]);

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
        name: value !== undefined && value !== null && String(value).length > 0
          ? `${attr.name} = ${value}`
          : attr.name,
        attributeType: attr.attributeType ?? 'str',
        // Back-pointer to the source class attribute so future edits in
        // the class diagram can be reconciled if we ever add a sync
        // feature.
        attributeId: attr.id,
        value,
      };
    });

    const totalHeight = OBJECT_NAME_HEADER_HEIGHT + sourceAttributes.length * ATTRIBUTE_HEIGHT;
    const instanceName = `${sourceClassName.charAt(0).toLowerCase()}${sourceClassName.slice(1)}1`;

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
      sourceHandle: (rel.sourceHandle as string) || 'Right',
      targetHandle: (rel.targetHandle as string) || 'Left',
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
