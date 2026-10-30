import { UMLDiagramType, UMLModel } from '@besser/wme';
import { migrateUMLModelV3ToV4, normalizeUmlModelSnapshot } from '../services/storage/migrate-uml-v3-to-v4';
import { hashLegacyV3Model, hashUmlModel } from '../utils/lineageHash';
// Supported diagram types in projects
export type SupportedDiagramType =
  | 'ClassDiagram'
  | 'ObjectDiagram'
  | 'StateMachineDiagram'
  | 'AgentDiagram'
  | 'ComponentDiagram'
  | 'DeploymentDiagram'
  | 'UserDiagram'
  | 'GUINoCodeDiagram'
  | 'QuantumCircuitDiagram'
  | 'NNDiagram'
  | 'BPMN'
  | 'KnowledgeGraphDiagram';

export const MAX_DIAGRAMS_PER_TYPE = 5;
export const PROJECT_SCHEMA_VERSION = 7;

export const ALL_DIAGRAM_TYPES: SupportedDiagramType[] = [
  'ClassDiagram',
  'ObjectDiagram',
  'StateMachineDiagram',
  'AgentDiagram',
  'UserDiagram',
  'GUINoCodeDiagram',
  'QuantumCircuitDiagram',
  'NNDiagram',
  'BPMN',
  'ComponentDiagram',
  'DeploymentDiagram',
  'KnowledgeGraphDiagram',
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

/**
 * Diagram types in the order the workspace sidebar lists them (the UML
 * editors, then GUI, Knowledge Graph and Quantum). Kept in sync with `UML_ITEMS` +
 * `NON_UML_EDITOR_ITEMS` in `app/shell/workspace-navigation.tsx` by a unit test.
 */
export const SIDEBAR_DIAGRAM_ORDER: SupportedDiagramType[] = [
  'ClassDiagram',
  'ObjectDiagram',
  'StateMachineDiagram',
  'AgentDiagram',
  'BPMN',
  'ComponentDiagram',
  'DeploymentDiagram',
  'UserDiagram',
  'NNDiagram',
  'GUINoCodeDiagram',
  'KnowledgeGraphDiagram',
  'QuantumCircuitDiagram',
];

/**
 * The diagram type a new project opens on: `preferred` when it is visible
 * (a perspective preset's entry diagram), otherwise the first visible type in
 * sidebar order — the Class diagram whenever it is shown, so a new project
 * never opens on a type hidden from the sidebar.
 */
export const resolveInitialDiagramType = (
  perspectives?: PerspectiveSettings,
  preferred?: SupportedDiagramType,
): SupportedDiagramType => {
  if (preferred && isPerspectiveVisible(perspectives, preferred)) return preferred;
  return SIDEBAR_DIAGRAM_ORDER.find((type) => isPerspectiveVisible(perspectives, type)) ?? 'ClassDiagram';
};

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

// Knowledge Graph data structure (rendered with Cytoscape.js)
export type KGNodeType =
  | 'class'
  | 'individual'
  | 'property'
  | 'literal'
  | 'blank'
  | 'nodeConstraint'
  | 'propertyConstraint';

/** A single normalised OWL2 / SHACL constraint, stored inside a NodeConstraint
 * or PropertyConstraint via `metadata.constraintSpecs`. Mirrors the backend
 * `ConstraintSpec` dataclass; `kind` is the discriminator and `value` shape
 * depends on `kind` (see `shared/kg/constraint-catalog.ts`).
 *
 * For the four SHACL logical operators (`shaclNot` / `shaclAnd` / `shaclOr` /
 * `shaclXone`), `value` is a `KGNestedShape[]` — see below. */
export interface KGConstraintSpec {
  kind: string;
  value?: unknown;
  on_class?: string;
  vocab_pref?: 'owl' | 'shacl';
}

/** One slot of a SHACL logical operator. Either a reference to another
 *  constraint node (by id) or an inline anonymous shape carrying its own
 *  list of constraint specs. The two forms are mutually exclusive. */
export type KGNestedShape =
  | { ref: string }
  | { specs: KGConstraintSpec[] };

export interface KGNodeData {
  id: string;
  nodeType: KGNodeType;
  label: string;
  iri?: string;
  value?: string;      // for literals
  datatype?: string;   // for literals
  position?: { x: number; y: number };
  /** Free-form annotations. For NodeConstraint / PropertyConstraint nodes,
   *  `metadata.constraintSpecs` carries the list of constraint specifications
   *  and `metadata.isAnonymous` flags shapes without a stable IRI. */
  metadata?: Record<string, unknown> & { constraintSpecs?: KGConstraintSpec[] };
}

export interface KGEdgeData {
  id: string;
  source: string;
  target: string;
  label?: string;
  iri?: string;
}

/** Predicate IRIs reserved for the constraint subsystem. These wire
 *  NodeConstraint / PropertyConstraint nodes to their targets and to each
 *  other; the RDF exporter knows to filter them and substitute the
 *  vocabulary-appropriate predicates. */
export const KG_CONSTRAINT_TARGET_CLASS = 'http://besser-pearl.org/kg#constraintTargetClass';
export const KG_CONSTRAINT_TARGET_PROPERTY = 'http://besser-pearl.org/kg#constraintTargetProperty';
export const KG_SH_PROPERTY = 'http://www.w3.org/ns/shacl#property';

export type KnowledgeGraphLayout = 'concentric' | 'fcose' | 'grid';

export interface KnowledgeGraphSettings {
  /** Soft limit: on import / fresh load, this many nodes are auto-shown.
   *  Users can enable more via the node list or palette drop (up to the
   *  hard limit). Undefined means "use the default (50)". */
  softLimit?: number;
  /** Hard limit: a node cannot be made visible if it would push the
   *  visible count past this. Undefined means "use the default (100)". */
  hardLimit?: number;
  /** Layout algorithm for the initial / after-layout-change arrangement.
   *  Once run, positions are persisted in `nodes[i].position` and the
   *  layout does not rerun unless the user picks a different one here. */
  layout?: KnowledgeGraphLayout;
  /** The exact set of node ids currently visualized on the canvas. Persisted
   *  so the selection survives navigating away and back to the editor.
   *  Fresh imports (no value here) fall back to the soft-limit seed. */
  visibleIds?: string[];
  /** Show the declaration nodes — the owl / rdf / rdfs terms (`owl:Class`,
   *  `rdf:Property`, `rdfs:Class`, …) plus `sh:NodeShape` and
   *  `sh:PropertyShape` — on the canvas and in the node list. Off by default:
   *  those nodes are implied by the node kind they annotate (a class node is
   *  always `rdf:type owl:Class`), so they only add clutter. `xsd:` datatypes
   *  and the remaining `sh:` terms are not covered — they carry a property's
   *  declared range and its constraint values, and stay visible either way.
   *  Hidden nodes are never removed from the model; the transformation
   *  pipelines (RDF export, KG → UML) still see them. Undefined means "use
   *  the default (false)". */
  showMetaVocabNodes?: boolean;
}

/** An OWL axiom relating several nodes (equivalent classes, sub-property, ...).
 *  The frontend does not interpret it: it only carries it, because the backend
 *  needs it back - see `shared/kg/axioms.ts`. `kind` names the backend's axiom
 *  class; the other fields are node ids or IRIs. */
export interface KGAxiom {
  kind: string;
  [field: string]: unknown;
}

export interface KnowledgeGraphData {
  type?: 'KnowledgeGraphDiagram';
  version: string;
  nodes: KGNodeData[];
  edges: KGEdgeData[];
  /** Set by the OWL importer; carried untouched, trimmed on deletion, renamed on merge. */
  axioms?: KGAxiom[];
  settings?: KnowledgeGraphSettings;
}

/** A single inconsistency surfaced by the OWL/SHACL consistency check.
 *  Mirrors `besser.BUML.notations.kg_to_buml.consistency.ConsistencyIssue`. */
export interface ConsistencyIssue {
  id: string;
  code: string;
  severity: 'info' | 'warning' | 'violation';
  message: string;
  affectedNodeIds: string[];
  affectedEdgeIds: string[];
  constraintNodeId: string | null;
  specKind: string | null;
  pathIri: string | null;
  /** Short human-readable summary of the violated constraint, e.g.
   *  "hasPrincipalInvestigator: exactly 1 of SeniorResearcher". */
  constraintLabel: string | null;
}

export interface ConsistencyReport {
  issues: ConsistencyIssue[];
  issueCount: number;
  severityCounts: Record<'info' | 'warning' | 'violation', number>;
  kgSignature: string;
  inferenceUsed: 'rdfs' | 'owlrl';
  exportedAt?: string;
  version?: string;
}

export const DEFAULT_KG_SOFT_LIMIT = 50;
export const DEFAULT_KG_HARD_LIMIT = 100;
export const DEFAULT_KG_LAYOUT: KnowledgeGraphLayout = 'concentric';
export const DEFAULT_KG_SHOW_META_VOCAB = false;

export function getKgSoftLimit(settings?: KnowledgeGraphSettings): number {
  return settings?.softLimit ?? DEFAULT_KG_SOFT_LIMIT;
}

export function getKgHardLimit(settings?: KnowledgeGraphSettings): number {
  return settings?.hardLimit ?? DEFAULT_KG_HARD_LIMIT;
}

export function getKgShowMetaVocab(settings?: KnowledgeGraphSettings): boolean {
  return settings?.showMetaVocabNodes ?? DEFAULT_KG_SHOW_META_VOCAB;
}

export function getKgLayout(settings?: KnowledgeGraphSettings): KnowledgeGraphLayout {
  const l = settings?.layout;
  if (l === 'concentric' || l === 'fcose' || l === 'grid') return l;
  return DEFAULT_KG_LAYOUT;
}

/**
 * Diagram-level lineage recorded by the inter-diagram
 * derivations (BPMN→Component, Component→Deployment). Sidecar shape
 * without requiring editor-package storage changes.
 */
export interface DiagramLineage {
  /** id of the source ProjectDiagram (same project). */
  sourceDiagramId: string;
  /** which diagram type the source is, so the UI doesn't have to look it up. */
  sourceDiagramType: SupportedDiagramType;
  /** which transform produced this diagram. */
  derivationKind: 'bpmn-to-component' | 'component-to-deployment' | 'bpmn-to-agent';
  /** ISO timestamp at derivation time. */
  derivedAt: string;
  /** djb2 hash of the source UMLModel at derivation time. */
  sourceModelHash: string;
}

// Diagram structure within a project
export interface ProjectDiagram {
  id: string;
  title: string;
  model?: UMLModel | GrapesJSProjectData | QuantumCircuitData | KnowledgeGraphData;
  lastUpdate: string;
  description?: string;
  config?: Record<string, unknown>;  // agent LLM/platform/IC config
  configYaml?: string;  // generated agent config.yaml (derived from agentConfigForm + agentConfigCustomYaml)
  agentConfigForm?: Record<string, unknown>;  // structured form state for the yaml editor
  agentConfigCustomYaml?: string;  // extra YAML appended at the end of config.yaml
  /** Per-diagram cross-references: maps a diagram type to the ID of the diagram this depends on.
   *  E.g. a GUINoCodeDiagram may reference a specific ClassDiagram and AgentDiagram by their UUID. */
  references?: Partial<Record<SupportedDiagramType, string>>;
  /** Set by inter-diagram derivation hooks. Undefined on
   *  user-imported diagrams and on the source side of any derivation. */
  derivedFrom?: DiagramLineage;
}

/**
 * Per-derived-diagram element mapping: derived element id →
 * source element id. The source diagram is implied by the containing
 * `ProjectDiagram.derivedFrom.sourceDiagramId`. Sidecar on
 * `BesserProject` without requiring editor-package storage changes.
 */
export type ElementLineageMap = Record<string, string>;

export type ProjectDiagramModel = UMLModel | GrapesJSProjectData | QuantumCircuitData | KnowledgeGraphData;

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
    ComponentDiagram: ProjectDiagram[];
    DeploymentDiagram: ProjectDiagram[];
    UserDiagram: ProjectDiagram[];
    GUINoCodeDiagram: ProjectDiagram[];
    KnowledgeGraphDiagram: ProjectDiagram[];
    QuantumCircuitDiagram: ProjectDiagram[];
    NNDiagram: ProjectDiagram[];
    BPMN: ProjectDiagram[];
  };
  settings: {
    defaultDiagramType: SupportedDiagramType;
    autoSave: boolean;
    collaborationEnabled: boolean;
    perspectives: PerspectiveSettings;
    /**
     * Workspace the user picked on the first-run landing: `'model'` (low-code
     * canvas) or `'agent'` (agentic assistant). Optional and purely additive —
     * projects created before this field load unchanged, so no schema bump.
     */
    preferredInterface?: InterfaceMode;
  };
  /** derivedDiagramId → ElementLineageMap. Sidecar; populated
   *  by the inter-diagram derivation hooks after the derived diagram
   *  is added. Survives import/export. */
  elementLineage?: Record<string, ElementLineageMap>;
}

/** The two ways into the editor, chosen on the first-run landing. */
export type InterfaceMode = 'model' | 'agent';

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
    const found = diagrams.find((d) => d.id === refId);
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
  ComponentDiagram: 0,
  DeploymentDiagram: 0,
  UserDiagram: 0,
  GUINoCodeDiagram: 0,
  KnowledgeGraphDiagram: 0,
  QuantumCircuitDiagram: 0,
  NNDiagram: 0,
  BPMN: 0,
});

/** What an empty diagram of a type is built from. Types not listed here are
 *  Apollon (UML-family) diagrams. Every place that creates an empty diagram for
 *  a type MUST go through this map: a type that is missing from a private copy
 *  silently gets a GrapesJS model. */
export type DiagramKind = 'gui' | 'quantum' | 'kg';
export const DIAGRAM_KIND_BY_TYPE: Partial<Record<SupportedDiagramType, DiagramKind>> = {
  GUINoCodeDiagram: 'gui',
  QuantumCircuitDiagram: 'quantum',
  KnowledgeGraphDiagram: 'kg',
};

/** True for a diagram type with an editor of its own (GrapesJS, the quantum
 *  canvas, Cytoscape), false for an Apollon (UML-family) one or no type. */
export const hasCustomEditor = (type: string | null | undefined): boolean =>
  !!type && !!DIAGRAM_KIND_BY_TYPE[type as SupportedDiagramType];

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
      migrated.diagrams[type] = [createEmptyDiagram(type.replace('Diagram', ' Diagram'), umlType, DIAGRAM_KIND_BY_TYPE[type])];
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
    case UMLDiagramType.ComponentDiagram:
      return 'ComponentDiagram';
    case UMLDiagramType.DeploymentDiagram:
      return 'DeploymentDiagram';
    case UMLDiagramType.NNDiagram:
      return 'NNDiagram';
    case UMLDiagramType.UserDiagram:
      return 'UserDiagram';
    case UMLDiagramType.BPMN:
      return 'BPMN';
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
    case 'ComponentDiagram':
      return UMLDiagramType.ComponentDiagram;
    case 'DeploymentDiagram':
      return UMLDiagramType.DeploymentDiagram;
    case 'NNDiagram':
      return UMLDiagramType.NNDiagram;
    case 'UserDiagram':
      return UMLDiagramType.UserDiagram;
    case 'BPMN':
      return UMLDiagramType.BPMN;
    case 'GUINoCodeDiagram':
      return null; // GUINoCodeDiagram doesn't have a UML diagram type
    case 'QuantumCircuitDiagram':
      return null; // QuantumCircuitDiagram doesn't have a UML diagram type
    case 'KnowledgeGraphDiagram':
      return null; // KnowledgeGraphDiagram doesn't have a UML diagram type
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

// The 4 meta-model classes of the retired UserDiagram seed template. Stored
// projects can still carry that untouched template (see isUserDiagramSeedOnly).
const DEFAULT_USER_META_CLASSES = [
  'Personal_Information',
  'Skill',
  'Education',
  'Disability',
] as const;

// Default diagram factory
export const createEmptyDiagram = (
  title: string,
  type: UMLDiagramType | null,
  diagramKind?: DiagramKind,
): ProjectDiagram => {
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
        version: '1.0.0',
      } as QuantumCircuitData,
      lastUpdate: new Date().toISOString(),
    };
  }

  // For Knowledge Graph diagram (Cytoscape-backed)
  if (diagramKind === 'kg') {
    return {
      id: generateUUID(),
      title,
      model: {
        type: 'KnowledgeGraphDiagram',
        version: '1.0.0',
        nodes: [],
        edges: [],
      } as KnowledgeGraphData,
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
                    'background-size',
                  ],
                  components: [],
                  head: { type: 'head' },
                  docEl: { tagName: 'html' },
                },
              },
            ],
          },
        ],
        styles: [],
        assets: [],
        symbols: [],
        version: '0.21.13',
      } as GrapesJSProjectData,
      lastUpdate: new Date().toISOString(),
    };
  }

  // For UML diagrams (v4 shape). Every new diagram starts blank, as in develop:
  // a seeded UserDiagram template was exported as empty objects once edited.
  return {
    id: generateUUID(),
    title,
    model: {
      version: '4.0.0' as const,
      id: generateUUID(),
      title,
      type,
      nodes: [],
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
                'background-size',
              ],
              components: [],
              head: { type: 'head' },
              docEl: { tagName: 'html' },
            },
          },
        ],
      },
    ],
    styles: [],
    assets: [],
    symbols: [],
    version: '0.21.13',
  };
};

// Default project factory
export const createDefaultProject = (
  name: string,
  description: string,
  owner: string,
  perspectives?: PerspectiveSettings,
  preferredInterface?: InterfaceMode,
  initialDiagramType?: SupportedDiagramType,
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
    currentDiagramType: resolveInitialDiagramType(perspectives, initialDiagramType),
    currentDiagramIndices: defaultDiagramIndices(),
    diagrams: {
      ClassDiagram: [createEmptyDiagram('Class Diagram', UMLDiagramType.ClassDiagram)],
      ObjectDiagram: [createEmptyDiagram('Object Diagram', UMLDiagramType.ObjectDiagram)],
      StateMachineDiagram: [createEmptyDiagram('State Machine Diagram', UMLDiagramType.StateMachineDiagram)],
      AgentDiagram: [createEmptyDiagram('Agent Diagram', UMLDiagramType.AgentDiagram)],
      ComponentDiagram: [createEmptyDiagram('Component Diagram', UMLDiagramType.ComponentDiagram)],
      DeploymentDiagram: [createEmptyDiagram('Deployment Diagram', UMLDiagramType.DeploymentDiagram)],
      UserDiagram: [createEmptyDiagram('User Diagram', UMLDiagramType.UserDiagram)],
      GUINoCodeDiagram: [createEmptyDiagram('GUI Diagram', null, 'gui')],
      KnowledgeGraphDiagram: [createEmptyDiagram('Knowledge Graph', null, 'kg')],
      QuantumCircuitDiagram: [createEmptyDiagram('Quantum Circuit', null, 'quantum')],
      NNDiagram: [createEmptyDiagram('NN Diagram', UMLDiagramType.NNDiagram)],
      BPMN: [createEmptyDiagram('BPMN Diagram', UMLDiagramType.BPMN)],
    },
    settings: {
      defaultDiagramType: 'ClassDiagram',
      autoSave: true,
      collaborationEnabled: false,
      perspectives: perspectives ?? createDefaultPerspectives(),
      ...(preferredInterface ? { preferredInterface } : {}),
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

  // KnowledgeGraphDiagram, NNDiagram and UserDiagram are back-filled by
  // ensureProjectMigrated when missing, so they are not required here.
  const hasRequiredDiagrams =
    obj.diagrams.ClassDiagram &&
    obj.diagrams.ObjectDiagram &&
    obj.diagrams.StateMachineDiagram &&
    obj.diagrams.AgentDiagram &&
    obj.diagrams.GUINoCodeDiagram &&
    obj.diagrams.QuantumCircuitDiagram &&
    obj.diagrams.BPMN;

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

  // Add BPMN diagram if missing
  if (!obj.diagrams.BPMN) {
    obj.diagrams.BPMN = [createEmptyDiagram('BPMN Diagram', UMLDiagramType.BPMN)];
  }

  // Ensure index entry exists for UserDiagram
  if (obj.currentDiagramIndices.UserDiagram === undefined) {
    obj.currentDiagramIndices.UserDiagram = 0;
  }

  // Ensure index entry exists for BPMN
  if (obj.currentDiagramIndices.BPMN === undefined) {
    obj.currentDiagramIndices.BPMN = 0;
  }

  // Back-compat: pre-`BPMNDiagram` BPMN diagrams stored `model.type === 'BPMN'`.
  // Normalize to the new wire value so the diagram round-trips against the
  // BESSER backend's `"<Name>Diagram"` convention. This is load-bearing even
  // with the versionConverter.ts fix: it also catches diagrams already in v4
  // shape (created by an earlier migration build before DiagramType.ts was
  // fixed) whose `isV3UMLModel` check is false and thus never pass through
  // `convertV3ToV4`.
  for (const diagram of obj.diagrams.BPMN ?? []) {
    const model = diagram.model as { type?: string } | undefined;
    if (model && model.type === 'BPMN') {
      model.type = UMLDiagramType.BPMN;
    }
  }

  // Add KnowledgeGraphDiagram if missing
  if (!obj.diagrams.KnowledgeGraphDiagram) {
    obj.diagrams.KnowledgeGraphDiagram = [createEmptyDiagram('Knowledge Graph', null, 'kg')];
  }

  // Back-fill missing entry in currentDiagramIndices
  if (obj.currentDiagramIndices && (obj.currentDiagramIndices as any).KnowledgeGraphDiagram == null) {
    obj.currentDiagramIndices = { ...obj.currentDiagramIndices, KnowledgeGraphDiagram: 0 };
  }
  // Add ComponentDiagram / DeploymentDiagram if missing
  if (!obj.diagrams.ComponentDiagram) {
    obj.diagrams.ComponentDiagram = [createEmptyDiagram('Component Diagram', UMLDiagramType.ComponentDiagram)];
  }
  if (!obj.diagrams.DeploymentDiagram) {
    obj.diagrams.DeploymentDiagram = [createEmptyDiagram('Deployment Diagram', UMLDiagramType.DeploymentDiagram)];
  }
  if (obj.currentDiagramIndices.ComponentDiagram === undefined) {
    obj.currentDiagramIndices.ComponentDiagram = 0;
  }
  if (obj.currentDiagramIndices.DeploymentDiagram === undefined) {
    obj.currentDiagramIndices.DeploymentDiagram = 0;
  }

  // Read before the v4 migration below creates a perspectives map.
  // Schema 5 had two meanings (v4 model lift / Component-Deployment perspectives);
  // only the latter writes these perspective keys.
  const hadComponentDeploymentKeys =
    obj.settings?.perspectives?.ComponentDiagram !== undefined ||
    obj.settings?.perspectives?.DeploymentDiagram !== undefined;
  const hadPerspectives = !!obj.settings?.perspectives;
  const hideComponentDeployment =
    hadPerspectives && ((obj.schemaVersion ?? 0) < 5 || !hadComponentDeploymentKeys);

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

  // Migrate v4 → v5: convert v3-shape UML models (elements/relationships) to v4 (nodes/edges).
  // Un-gated: the per-diagram lift keys off each model's own shape/version,
  // not the envelope's schemaVersion — a project stamped >= 5 can still
  // carry v3 models (hand-edited exports, templates, a partial earlier
  // migration). Cheap and idempotent on canonical v4 data.
  obj = migrateProjectToV5(obj);

  // Retrofit v3 personalized-variant snapshots. `migrateProjectToV5` walks
  // only each diagram's `model`, never `config.personalizedVariants[].model`
  // — and the shipped gym-agent template stamps `schemaVersion: 5` while
  // carrying v3 variant snapshots, so a gated migration would never see
  // them. `readAgentVariants` filters via the v4 `isUMLModel`, silently
  // dropping v3 snapshots from the variant dropdown. Un-gated: idempotent
  // and cheap on canonical v4 data.
  retrofitAgentVariantSnapshots(obj);

  // Migrate v5 → v6: Component and Deployment diagrams became project types
  if (!obj.schemaVersion || obj.schemaVersion < 6) {
    obj = migrateComponentDeploymentPerspectives(obj, hideComponentDeployment);
  }

  // Migrate v6 → v7: the Knowledge Graph diagram became a project type.
  // Schema 6 also has two meanings: the KG build stamped this step 6, the React
  // Flow build Component/Deployment. Both KG steps only act on what is missing,
  // so they run on every project below 7.
  if (!obj.schemaVersion || obj.schemaVersion < 7) {
    obj = migrateKnowledgeGraphSoftLimit(obj);
    obj = migrateKnowledgeGraphPerspective(obj, hadPerspectives);
  }

  return obj;
};

/**
 * Walk every AgentDiagram's inline `config.personalizedVariants` and lift any
 * v3 variant snapshot to the canonical v4 shape. Mutates in place; returns
 * nothing. Best-effort: a failed lift must never block the project load — the
 * v3 snapshot stays in place (and stays invisible to the variant dropdown,
 * exactly as before).
 */
const retrofitAgentVariantSnapshots = (project: BesserProject): void => {
  const agentDiagrams = project.diagrams?.AgentDiagram ?? [];
  for (const d of agentDiagrams) {
    const config = d?.config as Record<string, unknown> | undefined;
    const variants = config?.personalizedVariants;
    if (!Array.isArray(variants)) continue;
    for (const variant of variants) {
      if (!variant || typeof variant !== 'object') continue;
      const candidate = variant as { model?: unknown };
      if (candidate.model && isV3UMLModel(candidate.model)) {
        try {
          candidate.model = normalizeUmlModelSnapshot(candidate.model);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[retrofitAgentVariantSnapshots] lift failed', d.id, err);
        }
      }
    }
  }
};

/**
 * Migrate v4 → v5: walk every per-diagram UML model and run the v3 → v4
 * shape migrator from `@besser/wme`. GUI, quantum and Knowledge Graph diagrams
 * are skipped because their models are not UMLModels.
 *
 * A diagram that throws keeps its v3 model, and the next page load retries it:
 * the lift is decided per model, not by `schemaVersion`. Within a page load a
 * failed diagram (same id and lastUpdate) is not retried, since loadProject
 * runs on most renders. The 5 stamp below does
 * not gate that retry (`ensureProjectMigrated` stamps 7 regardless). The
 * editor opens a v3 diagram read-only and `updateDiagramModelThunk` refuses to
 * overwrite it. Failures and skipped malformed entries are logged with the
 * diagram title.
 *
 * Derived diagrams that were in sync with a lifted source are restamped with
 * the source's v4 hash, so the lift itself does not read as "source changed".
 */
/** `${id}@${lastUpdate}` of diagrams whose lift failed in this page load. */
const failedV3Lifts = new Set<string>();

export const migrateProjectToV5 = (project: BesserProject): BesserProject => {
  // No early return on `schemaVersion >= 5`: whether a diagram needs the
  // lift is decided per model (`isV3UMLModel` — `version` "3.x" or an
  // `elements` table without a `nodes` array), so a project stamped 5+
  // that still holds v3 models gets repaired too.
  let allSucceeded = true;
  // Lifted diagram id -> the hash the v3 editor computed over its v3 model.
  const legacyHashes = new Map<string, string>();

  for (const type of ALL_DIAGRAM_TYPES) {
    if (hasCustomEditor(type)) continue;
    const diagrams = project.diagrams[type] ?? [];
    for (const d of diagrams) {
      if (d.model && isV3UMLModel(d.model)) {
        const liftKey = `${d.id}@${d.lastUpdate}`;
        if (failedV3Lifts.has(liftKey)) {
          allSucceeded = false;
          continue;
        }
        const warnings: string[] = [];
        try {
          const legacyHash = hashLegacyV3Model(d.model);
          d.model = migrateUMLModelV3ToV4(d.model, type, warnings);
          legacyHashes.set(d.id, legacyHash);
        } catch (err) {
          // Keep v3 model in place on failure.
          allSucceeded = false;
          failedV3Lifts.add(liftKey);
          // eslint-disable-next-line no-console
          console.warn(
            `[migrateProjectToV5] Failed to migrate diagram "${d.title}" (${type}, id=${d.id}); it stays v3 (read-only) and the next page load retries.`,
            err,
          );
        }
        if (warnings.length > 0) {
          // eslint-disable-next-line no-console
          console.warn(`[migrateProjectToV5] Diagram "${d.title}" (${type}, id=${d.id}) migrated with:`, warnings);
        }
      }
    }
  }

  if (legacyHashes.size > 0) restampLiftedLineage(project, legacyHashes);

  if (allSucceeded && !(project.schemaVersion >= 5)) {
    project.schemaVersion = 5;
  }
  return project;
};

const restampLiftedLineage = (project: BesserProject, legacyHashes: Map<string, string>): void => {
  const all = ALL_DIAGRAM_TYPES.flatMap((type) => project.diagrams[type] ?? []);
  const byId = new Map(all.map((d) => [d.id, d]));
  for (const d of all) {
    const lineage = d.derivedFrom;
    const source = lineage && byId.get(lineage.sourceDiagramId);
    if (!lineage || !source || lineage.sourceModelHash !== legacyHashes.get(source.id)) continue;
    d.derivedFrom = { ...lineage, sourceModelHash: hashUmlModel(source.model as UMLModel) };
  }
};

/**
 * Migrate v5 → v6: ComponentDiagram and DeploymentDiagram became project
 * diagram types. A project whose user already chose perspectives keeps its
 * sidebar unchanged, so both new types start hidden there; they can be enabled
 * in Project Settings (e.g. with the Multi-Agent preset).
 */
const migrateComponentDeploymentPerspectives = (project: BesserProject, hide: boolean): BesserProject => {
  if (hide && project.settings.perspectives) {
    project.settings.perspectives = {
      ...project.settings.perspectives,
      ComponentDiagram: false,
      DeploymentDiagram: false,
    };
  }
  project.schemaVersion = 6;
  return project;
};

/**
 * Part of v6 → v7: Knowledge Graph diagrams saved by the editor's first
 * settings revision keep their soft limit in `maxVisibleNodes`; it becomes
 * `softLimit` (an explicit `softLimit` wins) and the old field is dropped.
 */
const migrateKnowledgeGraphSoftLimit = (project: BesserProject): BesserProject => {
  for (const diagram of project.diagrams.KnowledgeGraphDiagram ?? []) {
    const model = diagram.model as { settings?: Record<string, unknown> } | undefined;
    if (!model?.settings || !('maxVisibleNodes' in model.settings)) continue;
    const { maxVisibleNodes, ...settings } = model.settings;
    if (settings.softLimit == null && typeof maxVisibleNodes === 'number') settings.softLimit = maxVisibleNodes;
    model.settings = settings;
  }
  return project;
};

/**
 * Migrate v6 → v7: KnowledgeGraphDiagram became a project diagram type. As for
 * the v5 → v6 step, a project whose user already chose perspectives keeps its
 * sidebar unchanged, so the new type starts hidden there; it can be enabled in
 * Project Settings (e.g. with the Knowledge Engineer preset). A missing key
 * would otherwise read as visible (`isPerspectiveVisible`).
 */
const migrateKnowledgeGraphPerspective = (project: BesserProject, hadPerspectives: boolean): BesserProject => {
  // An explicit choice (a project saved while the KG editor was still a branch) is kept.
  if (hadPerspectives && project.settings.perspectives && project.settings.perspectives.KnowledgeGraphDiagram === undefined) {
    project.settings.perspectives = {
      ...project.settings.perspectives,
      KnowledgeGraphDiagram: false,
    };
  }
  project.schemaVersion = 7;
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

/**
 * Keys a seeded UserDiagram attribute row may carry. Anything else (e.g. a
 * user-entered `attributeValue`) means the template has been edited.
 */
const USER_SEED_ATTRIBUTE_KEYS = new Set(['id', 'name', 'attributeType', 'attributeId', 'attributeOperator']);

/**
 * True when a UserDiagram model contains only the pristine seed template
 * produced by `buildUserDiagramSeedNodes`: no edges, and every node is a
 * `UserModelName` card for one of the default meta-model classes (each at
 * most once) whose attribute rows carry no user-entered values. Positions
 * and generated ids are ignored — moving a card around is not content.
 */
export const isUserDiagramSeedOnly = (model: UMLModel): boolean => {
  if (Array.isArray(model.edges) && model.edges.length > 0) return false;
  const nodes = Array.isArray(model.nodes) ? model.nodes : [];
  if (nodes.length === 0) return true;
  const seen = new Set<string>();
  for (const node of nodes as any[]) {
    if (node?.type !== 'UserModelName') return false;
    const data = node?.data ?? {};
    const name = data.className ?? data.name;
    if (!DEFAULT_USER_META_CLASSES.includes(name) || seen.has(name)) return false;
    seen.add(name);
    const attrs = Array.isArray(data.attributes) ? data.attributes : [];
    for (const attr of attrs) {
      if (!attr || typeof attr !== 'object') return false;
      if (Object.keys(attr).some((key) => !USER_SEED_ATTRIBUTE_KEYS.has(key))) return false;
      if (attr.attributeOperator !== undefined && attr.attributeOperator !== '==') return false;
    }
  }
  return true;
};

const UML_DIAGRAM_TYPES: ReadonlySet<string> = new Set(Object.values(UMLDiagramType));

export const isUMLModel = (model: unknown): model is UMLModel => {
  if (!model || typeof model !== 'object') {
    return false;
  }

  const candidate = model as Partial<UMLModel>;
  // The `type` decides: a Knowledge Graph model has `nodes`/`edges` arrays too.
  return (
    typeof candidate.type === 'string' &&
    UML_DIAGRAM_TYPES.has(candidate.type) &&
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
  // A model that already has a v4 `nodes` array is never re-lifted.
  if (Array.isArray(candidate.nodes)) return false;
  const elements = candidate.elements;
  if (!elements || typeof elements !== 'object') return false;
  // v3 shape: an `elements` id→element table (with or without
  // `relationships`), or any `elements` holder that declares itself 3.x.
  // (v2 used `elements` *arrays* and is not handled here.)
  const version = candidate.version;
  return !Array.isArray(elements) || (typeof version === 'string' && version.startsWith('3.'));
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

export const isKnowledgeGraphData = (model: unknown): model is KnowledgeGraphData => {
  if (!model || typeof model !== 'object') {
    return false;
  }
  const candidate = model as Partial<KnowledgeGraphData>;
  // `type` is optional on a KG model; a v4 UML model always has a UML one.
  return (
    (candidate.type === undefined || candidate.type === 'KnowledgeGraphDiagram') &&
    Array.isArray(candidate.nodes) &&
    Array.isArray(candidate.edges)
  );
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

  // An unmigrated v3 model (kept read-only) is content: exports must keep it.
  if (isV3UMLModel(model)) {
    const { elements, relationships } = model as { elements?: unknown; relationships?: unknown };
    const size = (table: unknown) => (table && typeof table === 'object' ? Object.keys(table).length : 0);
    return size(elements) > 0 || size(relationships) > 0;
  }

  if (isUMLModel(model)) {
    const hasNodes = Array.isArray(model.nodes) && model.nodes.length > 0;
    const hasEdges = Array.isArray(model.edges) && model.edges.length > 0;
    // Agent resources (Skills, Tools, LLMs, RAGs, SQL databases) live outside the canvas.
    const components = (model as { components?: Record<string, unknown> }).components;
    const hasAgentComponents = model.type === UMLDiagramType.AgentDiagram &&
      !!components && Object.keys(components).length > 0;
    const sqlDatabases = (diagram.agentConfigForm as { db?: { sqlDatabases?: unknown } } | undefined)?.db?.sqlDatabases;
    const hasSqlDatabases = model.type === UMLDiagramType.AgentDiagram &&
      Array.isArray(sqlDatabases) && sqlDatabases.length > 0;
    if (hasAgentComponents || hasSqlDatabases) return true;
    if (!hasNodes && !hasEdges) return false;
    // A UserDiagram still carrying nothing but the untouched meta-model seed
    // template (`createEmptyDiagram`) has no user content, so treating it as
    // empty keeps exports and backend payloads free of template noise.
    if (model.type === UMLDiagramType.UserDiagram && isUserDiagramSeedOnly(model)) return false;
    return true;
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

  if (isKnowledgeGraphData(model)) {
    return model.nodes.length > 0 || model.edges.length > 0;
  }

  return false;
}

// Normalize any data to valid GrapesJS format
export const normalizeToGrapesJSProjectData = (data: unknown): GrapesJSProjectData => {
  const candidate = data && typeof data === 'object' ? (data as any) : {};

  return {
    pages: Array.isArray(candidate.pages) ? candidate.pages : [],
    styles: Array.isArray(candidate.styles) ? candidate.styles : [],
    assets: Array.isArray(candidate.assets) ? candidate.assets : [],
    symbols: Array.isArray(candidate.symbols) ? candidate.symbols : [],
    version: typeof candidate.version === 'string' ? candidate.version : '0.21.13',
  };
};
