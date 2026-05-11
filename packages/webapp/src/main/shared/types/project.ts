import { UMLDiagramType, UMLModel, getUserMetaModelClasses } from '@besser/wme';
import { migrateUMLModelV3ToV4 } from '../services/storage/migrate-uml-v3-to-v4';
// Supported diagram types in projects
export type SupportedDiagramType =
  | 'ClassDiagram'
  | 'ObjectDiagram'
  | 'StateMachineDiagram'
  | 'AgentDiagram'
  | 'UserDiagram'
  | 'GUINoCodeDiagram'
  | 'QuantumCircuitDiagram'
  | 'NNDiagram';

export const MAX_DIAGRAMS_PER_TYPE = 5;
export const PROJECT_SCHEMA_VERSION = 5;

export const ALL_DIAGRAM_TYPES: SupportedDiagramType[] = [
  'ClassDiagram', 'ObjectDiagram', 'StateMachineDiagram', 'AgentDiagram', 'UserDiagram', 'GUINoCodeDiagram', 'QuantumCircuitDiagram', 'NNDiagram',
];

export type PerspectiveSettings = Record<SupportedDiagramType, boolean>;

export const createDefaultPerspectives = (): PerspectiveSettings => {
  const map = {} as PerspectiveSettings;
  for (const type of ALL_DIAGRAM_TYPES) {
    map[type] = true;
  }
  return map;
};

export const defaultPerspectivesAllEnabled = (
  partial?: Partial<PerspectiveSettings>,
): PerspectiveSettings => {
  const map = createDefaultPerspectives();
  if (partial) {
    for (const type of ALL_DIAGRAM_TYPES) {
      if (typeof partial[type] === 'boolean') {
        map[type] = partial[type] as boolean;
      }
    }
  }
  return map;
};

export const isPerspectiveVisible = (
  perspectives: PerspectiveSettings | undefined,
  type: SupportedDiagramType,
): boolean => perspectives?.[type] !== false;

// GrapesJS project data structure
export interface GrapesJSProjectData {
  pages: any[];
  styles: any[];
  assets: any[];
  symbols: any[];
  version: string;
}

// Quantum Circuit data structure
export interface QuantumCircuitData {
  cols: any[][]; // Each column is an array where 1 = empty, strings = gate symbols
  gates: any[]; // Custom gates (optional)
  gateMetadata?: Record<string, any>; // Metadata for gates with nested circuits, custom labels, etc.
  initialStates?: string[]; // Initial qubit states
  version?: string;
}

// Diagram structure within a project
export interface ProjectDiagram {
  id: string;
  title: string;
  model?: UMLModel | GrapesJSProjectData | QuantumCircuitData;
  lastUpdate: string;
  description?: string;
  config?: Record<string, unknown>;  // agent LLM/platform/IC config
  /** Per-diagram cross-references: maps a diagram type to the ID of the diagram this depends on.
   *  E.g. a GUINoCodeDiagram may reference a specific ClassDiagram and AgentDiagram by their UUID. */
  references?: Partial<Record<SupportedDiagramType, string>>;
}

export type ProjectDiagramModel = UMLModel | GrapesJSProjectData | QuantumCircuitData;

// New centralized project structure
export interface BesserProject {
  id: string;
  type: 'Project';
  schemaVersion: number;
  name: string;
  description: string;
  owner: string;
  createdAt: string;
  currentDiagramType: SupportedDiagramType; // Which diagram type is currently active
  currentDiagramIndices: Record<SupportedDiagramType, number>; // Active diagram index per type
  diagrams: {
    ClassDiagram: ProjectDiagram[];
    ObjectDiagram: ProjectDiagram[];
    StateMachineDiagram: ProjectDiagram[];
    AgentDiagram: ProjectDiagram[];
    UserDiagram: ProjectDiagram[];
    GUINoCodeDiagram: ProjectDiagram[];
    QuantumCircuitDiagram: ProjectDiagram[];
    NNDiagram: ProjectDiagram[];
  };
  settings: {
    defaultDiagramType: SupportedDiagramType;
    autoSave: boolean;
    collaborationEnabled: boolean;
    perspectives: PerspectiveSettings;
  };
}

// Helper to get the active diagram for a type
export const getActiveDiagram = (project: BesserProject, type: SupportedDiagramType): ProjectDiagram | undefined => {
  const diagrams = project.diagrams[type];
  if (!diagrams || diagrams.length === 0) return undefined;
  const index = project.currentDiagramIndices[type] ?? 0;
  return diagrams[index] ?? diagrams[0];
};

/**
 * Get a diagram that another diagram references.
 * Reads `fromDiagram.references[refType]` (a diagram ID), falls back to
 * `currentDiagramIndices[refType]` (index-based).
 *
 * Example: `getReferencedDiagram(project, activeGUI, 'ClassDiagram')` returns the
 * ClassDiagram that this specific GUI diagram is linked to.
 */
export const getReferencedDiagram = (
  project: BesserProject,
  fromDiagram: ProjectDiagram | undefined,
  refType: SupportedDiagramType,
): ProjectDiagram | undefined => {
  const diagrams = project.diagrams[refType];
  if (!diagrams || diagrams.length === 0) return undefined;

  // Look up by ID (stable across deletions/reordering)
  const refId = fromDiagram?.references?.[refType];
  if (refId) {
    const found = diagrams.find(d => d.id === refId);
    if (found) return found;
    // Referenced diagram was deleted — fall through to default
  }

  // Fallback: use global active index
  const fallbackIndex = project.currentDiagramIndices[refType] ?? 0;
  return diagrams[Math.min(fallbackIndex, diagrams.length - 1)];
};

// Default indices (all zeros)
const defaultDiagramIndices = (): Record<SupportedDiagramType, number> => ({
  ClassDiagram: 0,
  ObjectDiagram: 0,
  StateMachineDiagram: 0,
  AgentDiagram: 0,
  UserDiagram: 0,
  GUINoCodeDiagram: 0,
  QuantumCircuitDiagram: 0,
  NNDiagram: 0,
});

// Migrate v1 project (single diagram per type) to v2 (array per type)
export const migrateProjectToV2 = (project: any): BesserProject => {
  if (project.schemaVersion >= 2) {
    return project as BesserProject;
  }

  const migrated = { ...project };
  migrated.schemaVersion = 2;
  migrated.currentDiagramIndices = project.currentDiagramIndices ?? defaultDiagramIndices();

  // Wrap each single diagram in an array if not already
  for (const type of ALL_DIAGRAM_TYPES) {
    const value = migrated.diagrams[type];
    if (value && !Array.isArray(value)) {
      migrated.diagrams[type] = [value];
    } else if (!value) {
      // Create empty diagram for missing types
      const umlType = toUMLDiagramType(type);
      const kind = type === 'GUINoCodeDiagram' ? 'gui' : type === 'QuantumCircuitDiagram' ? 'quantum' : undefined;
      migrated.diagrams[type] = [createEmptyDiagram(type.replace('Diagram', ' Diagram'), umlType, kind)];
    }
  }

  return migrated as BesserProject;
};

// Helper to convert UMLDiagramType to SupportedDiagramType
export const toSupportedDiagramType = (type: UMLDiagramType): SupportedDiagramType => {
  switch (type) {
    case UMLDiagramType.ClassDiagram:
      return 'ClassDiagram';
    case UMLDiagramType.ObjectDiagram:
      return 'ObjectDiagram';
    case UMLDiagramType.StateMachineDiagram:
      return 'StateMachineDiagram';
    case UMLDiagramType.AgentDiagram:
      return 'AgentDiagram';
    case UMLDiagramType.NNDiagram:
      return 'NNDiagram';
    case UMLDiagramType.UserDiagram:
      return 'UserDiagram';
    default:
      return 'ClassDiagram'; // fallback
  }
};

// Helper to convert SupportedDiagramType to UMLDiagramType
export const toUMLDiagramType = (type: SupportedDiagramType): UMLDiagramType | null => {
  switch (type) {
    case 'ClassDiagram':
      return UMLDiagramType.ClassDiagram;
    case 'ObjectDiagram':
      return UMLDiagramType.ObjectDiagram;
    case 'StateMachineDiagram':
      return UMLDiagramType.StateMachineDiagram;
    case 'AgentDiagram':
      return UMLDiagramType.AgentDiagram;
    case 'NNDiagram':
      return UMLDiagramType.NNDiagram;
    case 'UserDiagram':
      return UMLDiagramType.UserDiagram;
    case 'GUINoCodeDiagram':
      return null; // GUINoCodeDiagram doesn't have a UML diagram type
    case 'QuantumCircuitDiagram':
      return null; // QuantumCircuitDiagram doesn't have a UML diagram type
    default:
      return null;
  }
};

/**
 * Generate a UUID, with fallback for insecure contexts (plain HTTP).
 * `crypto.randomUUID()` is only available in secure contexts (HTTPS or localhost).
 */
const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback using crypto.getRandomValues (available in all modern browsers)
  return (([1e7] as any) + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c: number) =>
    (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16),
  );
};

/**
 * SA-UX-FIX-2 (B3) / SA-FIX-User: seed for the UserDiagram template.
 *
 * The v3 editor surfaced a multi-class user-meta-model whenever the
 * UserDiagram tab was opened (`composeUserModelPreview`). After the
 * v4 cutover, opening the UserDiagram tab produced an empty canvas
 * with at most a single placeholder card. Restore the v3 baseline by
 * seeding the four standard meta-model classes (Personal_Information /
 * Skill / Education / Disability) — read directly from the meta-model
 * JSON via `getUserMetaModelClasses()` so the seed is in lock-step
 * with the source of truth.
 *
 * Type strategy (SA-FIX-User Fix #2): the meta-model JSON uses raw
 * enum class names (`GenderEnum`, `DegreeEnum`, `AspectsEnum`, …) for
 * enum-typed attributes. Those are NOT primitive types and the v4
 * inspector resolves them by linking to the meta-model class via
 * `attributeId`. Primitive types (`str`, `int`, `bool`, `float`,
 * `date`, `datetime`, `time`) pass through verbatim; non-primitive
 * types are converted to an empty `attributeType` plus an
 * `attributeId` link pointing at the meta-model attribute's UUID. The
 * inspector picks up the linked enum literals via the diagramBridge
 * (which is fed `getUserMetaModelV4()`).
 *
 * Seeded as v4 React-Flow nodes (`UserModelName`) with their attribute
 * rows already populated so the user lands on a usable template.
 */
// The 4 default meta-model classes shown in v3's `composeUserModelPreview`.
// Order matters — controls layout left-to-right.
const DEFAULT_USER_META_CLASSES = [
  'Personal_Information',
  'Skill',
  'Education',
  'Disability',
] as const;

const PRIMITIVE_ATTRIBUTE_TYPES = new Set([
  'str',
  'string',
  'int',
  'integer',
  'float',
  'double',
  'bool',
  'boolean',
  'date',
  'datetime',
  'time',
  'any',
]);

export const buildUserDiagramSeedNodes = (): UMLModel['nodes'] => {
  // Coordinates picked to lay out the 4 cards on a single row with a
  // small gap. Each card is auto-sized by `UserModelName`'s effect; we
  // pre-set sensible widths/heights so the initial paint is stable.
  const HEADER = 40;
  const ATTR = 30;
  const PAD = 10;
  const W = 220;
  const GAP = 30;

  // Pull the meta-model classes by name. If the JSON is unavailable for
  // any reason we degrade to an empty seed rather than throwing.
  const metaClassesByName: Record<string, ReturnType<typeof getUserMetaModelClasses>[number]> = {};
  try {
    for (const c of getUserMetaModelClasses()) {
      metaClassesByName[c.name] = c;
    }
  } catch {
    // Best-effort: if the helper is unavailable we still produce empty
    // cards so the canvas isn't blank.
  }

  return DEFAULT_USER_META_CLASSES.map((className, idx) => {
    const meta = metaClassesByName[className];
    const attrs = (meta?.attributes ?? []).map((a) => {
      const isPrimitive = PRIMITIVE_ATTRIBUTE_TYPES.has(a.attributeType.toLowerCase());
      if (isPrimitive) {
        return {
          id: generateUUID(),
          name: a.name,
          attributeType: a.attributeType,
          attributeOperator: '==',
        };
      }
      // Non-primitive (enum / linked class): leave attributeType empty
      // and link via attributeId so the inspector can resolve enum
      // literals through the diagramBridge.
      return {
        id: generateUUID(),
        name: a.name,
        attributeType: '',
        attributeId: a.id,
        attributeOperator: '==',
      };
    });
    const height = HEADER + Math.max(attrs.length, 0) * ATTR + PAD;
    // `UserModelName` is a BESSER-registered node type (added at runtime
    // via `registerNodeTypes`). The static `DiagramNodeType` union only
    // tracks upstream defaults, so we cast through `unknown` at the
    // boundary — same pattern other BESSER seed code uses.
    return {
      id: generateUUID(),
      type: 'UserModelName',
      position: { x: idx * (W + GAP), y: 0 },
      width: W,
      height,
      measured: { width: W, height },
      data: {
        name: className,
        // Cross-link to the meta-model class so other tooling can
        // resolve which meta-model concept this user node instantiates.
        classId: meta?.id,
        className,
        attributes: attrs,
      },
    } as unknown as UMLModel['nodes'][number];
  });
};

// Default diagram factory
export const createEmptyDiagram = (title: string, type: UMLDiagramType | null, diagramKind?: 'gui' | 'quantum'): ProjectDiagram => {
  // For Quantum Circuit diagram
  if (diagramKind === 'quantum') {
    return {
      id: generateUUID(),
      title,
      model: {
        cols: [],
        gates: [],
        gateMetadata: {},
        initialStates: [],
        version: '1.0.0'
      } as QuantumCircuitData,
      lastUpdate: new Date().toISOString(),
    };
  }

  // For GUI/No-Code diagram
  if (type === null || diagramKind === 'gui') {
    // ========================================
    // 🎨 EMPTY GUI DIAGRAM
    // ========================================
    // The GUI diagram starts with one empty page - users can drag blocks from Templates category
    return {
      id: generateUUID(),
      title,
      model: {
        pages: [
          {
            name: 'Home',
            frames: [
              {
                component: {
                  type: 'wrapper',
                  stylable: [
                    'background',
                    'background-color',
                    'background-image',
                    'background-repeat',
                    'background-attachment',
                    'background-position',
                    'background-size'
                  ],
                  components: [],
                  head: { type: 'head' },
                  docEl: { tagName: 'html' }
                }
              }
            ]
          }
        ],
        styles: [],
        assets: [],
        symbols: [],
        version: '0.21.13'
      } as GrapesJSProjectData,
      lastUpdate: new Date().toISOString(),
    };
  }

  // For UML diagrams (v4 shape)
  // SA-UX-FIX-2 (B3): UserDiagram gets a default user-meta-model template
  // so the tab is non-empty on first open. Other diagrams stay blank.
  const seededNodes =
    type === UMLDiagramType.UserDiagram ? buildUserDiagramSeedNodes() : [];
  return {
    id: generateUUID(),
    title,
    model: {
      version: '4.0.0' as const,
      id: generateUUID(),
      title,
      type,
      nodes: seededNodes,
      edges: [],
      interactive: { elements: {}, relationships: {} },
      assessments: {},
    } as UMLModel,
    lastUpdate: new Date().toISOString(),
  };
};

// Factory to create default GUI template (used on first editor load)
// Returns a minimal structure with one empty page - users can drag the "Full Home Page" block from Templates category
export const createDefaultGUITemplate = (): GrapesJSProjectData => {
  return {
    pages: [
      {
        name: 'Home',
        frames: [
          {
            component: {
              type: 'wrapper',
              stylable: [
                'background',
                'background-color',
                'background-image',
                'background-repeat',
                'background-attachment',
                'background-position',
                'background-size'
              ],
              components: [],
              head: { type: 'head' },
              docEl: { tagName: 'html' }
            }
          }
        ]
      }
    ],
    styles: [],
    assets: [],
    symbols: [],
    version: '0.21.13'
  };
};

// Default project factory
export const createDefaultProject = (
  name: string,
  description: string,
  owner: string,
  perspectives?: PerspectiveSettings,
): BesserProject => {
  const projectId = generateUUID();

  return {
    id: projectId,
    type: 'Project',
    schemaVersion: PROJECT_SCHEMA_VERSION,
    name,
    description,
    owner,
    createdAt: new Date().toISOString(),
    currentDiagramType: 'ClassDiagram',
    currentDiagramIndices: defaultDiagramIndices(),
    diagrams: {
      ClassDiagram: [createEmptyDiagram('Class Diagram', UMLDiagramType.ClassDiagram)],
      ObjectDiagram: [createEmptyDiagram('Object Diagram', UMLDiagramType.ObjectDiagram)],
      StateMachineDiagram: [createEmptyDiagram('State Machine Diagram', UMLDiagramType.StateMachineDiagram)],
      AgentDiagram: [createEmptyDiagram('Agent Diagram', UMLDiagramType.AgentDiagram)],
      UserDiagram: [createEmptyDiagram('User Diagram', UMLDiagramType.UserDiagram)],
      GUINoCodeDiagram: [createEmptyDiagram('GUI Diagram', null, 'gui')],
      QuantumCircuitDiagram: [createEmptyDiagram('Quantum Circuit', null, 'quantum')],
      NNDiagram: [createEmptyDiagram('NN Diagram', UMLDiagramType.NNDiagram)],
    },
    settings: {
      defaultDiagramType: 'ClassDiagram',
      autoSave: true,
      collaborationEnabled: false,
      perspectives: perspectives ?? createDefaultPerspectives(),
    },
  };
};

// Type guard — pure check, no mutation
export const isProject = (obj: any): obj is BesserProject => {
  if (!obj || typeof obj !== 'object' || obj.type !== 'Project') {
    return false;
  }

  if (!obj.diagrams || typeof obj.diagrams !== 'object' || !obj.currentDiagramType) {
    return false;
  }

  const hasRequiredDiagrams =
    obj.diagrams.ClassDiagram &&
    obj.diagrams.ObjectDiagram &&
    obj.diagrams.StateMachineDiagram &&
    obj.diagrams.AgentDiagram &&
    obj.diagrams.GUINoCodeDiagram &&
    obj.diagrams.QuantumCircuitDiagram;

  return !!hasRequiredDiagrams;
};

// Migrate/normalize a project object (called after isProject check, mutates in place)
export const ensureProjectMigrated = (obj: BesserProject): BesserProject => {
  // Add QuantumCircuitDiagram if missing
  if (!obj.diagrams.QuantumCircuitDiagram) {
    obj.diagrams.QuantumCircuitDiagram = [createEmptyDiagram('Quantum Circuit', null, 'quantum')];
  }

  // Add NNDiagram if missing
  if (!obj.diagrams.NNDiagram) {
    obj.diagrams.NNDiagram = [createEmptyDiagram('NN Diagram', UMLDiagramType.NNDiagram)];
  }

  // Add UserDiagram if missing
  if (!obj.diagrams.UserDiagram) {
    obj.diagrams.UserDiagram = [createEmptyDiagram('User Diagram', UMLDiagramType.UserDiagram)];
  }

  // Ensure index entry exists for UserDiagram
  if (obj.currentDiagramIndices.UserDiagram === undefined) {
    obj.currentDiagramIndices.UserDiagram = 0;
  }

  // Auto-migrate v1 (single diagram per type) to v2 (array per type)
  if (!obj.schemaVersion || obj.schemaVersion < 2) {
    obj = migrateProjectToV2(obj);
  }

  // Migrate v2 → v3: convert index-based references to ID-based and populate defaults
  if (!obj.schemaVersion || obj.schemaVersion < 3) {
    obj = migrateReferencesToIds(obj);
  }

  // Migrate v3 → v4: ensure settings.perspectives exists (all enabled by default)
  if (!obj.schemaVersion || obj.schemaVersion < 4) {
    obj = migratePerspectiveSettings(obj);
  }

  // Migrate v4 → v5: convert v3-shape UML models (elements/relationships) to v4 (nodes/edges)
  if (!obj.schemaVersion || obj.schemaVersion < 5) {
    obj = migrateProjectToV5(obj);
  }

  // SA-FIX-User Fix #3: retrofit existing-but-empty UserDiagrams. v3
  // showed a 4-class meta-model template via `composeUserModelPreview`,
  // but PC-9 found that v4 only seeds via `createEmptyDiagram` (i.e.
  // only on fresh project creation). Projects loaded from storage that
  // were created before SA-UX-FIX-2 — or had their UserDiagram emptied
  // by the user without re-seeding — would stay blank forever. Walk
  // every UserDiagram entry and re-seed any whose `model.nodes` array
  // is empty. Idempotent: never touches a UserDiagram that already has
  // user content. Retrofit runs on every load (not gated behind a
  // schemaVersion bump) because the symptom is "blank canvas", not
  // "wrong schema".
  retrofitEmptyUserDiagrams(obj);

  return obj;
};

/**
 * SA-FIX-User Fix #3: walk a project's UserDiagram entries and seed
 * any whose nodes array is empty. Mutates in place; returns nothing.
 */
const retrofitEmptyUserDiagrams = (project: BesserProject): void => {
  const userDiagrams = project.diagrams?.UserDiagram ?? [];
  for (const d of userDiagrams) {
    const model = d?.model as UMLModel | undefined;
    // Only retrofit when the model is a proper v4 UML shape with an
    // empty nodes array. Skip GUI / quantum models (not UMLModels) and
    // skip diagrams that already have user content.
    if (
      model &&
      Array.isArray((model as any).nodes) &&
      (model as any).nodes.length === 0 &&
      Array.isArray((model as any).edges) // sanity: real v4 UMLModel
    ) {
      try {
        (model as any).nodes = buildUserDiagramSeedNodes();
      } catch (err) {
        // Best-effort: a failed retrofit must not block the load.
        // eslint-disable-next-line no-console
        console.error('[retrofitEmptyUserDiagrams] seeding failed', d.id, err);
      }
    }
  }
};

/**
 * Migrate v4 → v5: walk every per-diagram UML model and run the v3 → v4
 * shape migrator from `@besser/wme`. GUI / quantum diagrams are skipped
 * because their models are not UMLModels.
 *
 * Atomicity (SA-FINAL-3 Task 3 fix): `schemaVersion` is only stamped to 5
 * when EVERY diagram migration succeeds. If any diagram throws, the v3
 * model is left in place AND `schemaVersion` is left unchanged so the
 * next load retries — honouring the previous "next launch will retry"
 * promise that the unconditional bump was silently breaking.
 *
 * Failing diagrams are surfaced via `console.warn` with the title and
 * error so operators can spot the bad data in the browser console.
 */
export const migrateProjectToV5 = (project: BesserProject): BesserProject => {
  if (project.schemaVersion >= 5) return project;

  let allSucceeded = true;

  for (const type of ALL_DIAGRAM_TYPES) {
    if (type === 'GUINoCodeDiagram' || type === 'QuantumCircuitDiagram') continue;
    const diagrams = project.diagrams[type] ?? [];
    for (const d of diagrams) {
      if (d.model && isV3UMLModel(d.model)) {
        try {
          d.model = migrateUMLModelV3ToV4(d.model, type);
        } catch (err) {
          // Keep v3 model in place on failure.
          allSucceeded = false;
          // eslint-disable-next-line no-console
          console.warn(
            `[migrateProjectToV5] Failed to migrate diagram "${d.title}" (${type}, id=${d.id}); schemaVersion will not be bumped so the next load retries.`,
            err,
          );
        }
      }
    }
  }

  if (allSucceeded) {
    project.schemaVersion = 5;
  }
  return project;
};

/**
 * Migrate v3 → v4: ensure `settings.perspectives` is populated with a boolean
 * for every supported diagram type. Existing user choices are preserved; missing
 * keys default to `true` (perspective visible).
 */
const migratePerspectiveSettings = (project: BesserProject): BesserProject => {
  const existingSettings = (project.settings ?? {}) as Partial<BesserProject['settings']>;
  project.settings = {
    defaultDiagramType: existingSettings.defaultDiagramType ?? 'ClassDiagram',
    autoSave: existingSettings.autoSave ?? true,
    collaborationEnabled: existingSettings.collaborationEnabled ?? false,
    perspectives: defaultPerspectivesAllEnabled(existingSettings.perspectives),
  };
  project.schemaVersion = 4;
  return project;
};

/**
 * Migrate v2 → v3: convert old index-based `references` (numbers) to ID-based (strings),
 * and populate default references on diagrams that should have them.
 */
const migrateReferencesToIds = (project: BesserProject): BesserProject => {
  const indices = project.currentDiagramIndices ?? defaultDiagramIndices();

  // Types that should have cross-references to ClassDiagram
  const classRefTypes: SupportedDiagramType[] = ['GUINoCodeDiagram', 'ObjectDiagram'];
  // GUI also references AgentDiagram
  const agentRefTypes: SupportedDiagramType[] = ['GUINoCodeDiagram'];

  for (const diagramType of ALL_DIAGRAM_TYPES) {
    const diagrams = project.diagrams[diagramType];
    if (!diagrams) continue;

    for (const diagram of diagrams) {
      // Convert any existing numeric references to IDs
      if (diagram.references) {
        const converted: Partial<Record<SupportedDiagramType, string>> = {};
        for (const [refType, refValue] of Object.entries(diagram.references)) {
          const targetType = refType as SupportedDiagramType;
          if (typeof refValue === 'number') {
            // Old index-based reference — resolve to ID
            const targetDiagrams = project.diagrams[targetType];
            if (!targetDiagrams || targetDiagrams.length === 0) continue;
            if (targetDiagrams && targetDiagrams.length > 0) {
              const safeIdx = Math.min(refValue, targetDiagrams.length - 1);
              converted[targetType] = targetDiagrams[safeIdx].id;
            }
          } else if (typeof refValue === 'string') {
            // Already ID-based
            converted[targetType] = refValue;
          }
        }
        diagram.references = converted;
      }

      // Populate default ClassDiagram reference if missing
      if (classRefTypes.includes(diagramType) && !diagram.references?.ClassDiagram) {
        const classDiagrams = project.diagrams.ClassDiagram;
        if (classDiagrams && classDiagrams.length > 0) {
          const classIdx = indices.ClassDiagram ?? 0;
          const safeIdx = Math.min(classIdx, classDiagrams.length - 1);
          diagram.references = { ...diagram.references, ClassDiagram: classDiagrams[safeIdx].id };
        }
      }

      // Populate default AgentDiagram reference if missing
      if (agentRefTypes.includes(diagramType) && !diagram.references?.AgentDiagram) {
        const agentDiagrams = project.diagrams.AgentDiagram;
        if (agentDiagrams && agentDiagrams.length > 0) {
          const agentIdx = indices.AgentDiagram ?? 0;
          const safeIdx = Math.min(agentIdx, agentDiagrams.length - 1);
          diagram.references = { ...diagram.references, AgentDiagram: agentDiagrams[safeIdx].id };
        }
      }
    }
  }

  project.schemaVersion = 3;
  return project;
};

export const isUMLModel = (model: unknown): model is UMLModel => {
  if (!model || typeof model !== 'object') {
    return false;
  }

  const candidate = model as Partial<UMLModel>;
  return (
    typeof candidate.type === 'string' &&
    typeof candidate.version === 'string' &&
    Array.isArray(candidate.nodes) &&
    Array.isArray(candidate.edges)
  );
};

/**
 * Detect a v3 UMLModel (pre-migration). Used by the v3→v4 migrator to know
 * whether a stored project diagram needs translation. v3 models have
 * `elements` and `relationships` records; v4 has `nodes` and `edges` arrays.
 */
export const isV3UMLModel = (model: unknown): boolean => {
  if (!model || typeof model !== 'object') return false;
  const candidate = model as Record<string, unknown>;
  return 'elements' in candidate && 'relationships' in candidate;
};

export const isGrapesJSProjectData = (model: unknown): model is GrapesJSProjectData => {
  if (!model || typeof model !== 'object') {
    return false;
  }

  const candidate = model as any;
  // Require pages array (the defining feature of GrapesJS data)
  // This avoids false positives with UMLModel which also has 'version'
  return Array.isArray(candidate.pages);
};

export const isQuantumCircuitData = (model: unknown): model is QuantumCircuitData => {
  if (!model || typeof model !== 'object') {
    return false;
  }

  const candidate = model as any;
  return Array.isArray(candidate.cols);
};


/**
 * Find perspectives that are hidden but the project still references them
 * (either by holding non-empty diagrams of that type, or via cross-diagram
 * `references` pointing at a non-empty target). Used to surface a re-enable
 * banner so users don't lose visibility on data they have.
 */
export function findHiddenReferencedPerspectives(project: BesserProject): SupportedDiagramType[] {
  const perspectives = project.settings?.perspectives;
  const hidden = new Set<SupportedDiagramType>();

  for (const type of ALL_DIAGRAM_TYPES) {
    if (isPerspectiveVisible(perspectives, type)) continue;
    const diagrams = project.diagrams[type] ?? [];
    if (diagrams.some(diagramHasContent)) {
      hidden.add(type);
    }
  }

  for (const type of ALL_DIAGRAM_TYPES) {
    const diagrams = project.diagrams[type] ?? [];
    for (const diagram of diagrams) {
      const refs = diagram.references;
      if (!refs) continue;
      for (const refType of Object.keys(refs) as SupportedDiagramType[]) {
        if (isPerspectiveVisible(perspectives, refType)) continue;
        const refId = refs[refType];
        if (!refId) continue;
        const targetDiagrams = project.diagrams[refType] ?? [];
        const target = targetDiagrams.find((d) => d.id === refId);
        if (target && diagramHasContent(target)) {
          hidden.add(refType);
        }
      }
    }
  }

  return ALL_DIAGRAM_TYPES.filter((type) => hidden.has(type));
}

/** Check whether a single diagram has meaningful content (non-empty model). */
export function diagramHasContent(diagram: ProjectDiagram): boolean {
  const model = diagram.model;
  if (!model) return false;

  if (isUMLModel(model)) {
    const hasNodes = Array.isArray(model.nodes) && model.nodes.length > 0;
    const hasEdges = Array.isArray(model.edges) && model.edges.length > 0;
    return hasNodes || hasEdges;
  }

  if (isGrapesJSProjectData(model)) {
    return model.pages.some((page: any) =>
      page?.frames?.some((frame: any) => {
        const components = frame?.component?.components;
        return Array.isArray(components) && components.length > 0;
      }),
    );
  }

  if (isQuantumCircuitData(model)) {
    return Array.isArray(model.cols) && model.cols.length > 0;
  }

  return false;
}

// Normalize any data to valid GrapesJS format
export const normalizeToGrapesJSProjectData = (data: unknown): GrapesJSProjectData => {
  const candidate = (data && typeof data === 'object') ? data as any : {};

  return {
    pages: Array.isArray(candidate.pages) ? candidate.pages : [],
    styles: Array.isArray(candidate.styles) ? candidate.styles : [],
    assets: Array.isArray(candidate.assets) ? candidate.assets : [],
    symbols: Array.isArray(candidate.symbols) ? candidate.symbols : [],
    version: typeof candidate.version === 'string' ? candidate.version : '0.21.13'
  };
};
