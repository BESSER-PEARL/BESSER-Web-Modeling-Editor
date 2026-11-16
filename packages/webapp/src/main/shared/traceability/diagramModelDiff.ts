import type { SupportedDiagramType } from '../types/project';
import { snapshotClassModel } from './classModelDiff';
import type { ClassModelLike } from './classModelDiff';
import { diffSnapshots, value } from './modelDiff';
import type { ElementChange, FeatureValue, Snapshot } from './modelDiff';

/**
 * What changed between two versions of a diagram of any type, element by element (compared in `modelDiff.ts`).
 *
 * - A class diagram has its own, richer builder (`classModelDiff.ts`), and a GUI its own (`guiModelDiff.ts`,
 *   recorded with its bindings by `recordGuiDiagramUpdate`).
 * - Every other Apollon diagram (object, user, state machine, agent, BPMN, neural network, component,
 *   deployment) goes through ONE generic builder, {@link snapshotApollonModel}, steered by a small table per
 *   diagram type ({@link APOLLON_TABLES}): which editor element types reach the B-UML model, under which B-UML
 *   metaclass (the names of `besser/BUML/metamodel/*`, as the backend's trace uses them), and which members are
 *   folded into their owner. An element type the table does not name (an icon, a section title, a colour legend)
 *   is layout, and not traced. An element's features are its own scalar fields, minus the layout ones.
 * - A quantum circuit (`QuantumCircuitData`) and a knowledge graph (`KnowledgeGraphData`) are not Apollon models:
 *   each has a small builder of its own.
 */

/** The B-UML model class a diagram of each type is: the type of the diagram's own artifact in the trace. */
export const DIAGRAM_MODEL_TYPES: Record<SupportedDiagramType, string> = {
  ClassDiagram: 'DomainModel',
  ObjectDiagram: 'ObjectModel',
  UserDiagram: 'ObjectModel',
  StateMachineDiagram: 'StateMachine',
  AgentDiagram: 'Agent',
  GUINoCodeDiagram: 'GUIModel',
  QuantumCircuitDiagram: 'QuantumCircuit',
  NNDiagram: 'NN',
  BPMN: 'BPMNModel',
  ComponentDiagram: 'ComponentModel',
  DeploymentDiagram: 'DeploymentModel',
  KnowledgeGraphDiagram: 'KnowledgeGraph',
};

/* ------------------------------------------------------------------ Apollon models */

/** How an editor element type reaches the B-UML model. */
interface ElementRule {
  /** Its B-UML metaclass. */
  metaclass: string;
  /**
   * A member that is part of its owner rather than an element of its own:
   * - `list`: its name is one entry of the owner's feature `feature` (an intent's training sentences);
   * - `named`: it is the owner's feature named by its `attributeName`, valued by its `value` (a layer's
   *   `kernel_dim = 3`).
   */
  fold?: { mode: 'list'; feature: string } | { mode: 'named' };
}

interface ApollonTable {
  elements: Record<string, ElementRule>;
  /** Relationship type -> metaclass; a function when it depends on the relationship (a BPMN flow's kind). */
  relationships: Record<string, string | ((relationship: ApollonRelationship) => string)>;
}

const STATE_ELEMENTS: Record<string, ElementRule> = {
  State: { metaclass: 'State' },
  StateBody: { metaclass: 'Body' },
  StateFallbackBody: { metaclass: 'Body' },
  StateInitialNode: { metaclass: 'State' },
  StateFinalNode: { metaclass: 'State' },
  StateForkNode: { metaclass: 'State' },
  StateForkNodeHorizontal: { metaclass: 'State' },
  StateMergeNode: { metaclass: 'State' },
  StateActionNode: { metaclass: 'Action' },
  StateObjectNode: { metaclass: 'State' },
  StateCodeBlock: { metaclass: 'Body' },
};

const BPMN_FLOW_METACLASSES: Record<string, string> = {
  sequence: 'SequenceFlow',
  message: 'MessageFlow',
  association: 'Association',
  data: 'DataAssociation',
  'data-association': 'DataAssociation',
};

/** NN layer and section element types -> metaclass (`besser/BUML/metamodel/nn/neural_network.py`). */
const NN_ELEMENTS: Record<string, string> = {
  LinearLayer: 'LinearLayer',
  FlattenLayer: 'FlattenLayer',
  EmbeddingLayer: 'EmbeddingLayer',
  DropoutLayer: 'DropoutLayer',
  LayerNormalizationLayer: 'LayerNormLayer',
  BatchNormalizationLayer: 'BatchNormLayer',
  RNNLayer: 'SimpleRNNLayer',
  LSTMLayer: 'LSTMLayer',
  GRULayer: 'GRULayer',
  PoolingLayer: 'PoolingLayer',
  Conv1DLayer: 'Conv1D',
  Conv2DLayer: 'Conv2D',
  Conv3DLayer: 'Conv3D',
  TensorOp: 'TensorOp',
  Configuration: 'Configuration',
  TrainingDataset: 'Dataset',
  TestDataset: 'Dataset',
  NNContainer: 'NN',
  NNReference: 'NN',
};

/** The per-type tables of the generic Apollon builder. The class diagram has its own builder. */
export const APOLLON_TABLES: Partial<Record<SupportedDiagramType, ApollonTable>> = {
  ObjectDiagram: {
    elements: {
      ObjectName: { metaclass: 'Object' },
      ObjectAttribute: { metaclass: 'AttributeLink' },
    },
    relationships: { ObjectLink: 'Link' },
  },
  UserDiagram: {
    elements: {
      UserModelName: { metaclass: 'Object' },
      UserModelAttribute: { metaclass: 'AttributeLink' },
    },
    relationships: { UserModelLink: 'Link' },
  },
  StateMachineDiagram: {
    elements: STATE_ELEMENTS,
    relationships: { StateTransition: 'Transition' },
  },
  AgentDiagram: {
    elements: {
      ...STATE_ELEMENTS,
      AgentState: { metaclass: 'AgentState' },
      AgentStateBody: { metaclass: 'Body' },
      AgentStateFallbackBody: { metaclass: 'Body' },
      AgentIntent: { metaclass: 'Intent' },
      AgentIntentBody: { metaclass: 'Intent', fold: { mode: 'list', feature: 'trainingSentences' } },
      AgentRagElement: { metaclass: 'RAG' },
      AgentTool: { metaclass: 'Tool' },
      AgentSkill: { metaclass: 'Skill' },
      AgentWorkspace: { metaclass: 'Workspace' },
      AgentLLM: { metaclass: 'LLMWrapper' },
    },
    relationships: { AgentStateTransition: 'Transition', AgentStateTransitionInit: 'Transition' },
  },
  BPMN: {
    elements: {
      BPMNTask: { metaclass: 'Task' },
      BPMNSubprocess: { metaclass: 'SubProcess' },
      BPMNTransaction: { metaclass: 'Transaction' },
      BPMNCallActivity: { metaclass: 'CallActivity' },
      BPMNAnnotation: { metaclass: 'TextAnnotation' },
      BPMNStartEvent: { metaclass: 'StartEvent' },
      BPMNIntermediateEvent: { metaclass: 'IntermediateEvent' },
      BPMNEndEvent: { metaclass: 'EndEvent' },
      BPMNGateway: { metaclass: 'Gateway' },
      BPMNDataObject: { metaclass: 'DataObject' },
      BPMNDataStore: { metaclass: 'DataStore' },
      BPMNPool: { metaclass: 'Participant' },
      BPMNSwimlane: { metaclass: 'Lane' },
      BPMNGroup: { metaclass: 'Group' },
    },
    relationships: {
      BPMNFlow: (flow) => BPMN_FLOW_METACLASSES[String(flow.flowType ?? 'sequence')] ?? 'SequenceFlow',
    },
  },
  NNDiagram: {
    elements: Object.fromEntries(Object.entries(NN_ELEMENTS).map(([type, metaclass]) => [type, { metaclass }])),
    // Next/composition edges order and group the layers; the B-UML network has no element for them, so a
    // change shows as the edge's own artifact (named after its ends).
    relationships: { NNNext: 'LayerOrder', NNComposition: 'Composition', NNAssociation: 'Association' },
  },
  ComponentDiagram: {
    elements: {
      Component: { metaclass: 'Component' },
      Subsystem: { metaclass: 'Subsystem' },
      ComponentInterface: { metaclass: 'Interface' },
    },
    relationships: {
      ComponentInterfaceProvided: 'InterfaceProvided',
      ComponentInterfaceRequired: 'InterfaceRequired',
      ComponentDependency: 'ComponentDependency',
    },
  },
  DeploymentDiagram: {
    elements: {
      DeploymentNode: { metaclass: 'Node' },
      DeploymentComponent: { metaclass: 'DeploymentComponent' },
      DeploymentArtifact: { metaclass: 'Artifact' },
      DeploymentInterface: { metaclass: 'Interface' },
    },
    relationships: {
      DeploymentAssociation: 'CommunicationPath',
      DeploymentInterfaceProvided: 'InterfaceProvided',
      DeploymentInterfaceRequired: 'InterfaceRequired',
      DeploymentDependency: 'DeploymentDependency',
    },
  },
};

/** An NN attribute element (`KernelDimAttributeConv2D`, `NameAttributeLinear`, ...): a feature of its layer. */
const NN_ATTRIBUTE = /^[A-Z][A-Za-z]*Attribute[A-Z][A-Za-z0-9]*$/;

/** Fields that are layout or editor state, never compared. */
const LAYOUT_FIELDS = new Set([
  'id', 'type', 'owner', 'name', 'bounds', 'path', 'highlight', 'fillColor', 'strokeColor', 'textColor',
  'lineColor', 'isManuallyLayouted', 'assessmentNote', 'selected', 'hovered', 'resizable', 'movable',
  'direction', 'element', 'source', 'target', 'attributeName', 'value',
]);

interface ApollonElement {
  id: string;
  type: string;
  name?: string;
  owner?: string | null;
  [field: string]: unknown;
}

interface ApollonRelationship {
  id: string;
  type: string;
  name?: string;
  source?: { element?: string; [field: string]: unknown };
  target?: { element?: string; [field: string]: unknown };
  [field: string]: unknown;
}

export interface ApollonModelLike {
  elements?: Record<string, ApollonElement>;
  relationships?: Record<string, ApollonRelationship>;
  /** An agent diagram's off-canvas components (intents, tools, RAGs ...), keyed by id. */
  components?: Record<string, ApollonElement>;
}

const isScalar = (raw: unknown): raw is string | number | boolean =>
  typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean';

/** The scalar fields of `record` that reach the model, under `prefix`. */
function scalarFeatures(record: Record<string, unknown> | undefined, prefix = ''): Record<string, FeatureValue> {
  const features: Record<string, FeatureValue> = {};
  for (const [field, raw] of Object.entries(record ?? {})) {
    if (LAYOUT_FIELDS.has(field) || !isScalar(raw)) continue;
    features[`${prefix}${field}`] = value(raw);
  }
  return features;
}

const reference = (id: string | null | undefined, names: Map<string, string>): FeatureValue => ({
  key: id ?? '',
  display: (id && names.get(id)) || '',
});

/** Who an element belongs to, and how deep: the rank orders creations (owners first). */
function depthOf(element: ApollonElement, elements: Record<string, ApollonElement>): number {
  let depth = 0;
  for (let owner = element.owner; owner && elements[owner] && depth < 20; owner = elements[owner].owner) depth += 1;
  return depth;
}

/**
 * The elements of an Apollon model of `diagramType` that reach its B-UML model, by editor element id: the
 * generic builder of every Apollon diagram but the class diagram (which has its own) and the GUI.
 */
export function snapshotApollonModel(diagramType: SupportedDiagramType, model: ApollonModelLike | null | undefined): Map<string, Snapshot> {
  const table = APOLLON_TABLES[diagramType];
  const result = new Map<string, Snapshot>();
  if (!table || !model) return result;
  const elements: Record<string, ApollonElement> = { ...(model.components ?? {}), ...(model.elements ?? {}) };
  const names = new Map(Object.values(elements).map((e) => [e.id, e.name ?? '']));
  const isNN = diagramType === 'NNDiagram';
  /** Members folded into their owner, applied once every owner is in. */
  const folded: ApollonElement[] = [];

  for (const element of Object.values(elements)) {
    if (!element || typeof element.type !== 'string') continue;
    const rule: ElementRule | undefined = table.elements[element.type];
    if (isNN && NN_ATTRIBUTE.test(element.type)) {
      folded.push(element);
      continue;
    }
    if (!rule) continue;
    if (rule.fold) {
      folded.push(element);
      continue;
    }
    const name = element.name ?? '';
    const owner = element.owner && elements[element.owner] && table.elements[elements[element.owner].type] ? element.owner : null;
    result.set(element.id, {
      elementType: rule.metaclass, name, parentElementId: owner, rank: depthOf(element, elements),
      features: { name: value(name), ...(owner ? { owner: reference(owner, names) } : {}), ...scalarFeatures(element) },
    });
  }

  // Sorted so a list feature has the same order whatever order the editor keeps the members in.
  folded.sort((a, b) => a.id.localeCompare(b.id));
  for (const member of folded) {
    const owner = member.owner ? result.get(member.owner) : undefined;
    if (!owner) continue;
    const rule: ElementRule | undefined = table.elements[member.type];
    if (rule?.fold?.mode === 'list') {
      const feature = rule.fold.feature;
      const previous = owner.features[feature]?.key;
      const entries = previous ? `${previous}\n${member.name ?? ''}` : member.name ?? '';
      owner.features[feature] = value(entries);
    } else {
      const feature = typeof member.attributeName === 'string' && member.attributeName ? member.attributeName : member.type;
      owner.features[feature] = value(isScalar(member.value) ? member.value : member.name);
    }
  }

  for (const rel of Object.values(model.relationships ?? {})) {
    if (!rel || typeof rel.type !== 'string') continue;
    const mapped = table.relationships[rel.type];
    if (!mapped) continue;
    const metaclass = typeof mapped === 'function' ? mapped(rel) : mapped;
    const source = rel.source?.element;
    const target = rel.target?.element;
    const label = rel.name || `${(source && names.get(source)) || '?'} → ${(target && names.get(target)) || '?'}`;
    result.set(rel.id, {
      elementType: metaclass, name: label, parentElementId: null, rank: 100,
      features: {
        name: value(rel.name),
        source: reference(source, names),
        target: reference(target, names),
        ...scalarFeatures(rel),
        ...scalarFeatures(rel.source, 'source.'),
        ...scalarFeatures(rel.target, 'target.'),
      },
    });
  }
  return result;
}

/* ------------------------------------------------------------------ quantum circuits */

export interface QuantumModelLike {
  cols?: unknown[][];
  gateMetadata?: Record<string, { label?: unknown; type?: unknown } | undefined>;
  initialStates?: unknown[];
}

/** Quirk symbol -> B-UML gate metaclass (`besser/BUML/metamodel/quantum/quantum.py`); any other gate is a `Gate`. */
const QUANTUM_METACLASSES: Record<string, string> = {
  H: 'HadamardGate',
  X: 'PauliXGate',
  Y: 'PauliYGate',
  Z: 'PauliZGate',
  '•': 'ControlState',
  '◦': 'ControlState',
  Measure: 'Measurement',
  Swap: 'SwapGate',
  'Z^½': 'SGate',
  'Z^¼': 'TGate',
};

/**
 * The qubits and gates of a quantum circuit. A circuit's cells have no ids: a gate is known by its cell (column
 * and wire, prefixed with the diagram id, as element ids are unique project-wide), so moving a gate is recorded as
 * deleting it and creating it elsewhere.
 */
export function snapshotQuantumModel(model: QuantumModelLike | null | undefined, diagramId: string): Map<string, Snapshot> {
  const result = new Map<string, Snapshot>();
  const cols = Array.isArray(model?.cols) ? model!.cols : [];
  const wires = Math.max(0, ...cols.map((col) => (Array.isArray(col) ? col.length : 0)), model?.initialStates?.length ?? 0);
  for (let wire = 0; wire < wires; wire += 1) {
    result.set(`${diagramId}:qubit:${wire}`, {
      elementType: 'Qubit', name: `q${wire}`, parentElementId: null, rank: 0,
      features: { initialState: value(model?.initialStates?.[wire], '0') },
    });
  }
  cols.forEach((col, column) => {
    if (!Array.isArray(col)) return;
    col.forEach((cell, wire) => {
      if (cell === 1 || cell === null || cell === undefined || cell === '') return;
      const symbol = typeof cell === 'string' ? cell : JSON.stringify(cell);
      const metadata = model?.gateMetadata?.[`${column}_${wire}`];
      const label = typeof metadata?.label === 'string' && metadata.label ? metadata.label : symbol;
      result.set(`${diagramId}:gate:${column}:${wire}`, {
        elementType: QUANTUM_METACLASSES[symbol] ?? 'Gate', name: label, parentElementId: `${diagramId}:qubit:${wire}`, rank: 1,
        features: { name: value(label), symbol: value(symbol) },
      });
    });
  });
  return result;
}

/* ------------------------------------------------------------------ knowledge graphs */

export interface KnowledgeGraphModelLike {
  nodes?: Array<{ id: string; nodeType?: string; label?: string; iri?: string; value?: string; datatype?: string; metadata?: Record<string, unknown> }>;
  edges?: Array<{ id: string; source: string; target: string; label?: string; iri?: string }>;
}

/** KG node type -> B-UML metaclass (`besser/BUML/metamodel/kg/knowledge_graph.py`). */
const KG_METACLASSES: Record<string, string> = {
  class: 'KGClass',
  individual: 'KGIndividual',
  property: 'KGProperty',
  literal: 'KGLiteral',
  blank: 'KGBlank',
  nodeConstraint: 'KGNodeConstraint',
  propertyConstraint: 'KGPropertyConstraint',
};

/** The nodes and edges of a knowledge graph; layout (positions) and view settings (`settings`) are left out. */
export function snapshotKnowledgeGraph(model: KnowledgeGraphModelLike | null | undefined): Map<string, Snapshot> {
  const result = new Map<string, Snapshot>();
  const nodes = Array.isArray(model?.nodes) ? model!.nodes : [];
  const names = new Map(nodes.map((n) => [n.id, n.label ?? '']));
  for (const node of nodes) {
    const constraints = node.metadata?.constraintSpecs;
    result.set(node.id, {
      elementType: KG_METACLASSES[node.nodeType ?? ''] ?? 'KGNode', name: node.label ?? '', parentElementId: null, rank: 0,
      features: {
        name: value(node.label),
        iri: value(node.iri),
        value: value(node.value),
        datatype: value(node.datatype),
        ...(constraints !== undefined ? { constraints: value(JSON.stringify(constraints)) } : {}),
      },
    });
  }
  for (const edge of Array.isArray(model?.edges) ? model!.edges : []) {
    const label = edge.label || `${names.get(edge.source) ?? '?'} → ${names.get(edge.target) ?? '?'}`;
    result.set(edge.id, {
      elementType: 'KGEdge', name: label, parentElementId: null, rank: 1,
      features: {
        name: value(edge.label),
        iri: value(edge.iri),
        source: reference(edge.source, names),
        target: reference(edge.target, names),
      },
    });
  }
  return result;
}

/* ------------------------------------------------------------------ any diagram */

/**
 * The elements of `model`, a model of a `diagramType` diagram, that reach its B-UML model. Empty for a GUI (whose
 * changes are recorded with their bindings, by `recordGuiDiagramUpdate`) and for an unknown type.
 */
export function snapshotDiagramModel(diagramType: SupportedDiagramType, model: unknown, diagramId: string): Map<string, Snapshot> {
  switch (diagramType) {
    case 'ClassDiagram':
      return snapshotClassModel(model as ClassModelLike);
    case 'QuantumCircuitDiagram':
      return snapshotQuantumModel(model as QuantumModelLike, diagramId);
    case 'KnowledgeGraphDiagram':
      return snapshotKnowledgeGraph(model as KnowledgeGraphModelLike);
    case 'GUINoCodeDiagram':
      return new Map();
    default:
      return snapshotApollonModel(diagramType, model as ApollonModelLike);
  }
}

/** The changes that turn `previous` into `next`, two models of a `diagramType` diagram. */
export function diffDiagramModel(diagramType: SupportedDiagramType, previous: unknown, next: unknown, diagramId: string): ElementChange[] {
  return diffSnapshots(snapshotDiagramModel(diagramType, previous, diagramId), snapshotDiagramModel(diagramType, next, diagramId));
}

/** The element of `model` with id `elementId`, as the trace names it; undefined when it is not traced. */
export function tracedElement(
  diagramType: SupportedDiagramType, model: unknown, diagramId: string, elementId: string,
): { elementType: string; name: string; parentElementId: string | null } | undefined {
  const snapshot = snapshotDiagramModel(diagramType, model, diagramId).get(elementId);
  return snapshot && { elementType: snapshot.elementType, name: snapshot.name, parentElementId: snapshot.parentElementId };
}

/** Which source metaclasses a derived element of each metaclass may come from, when a derivation gives no
 *  element mapping and elements are matched by name (a class diagram converted from a knowledge graph). */
const NAME_MATCHES: Record<string, string[]> = {
  Class: ['KGClass'],
  Enumeration: ['KGClass'],
  Property: ['KGProperty'],
  BinaryAssociation: ['KGProperty'],
};

/**
 * Map the elements of a derived model to the elements of its source model that have the same name and a
 * matching metaclass (derived element id -> source element id): the lineage of a derivation that reports none.
 * An attribute is matched by its own name, whatever class holds it; a name the source has twice is not matched.
 */
export function elementsMatchedByName(
  source: { diagramType: SupportedDiagramType; model: unknown; id: string },
  derived: { diagramType: SupportedDiagramType; model: unknown; id: string },
): Record<string, string> {
  const byName = new Map<string, string | null>();
  for (const [id, element] of snapshotDiagramModel(source.diagramType, source.model, source.id)) {
    const key = `${element.elementType}:${element.name.trim().toLowerCase()}`;
    byName.set(key, byName.has(key) ? null : id);
  }
  const mapping: Record<string, string> = {};
  for (const [id, element] of snapshotDiagramModel(derived.diagramType, derived.model, derived.id)) {
    for (const metaclass of NAME_MATCHES[element.elementType] ?? []) {
      const sourceId = byName.get(`${metaclass}:${element.name.trim().toLowerCase()}`);
      if (sourceId) {
        mapping[id] = sourceId;
        break;
      }
    }
  }
  return mapping;
}
