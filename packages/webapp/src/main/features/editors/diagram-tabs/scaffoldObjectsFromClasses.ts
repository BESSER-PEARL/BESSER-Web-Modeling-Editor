import {
  UMLDiagramType,
  UMLModel,
  convertV4ToV3Class,
  migrateObjectDiagramV3ToV4,
} from '@besser/wme';

/**
 * SA-7b: this scaffold helper was written for v3 model shape (`elements`
 * record, `relationships` record, attribute/method elements as separate
 * UMLElements with `owner` pointers). The editor now stores models in v4
 * shape (`nodes` array, `edges` array, attributes/methods inline on
 * `node.data`). Rather than rewriting ~400 LoC of v3-shaped scaffolding,
 * we convert v4 → v3 at the top, run the existing logic, then v3 → v4
 * at the bottom. The lib's `convertV4ToV3Class` handles ClassDiagram +
 * ObjectDiagram, and `migrateObjectDiagramV3ToV4` handles the reverse
 * for the ObjectDiagram output.
 */
function ensureV3(model: any): any {
  if (!model || typeof model !== 'object') return model;
  if (Array.isArray(model.elements)) return model; // not actually expected
  if ('elements' in model && 'relationships' in model) return model; // already v3
  if (Array.isArray(model.nodes) && Array.isArray(model.edges)) {
    try {
      return convertV4ToV3Class(model);
    } catch {
      return model;
    }
  }
  return model;
}

/**
 * Generate a deterministic Object Diagram from a Class Diagram.
 *
 * For every concrete `Class` in the source class diagram, the helper
 * produces one `ObjectName` element on the object diagram, plus one
 * `ObjectAttribute` per `ClassAttribute` of that class. Slot values come
 * from the source attribute's `defaultValue` when set, otherwise from
 * {@link defaultForType} based on `attributeType`.
 *
 * For every class-level association (`ClassBidirectional`,
 * `ClassUnidirectional`, `ClassAggregation`, `ClassComposition`) the
 * helper creates a single `ObjectLink` between the generated objects on
 * each side. Inheritance, realization, and dependency edges are skipped —
 * those are static-structure relationships that don't have a meaningful
 * runtime instance.
 *
 * The function is **additive**: existing objects whose `classId` is
 * already present on the canvas are skipped (the helper still uses them
 * as link endpoints if a relevant association needs them), so re-running
 * the action after manual edits doesn't wipe the user's work.
 *
 * Abstract classes and enumerations are skipped — instantiating an
 * abstract class is meaningless, and an enumeration is a value type.
 */

interface ScaffoldOptions {
  /** Source class-diagram model (already validated to be a UMLModel). */
  classModel: UMLModel;
  /** Current object-diagram model — used to skip already-instantiated classes
   *  and to compute the next free X position. */
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

/**
 * Built-in primitive types. Anything else in ``attributeType`` is treated
 * as a custom type — looked up in the class model (Enumeration → first
 * literal) and otherwise passed through as a literal type-name placeholder.
 */
const PRIMITIVE_TYPES = new Set([
  'int', 'integer', 'long',
  'float', 'double', 'decimal',
  'bool', 'boolean',
  'str', 'string', 'text',
  'date', 'datetime', 'time',
  'any',
]);

/**
 * Type-only fallback when no name-based heuristic matches. Picks something
 * non-zero so the slot looks "live" rather than placeholder-empty.
 *
 * Strings are returned unquoted: the editor displays the value as-is, and
 * users were getting visible double quotes around literals, which is noisy
 * and (more importantly) the validator's date type-check rejects a quoted
 * date string.
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

/**
 * Resolve an enumeration's first literal by name. Enumerations are stored
 * as ``Enumeration`` elements whose ``attributes`` array references
 * ``ClassAttribute`` elements that act as literals (their ``name`` is the
 * literal name). Returns ``undefined`` if no enum with that name exists or
 * the enum is empty — the caller falls back to a placeholder.
 */
const firstEnumLiteral = (
  enumName: string | undefined,
  classModel: UMLModel,
): string | undefined => {
  if (!enumName) return undefined;
  // SA-7b: by the time this is called, classModel has been down-converted to
  // v3 shape (elements/relationships records). Cast to any so TS doesn't
  // complain about the v4 typings.
  const v3Model = classModel as any;
  const enumElement = Object.values(v3Model.elements ?? {}).find(
    (el: any) => el?.type === 'Enumeration' && el.name === enumName,
  ) as any;
  if (!enumElement) return undefined;
  const literalIds: string[] = Array.isArray(enumElement.attributes) ? enumElement.attributes : [];
  for (const id of literalIds) {
    const lit: any = v3Model.elements?.[id];
    if (lit && typeof lit.name === 'string' && lit.name.length > 0) {
      return lit.name;
    }
  }
  return undefined;
};

/**
 * Name-aware sample-value generator. Looks at the attribute name first
 * (case- and word-boundary-insensitive) so the user gets
 * ``email = alice@example.com`` instead of ``email = sample``. Falls back
 * to {@link fallbackForType} when no name pattern matches.
 *
 * Strings are intentionally returned unquoted — the editor handles the
 * surrounding presentation, and the validator's date type-check rejects
 * quoted date literals.
 *
 * For non-primitive ``attributeType``s, looks up the type as an
 * Enumeration in the source class model and picks the first literal.
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

  // Booleans first — names like ``isActive`` should win over a generic match
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

/**
 * Class-level relationship types the helper turns into `ObjectLink`s. We
 * deliberately leave inheritance / realization / dependency out: those
 * describe static structure, not object-level relations.
 */
const ASSOCIATION_TYPES = new Set([
  'ClassBidirectional',
  'ClassUnidirectional',
  'ClassAggregation',
  'ClassComposition',
]);

/**
 * Result of the scaffold operation, returned so the caller can show a
 * meaningful toast. `created` counts new objects; `skipped` counts
 * classes that already had an instance on the canvas; `links` counts
 * `ObjectLink`s emitted for class associations.
 */
export interface ScaffoldResult {
  model: UMLModel;
  created: number;
  skipped: number;
  links: number;
}

/**
 * Pull a value to seed an object slot. Source-attribute `defaultValue`
 * takes precedence so a deliberate model-level default is never lost;
 * otherwise we ask {@link sampleByName} for a realistic stand-in based
 * on the attribute's name and type, including enum-literal lookup for
 * non-primitive types via ``classModel``.
 */
const seedValue = (attr: any, classModel: UMLModel): string => {
  const explicit = attr?.defaultValue;
  if (explicit !== undefined && explicit !== null && String(explicit).length > 0) {
    return String(explicit);
  }
  return sampleByName(attr?.name, attr?.attributeType, classModel);
};

export const scaffoldObjectsFromClasses = ({
  classModel,
  objectModel,
}: ScaffoldOptions): ScaffoldResult => {
  // SA-7b: down-convert to v3 so the existing scaffolding logic works.
  classModel = ensureV3(classModel) as UMLModel;
  objectModel = ensureV3(objectModel) as UMLModel;

  // Defensive copy so we never mutate the live model the editor is rendering.
  const elements: Record<string, any> = { ...((objectModel as any).elements ?? {}) };
  const relationships: Record<string, any> = { ...((objectModel as any).relationships ?? {}) };

  // Source class ID -> object element ID, so links can target them.
  // Pre-populated from existing canvas objects so links can connect to
  // user-created instances too, not just freshly generated ones.
  const objectByClassId = new Map<string, string>();
  for (const el of Object.values(elements)) {
    if (el?.type === 'ObjectName' && typeof el.classId === 'string' && el.classId) {
      objectByClassId.set(el.classId, el.id);
    }
  }

  // Compute the next free x by looking at where existing elements end.
  let nextX = 0;
  for (const el of Object.values(elements)) {
    if (el?.type === 'ObjectName' && el.bounds) {
      const right = (el.bounds.x ?? 0) + (el.bounds.width ?? OBJECT_NAME_WIDTH);
      if (right + HORIZONTAL_GAP > nextX) nextX = right + HORIZONTAL_GAP;
    }
  }

  let created = 0;
  let skipped = 0;

  for (const sourceClass of Object.values((classModel as any).elements ?? {}) as any[]) {
    if (!sourceClass || typeof sourceClass !== 'object') continue;
    // Skip non-instantiable kinds. AbstractClass is intentionally excluded;
    // Enumerations are already value types.
    if (sourceClass.type !== 'Class') continue;
    if (objectByClassId.has(sourceClass.id)) {
      skipped += 1;
      continue;
    }

    const sourceAttributeIds: string[] = Array.isArray((sourceClass as any).attributes)
      ? (sourceClass as any).attributes
      : [];
    const sourceAttributes = sourceAttributeIds
      .map((id) => (classModel as any).elements?.[id])
      .filter((a: any) => a && a.type === 'ClassAttribute');

    const objectId = newId('obj');
    const childIds: string[] = [];

    sourceAttributes.forEach((attr: any, idx: number) => {
      const attrId = newId('attr');
      childIds.push(attrId);
      const value = seedValue(attr, classModel);
      elements[attrId] = {
        id: attrId,
        name: `${attr.name} = ${value}`,
        type: 'ObjectAttribute',
        owner: objectId,
        bounds: {
          x: nextX,
          y: OBJECT_NAME_HEADER_HEIGHT + idx * ATTRIBUTE_HEIGHT,
          width: OBJECT_NAME_WIDTH,
          height: ATTRIBUTE_HEIGHT,
        },
        attributeType: attr.attributeType ?? 'str',
        // Store a back-pointer to the source attribute so future edits in
        // the class diagram can be reconciled if we ever add a sync feature.
        attributeId: attr.id,
      };
    });

    elements[objectId] = {
      id: objectId,
      name: `${(sourceClass.name ?? 'object').charAt(0).toLowerCase() + (sourceClass.name ?? 'object').slice(1)}1`,
      type: 'ObjectName',
      owner: null,
      bounds: {
        x: nextX,
        y: 0,
        width: OBJECT_NAME_WIDTH,
        height: OBJECT_NAME_HEADER_HEIGHT + sourceAttributes.length * ATTRIBUTE_HEIGHT,
      },
      attributes: childIds,
      methods: [],
      classId: sourceClass.id,
      className: sourceClass.name,
    };

    objectByClassId.set(sourceClass.id, objectId);
    created += 1;
    nextX += OBJECT_NAME_WIDTH + HORIZONTAL_GAP;
  }

  // Track which (sourceClassA, sourceClassB) pairs already have an
  // ObjectLink so we don't duplicate when the helper is re-run, and so
  // multiple class associations between the same two classes still emit
  // distinct links per association ID.
  const existingLinkAssociationIds = new Set<string>();
  for (const rel of Object.values(relationships)) {
    if (rel?.type === 'ObjectLink' && typeof rel.associationId === 'string') {
      existingLinkAssociationIds.add(rel.associationId);
    }
  }

  let links = 0;
  for (const rel of Object.values((classModel as any).relationships ?? {}) as any[]) {
    if (!rel || typeof rel !== 'object') continue;
    if (!ASSOCIATION_TYPES.has(rel.type)) continue;
    if (existingLinkAssociationIds.has(rel.id)) continue;

    const sourceClassId = (rel as any).source?.element;
    const targetClassId = (rel as any).target?.element;
    const sourceObjectId = sourceClassId ? objectByClassId.get(sourceClassId) : undefined;
    const targetObjectId = targetClassId ? objectByClassId.get(targetClassId) : undefined;
    // If either side has no object on the canvas (abstract class, missing
    // generation, etc.) we skip silently rather than emit a half-broken
    // link.
    if (!sourceObjectId || !targetObjectId) continue;

    const linkId = newId('link');
    relationships[linkId] = {
      id: linkId,
      name: (rel as any).name ?? '',
      type: 'ObjectLink',
      owner: null,
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      path: [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
      ],
      source: {
        direction: (rel as any).source?.direction ?? 'Right',
        element: sourceObjectId,
      },
      target: {
        direction: (rel as any).target?.direction ?? 'Left',
        element: targetObjectId,
      },
      isManuallyLayouted: false,
      associationId: (rel as any).id,
    };
    links += 1;
  }

  // Build a v3 ObjectDiagram payload, then up-convert back to v4 so the editor
  // and Redux store can consume it directly.
  const v3Output = {
    ...(objectModel as any),
    elements,
    relationships,
    type: (objectModel as any).type ?? UMLDiagramType.ObjectDiagram,
    // The migrator expects a 3.x version string; if the down-converted model
    // already has one, leave it alone.
    version: (objectModel as any).version && String((objectModel as any).version).startsWith('3.')
      ? (objectModel as any).version
      : '3.0.0',
  };

  let v4Model: UMLModel;
  try {
    v4Model = migrateObjectDiagramV3ToV4(v3Output);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[scaffoldObjectsFromClasses] v3→v4 conversion failed; returning raw model', err);
    v4Model = v3Output as UMLModel;
  }

  return {
    model: v4Model,
    created,
    skipped,
    links,
  };
};
