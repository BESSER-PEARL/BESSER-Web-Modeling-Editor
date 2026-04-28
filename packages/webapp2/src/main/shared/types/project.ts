import { UMLDiagramType, UMLModel } from '@besser/wme';
// Supported diagram types in projects
export type SupportedDiagramType = 'ClassDiagram' | 'ObjectDiagram' | 'StateMachineDiagram' | 'AgentDiagram' | 'GUINoCodeDiagram' | 'QuantumCircuitDiagram' | 'PlatformCustomizationDiagram';

export const MAX_DIAGRAMS_PER_TYPE = 5;
export const PROJECT_SCHEMA_VERSION = 4;

export const ALL_DIAGRAM_TYPES: SupportedDiagramType[] = [
  'ClassDiagram', 'ObjectDiagram', 'StateMachineDiagram', 'AgentDiagram', 'GUINoCodeDiagram', 'QuantumCircuitDiagram', 'PlatformCustomizationDiagram',
];

// Platform Customization data — overrides applied when generating a platform editor.
// v2 mirrors the BESSER `PlatformCustomization` BUML metamodel: per-class shape /
// fill / border / font, per-association line / arrows / label, plus diagram-level
// background / grid / theme. All fields optional; empty-elision happens on save.

export type NodeShape = 'rectangle' | 'rounded_rect' | 'ellipse' | 'diamond' | 'hexagon';
export type LineStyleName = 'solid' | 'dashed' | 'dotted';
export type ArrowStyleName =
  | 'none'
  | 'filled_triangle'
  | 'open_triangle'
  | 'diamond'
  | 'open_diamond'
  | 'circle';
export type FontWeightName = 'normal' | 'bold';
export type LabelPositionName = 'top' | 'bottom' | 'inside';
export type ThemeName = 'light' | 'dark' | 'auto';
export type PortSideName = 'auto' | 'top' | 'right' | 'bottom' | 'left';

/** Mutually-exclusive runtime representation for a class in the generated editor. */
export type ClassRepresentation = 'node' | 'container' | 'port' | 'connection';

/** Endpoint role of an association on the source side of a connection-class. */
export type AssociationEndpointRole = 'normal' | 'source' | 'target';

export interface PlatformClassOverride {
  isContainer?: boolean;
  /** When true, instances expose drag handles to resize the node interactively. */
  isResizable?: boolean;
  /** When true, instances of this class render as graphical Handles on the
   *  owning equipment node instead of as independent nodes. Mutually exclusive
   *  with `isContainer` and `isConnectionClass`. */
  isPort?: boolean;
  /** When true, instances of this class render as edges (connections) between
   *  two ports instead of as nodes. The class must declare exactly one source
   *  endpoint association and one target endpoint association. Mutually
   *  exclusive with `isContainer` and `isPort`. */
  isConnectionClass?: boolean;
  /** Where a port-class instance anchors on its owning equipment ('auto' falls
   *  back to the port's `direction` attribute). Only meaningful with `isPort`. */
  portSide?: PortSideName;
  /** Sides on which the default xyflow connection handles render. Undefined
   *  keeps the default (all four sides); an explicit list — possibly empty —
   *  restricts handles. ``[]`` hides handles completely. */
  connectionPoints?: Array<'top' | 'right' | 'bottom' | 'left'>;
  defaultWidth?: number;
  defaultHeight?: number;

  nodeShape?: NodeShape;
  fillColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: LineStyleName;
  borderRadius?: number;

  fontSize?: number;
  fontWeight?: FontWeightName;
  fontColor?: string;
  labelPosition?: LabelPositionName;

  // Edge-style overrides — only meaningful when the class is a connection.
  // Drives the synthetic edge rendered between two ports of this connection
  // class (or any of its subclasses, since the runtime resolves inheritance).
  edgeColor?: string;
  lineWidth?: number;
  lineStyle?: LineStyleName;
  sourceArrowStyle?: ArrowStyleName;
  targetArrowStyle?: ArrowStyleName;
  labelVisible?: boolean;
  labelFontSize?: number;
  labelFontColor?: string;
}

export interface PlatformAssociationOverride {
  edgeColor?: string;
  lineWidth?: number;
  lineStyle?: LineStyleName;
  sourceArrowStyle?: ArrowStyleName;
  targetArrowStyle?: ArrowStyleName;
  labelVisible?: boolean;
  labelFontSize?: number;
  labelFontColor?: string;
  /** When true, dropping a target instance inside a container source instance
   * auto-creates this link and visually nests the child node. */
  isContainerAssociation?: boolean;
  /** Marks this association as the source-port endpoint of a connection-class. */
  isSourceEndpoint?: boolean;
  /** Marks this association as the target-port endpoint of a connection-class. */
  isTargetEndpoint?: boolean;
}

export interface PlatformDiagramOverride {
  backgroundColor?: string;
  gridVisible?: boolean;
  gridSize?: number;
  snapToGrid?: boolean;
  theme?: ThemeName;
}

export interface PlatformCustomizationData {
  classOverrides: Record<string, PlatformClassOverride>;
  associationOverrides: Record<string, PlatformAssociationOverride>;
  diagramCustomization?: PlatformDiagramOverride;
  version?: string;
}

export const createEmptyPlatformCustomizationData = (): PlatformCustomizationData => ({
  classOverrides: {},
  associationOverrides: {},
  version: '2.0.0',
});

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
  model?: UMLModel | GrapesJSProjectData | QuantumCircuitData | PlatformCustomizationData;
  lastUpdate: string;
  description?: string;
  config?: Record<string, unknown>;  // agent LLM/platform/IC config
  /** Per-diagram cross-references: maps a diagram type to the ID of the diagram this depends on.
   *  E.g. a GUINoCodeDiagram may reference a specific ClassDiagram and AgentDiagram by their UUID. */
  references?: Partial<Record<SupportedDiagramType, string>>;
}

export type ProjectDiagramModel = UMLModel | GrapesJSProjectData | QuantumCircuitData | PlatformCustomizationData;

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
    GUINoCodeDiagram: ProjectDiagram[];
    QuantumCircuitDiagram: ProjectDiagram[];
    PlatformCustomizationDiagram: ProjectDiagram[];
  };
  settings: {
    defaultDiagramType: SupportedDiagramType;
    autoSave: boolean;
    collaborationEnabled: boolean;
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
  GUINoCodeDiagram: 0,
  QuantumCircuitDiagram: 0,
  PlatformCustomizationDiagram: 0,
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
    case 'GUINoCodeDiagram':
      return null; // GUINoCodeDiagram doesn't have a UML diagram type
    case 'QuantumCircuitDiagram':
      return null; // QuantumCircuitDiagram doesn't have a UML diagram type
    case 'PlatformCustomizationDiagram':
      return null; // PlatformCustomizationDiagram is a form-based view, not UML
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

// Default diagram factory
export const createEmptyDiagram = (
  title: string,
  type: UMLDiagramType | null,
  diagramKind?: 'gui' | 'quantum' | 'platform-customization',
): ProjectDiagram => {
  // For Platform Customization diagram (form-based, no canvas)
  if (diagramKind === 'platform-customization') {
    return {
      id: generateUUID(),
      title,
      model: createEmptyPlatformCustomizationData(),
      lastUpdate: new Date().toISOString(),
    };
  }

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

  // For UML diagrams
  return {
    id: generateUUID(),
    title,
    model: {
      version: '3.0.0' as const,
      type,
      size: { width: 1400, height: 740 },
      elements: {},
      relationships: {},
      interactive: { elements: {}, relationships: {} },
      assessments: {},
    },
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
  owner: string
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
      GUINoCodeDiagram: [createEmptyDiagram('GUI Diagram', null, 'gui')],
      QuantumCircuitDiagram: [createEmptyDiagram('Quantum Circuit', null, 'quantum')],
      PlatformCustomizationDiagram: [createEmptyDiagram('Platform Customization', null, 'platform-customization')],
    },
    settings: {
      defaultDiagramType: 'ClassDiagram',
      autoSave: true,
      collaborationEnabled: false,
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

  // Platform Customization is optional for backward compatibility — old
  // projects that predate v4 simply didn't have this tab.
  return !!hasRequiredDiagrams;
};

// Migrate/normalize a project object (called after isProject check, mutates in place)
export const ensureProjectMigrated = (obj: BesserProject): BesserProject => {
  // Add QuantumCircuitDiagram if missing
  if (!obj.diagrams.QuantumCircuitDiagram) {
    obj.diagrams.QuantumCircuitDiagram = [createEmptyDiagram('Quantum Circuit', null, 'quantum')];
  }

  // Add PlatformCustomizationDiagram if missing (introduced in schema v4)
  if (!obj.diagrams.PlatformCustomizationDiagram) {
    obj.diagrams.PlatformCustomizationDiagram = [createEmptyDiagram('Platform Customization', null, 'platform-customization')];
    if (obj.currentDiagramIndices) {
      obj.currentDiagramIndices.PlatformCustomizationDiagram = 0;
    }
  }

  // Auto-migrate v1 (single diagram per type) to v2 (array per type)
  if (!obj.schemaVersion || obj.schemaVersion < 2) {
    obj = migrateProjectToV2(obj);
  }

  // Migrate v2 → v3: convert index-based references to ID-based and populate defaults
  if (!obj.schemaVersion || obj.schemaVersion < 3) {
    obj = migrateReferencesToIds(obj);
  }

  // Migrate v3 → v4: bump schema version (Platform Customization diagram added above)
  if (!obj.schemaVersion || obj.schemaVersion < 4) {
    obj.schemaVersion = 4;
  }

  return obj;
};

/**
 * Migrate v2 → v3: convert old index-based `references` (numbers) to ID-based (strings),
 * and populate default references on diagrams that should have them.
 */
const migrateReferencesToIds = (project: BesserProject): BesserProject => {
  const indices = project.currentDiagramIndices ?? defaultDiagramIndices();

  // Types that should have cross-references to ClassDiagram
  const classRefTypes: SupportedDiagramType[] = ['GUINoCodeDiagram', 'ObjectDiagram', 'PlatformCustomizationDiagram'];
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
    typeof candidate.elements === 'object' &&
    typeof candidate.relationships === 'object'
  );
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

export const isPlatformCustomizationData = (model: unknown): model is PlatformCustomizationData => {
  if (!model || typeof model !== 'object') {
    return false;
  }
  const candidate = model as any;
  // Distinguish from UMLModel / GrapesJS / Quantum by checking for either of our buckets.
  // Both can coexist with a plain object without a 'version' / 'elements' / 'cols' / 'pages' field.
  return (
    (typeof candidate.classOverrides === 'object' && candidate.classOverrides !== null) ||
    (typeof candidate.associationOverrides === 'object' && candidate.associationOverrides !== null)
  );
};


/** Check whether a single diagram has meaningful content (non-empty model). */
export function diagramHasContent(diagram: ProjectDiagram): boolean {
  const model = diagram.model;
  if (!model) return false;

  if (isUMLModel(model)) {
    const hasElements = model.elements && Object.keys(model.elements).length > 0;
    const hasRelationships = model.relationships && Object.keys(model.relationships).length > 0;
    return !!(hasElements || hasRelationships);
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

  if (isPlatformCustomizationData(model)) {
    const classKeys = Object.keys(model.classOverrides ?? {});
    const assocKeys = Object.keys(model.associationOverrides ?? {});
    const diagramKeys = Object.keys(model.diagramCustomization ?? {});
    return classKeys.length > 0 || assocKeys.length > 0 || diagramKeys.length > 0;
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
