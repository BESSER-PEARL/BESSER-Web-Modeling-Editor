import type { SupportedDiagramType } from '../types/project';
import { isModelArtifact } from '../types/traceability';
import type { ChangeKind, ModelArtifact, TraceArtifact, TraceFile } from '../types/traceability';
import { snapshotClassModel } from './classModelDiff';
import { COLUMN_METACLASSES } from './guiModelDiff';
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
  /** Its B-UML metaclass, the class the backend's `json_to_buml` processor builds from it; a function when it
   *  depends on the element (an agent state's `stateType`, a BPMN task's `isAgentic`). */
  metaclass: string | ((element: ApollonElement) => string);
  /**
   * A member that is part of its owner rather than an element of its own:
   * - `list`: one entry of the owner's feature `feature` (an intent's training sentences, a state's actions): its
   *   name, or with `describe`, its name and scalar fields (an action's reply type and parameters);
   * - `named`: it is the owner's feature named by its `attributeName`, valued by its `value` (a layer's
   *   `kernel_dim = 3`).
   */
  fold?: { mode: 'list'; feature: string; describe?: boolean } | { mode: 'named' };
  /**
   * `false`: the backend builds no element with this element's id (an LLM wrapper, a fork node, an NN
   * configuration), so generated code can never be linked to it. It is recorded as history, but the Coverage and
   * Requirements views do not count it as missing code ({@link UNTRACEABLE_METACLASSES}).
   */
  traceable?: false;
}

type ApollonElementRecord = Record<string, ApollonElement>;

interface ApollonTable {
  elements: Record<string, ElementRule>;
  /** Relationship type -> metaclass; a function when it depends on the relationship (a BPMN flow's kind) or on the
   *  elements it connects (a deployment association). */
  relationships: Record<string, string | ((relationship: ApollonRelationship, elements: ApollonElementRecord) => string)>;
  /** Relationship metaclasses with no backend element (see {@link ElementRule.traceable}). */
  untraceableRelationships?: string[];
  /**
   * Pseudo-states that are no element of their own: a transition from an `initial` node marks its target state
   * initial, one to a `final` node marks its source final (the backend's state machine and agent processors), and
   * neither the node nor the transition is recorded.
   */
  pseudoStates?: { initial: string; final?: string };
}

/** Pseudo-nodes the backend ignores: kept as history, never linked to code. */
const IGNORED_STATE_NODES: Record<string, ElementRule> = {
  StateForkNode: { metaclass: 'ForkNode', traceable: false },
  StateForkNodeHorizontal: { metaclass: 'ForkNode', traceable: false },
  StateMergeNode: { metaclass: 'MergeNode', traceable: false },
  StateActionNode: { metaclass: 'ActionNode', traceable: false },
  StateObjectNode: { metaclass: 'ObjectNode', traceable: false },
};

/**
 * State machine (`state_machine_processor.py`): a state's bodies are references to code blocks by name, folded into
 * the state; a code block is the `Body` the backend builds. Initial and final nodes are pseudo-states.
 */
const STATE_ELEMENTS: Record<string, ElementRule> = {
  State: { metaclass: 'State' },
  StateBody: { metaclass: 'State', fold: { mode: 'list', feature: 'body' } },
  StateFallbackBody: { metaclass: 'State', fold: { mode: 'list', feature: 'fallbackBody' } },
  StateCodeBlock: { metaclass: 'Body' },
  ...IGNORED_STATE_NODES,
};

const STATE_PSEUDO_STATES = { initial: 'StateInitialNode', final: 'StateFinalNode' };

/** BPMN flow kinds (`flowType`) -> metaclass (`bpmn_diagram_processor.py::_build_flow`). */
const BPMN_FLOW_METACLASSES: Record<string, string> = {
  sequence: 'SequenceFlow',
  message: 'MessageFlow',
  association: 'Association',
  'data association': 'DataAssociation',
  // Older spellings, kept so a model saved with them is still recorded as a data association.
  data: 'DataAssociation',
  'data-association': 'DataAssociation',
};

/** An «agentic» BPMN element (`isAgentic`) is the agentic subclass the backend builds. */
const agenticOr = (agentic: string, plain: string) => (element: ApollonElement): string => (element.isAgentic ? agentic : plain);

/** NN layer and section element types -> metaclass (`besser/BUML/metamodel/nn/neural_network.py`). */
const NN_ELEMENTS: Record<string, ElementRule> = {
  LinearLayer: { metaclass: 'LinearLayer' },
  FlattenLayer: { metaclass: 'FlattenLayer' },
  EmbeddingLayer: { metaclass: 'EmbeddingLayer' },
  DropoutLayer: { metaclass: 'DropoutLayer' },
  LayerNormalizationLayer: { metaclass: 'LayerNormLayer' },
  BatchNormalizationLayer: { metaclass: 'BatchNormLayer' },
  RNNLayer: { metaclass: 'SimpleRNNLayer' },
  LSTMLayer: { metaclass: 'LSTMLayer' },
  GRULayer: { metaclass: 'GRULayer' },
  PoolingLayer: { metaclass: 'PoolingLayer' },
  Conv1DLayer: { metaclass: 'Conv1D' },
  Conv2DLayer: { metaclass: 'Conv2D' },
  Conv3DLayer: { metaclass: 'Conv3D' },
  TensorOp: { metaclass: 'TensorOp' },
  TrainingDataset: { metaclass: 'Dataset' },
  TestDataset: { metaclass: 'Dataset' },
  NNContainer: { metaclass: 'NN' },
  // `nn_diagram_processor.py` gives these no id: the configuration sets the network's training, a reference adds
  // the referenced network as a sub-network.
  Configuration: { metaclass: 'Configuration', traceable: false },
  NNReference: { metaclass: 'NNReference', traceable: false },
};

/**
 * Component stereotypes, as `stereotype_tokens.py` reads them: tokens split on commas and spaces (a `{permission:
 * ...}` suffix left out), trimmed, without guillemets or quotes, lower case.
 */
function stereotypeTokens(raw: unknown): string[] {
  if (typeof raw !== 'string') return [];
  return raw
    .replace(/\{permission:[^}]*\}/gi, ' ')
    .split(/[,\s]+/)
    .map((token) => token.trim().replace(/^[«»]+|[«»]+$/g, '').replace(/^["']+|["']+$/g, '').toLowerCase())
    .filter(Boolean);
}

/** `COMPONENT_SUBTYPE_TOKENS` in the backend's constants: a component with one of these is that subclass. */
const COMPONENT_SUBTYPES: Record<string, string> = { skill: 'Skill', tool: 'Tool', llm: 'LLM', db: 'Database', rag: 'RAG' };
/** `AgentCategory` values but `none`: a component with one of these is an `AgenticComponent`. */
const AGENT_CATEGORIES = new Set(['solution', 'supervision', 'consensus', 'collaboration']);
/** `AgenticEdgeKind` values: a dependency with one of these is an `AgenticEdge`. */
const AGENTIC_EDGE_KINDS = new Set(['delegates', 'supervises', 'revises', 'collaborates', 'has', 'uses', 'granted', 'implements']);

/** A component's metaclass (`component_diagram_processor.py::_build_component_node`). */
function componentMetaclass(element: ApollonElement): string {
  const tokens = stereotypeTokens(element.stereotype);
  const subtype = tokens.find((token) => token in COMPONENT_SUBTYPES);
  if (subtype) return COMPONENT_SUBTYPES[subtype];
  return tokens.some((token) => AGENT_CATEGORIES.has(token)) ? 'AgenticComponent' : 'Component';
}

/** A deployment association is a communication path between two nodes, else an artifact's (or component's)
 *  deployment on a node (`deployment_diagram_processor.py::_build_deployment_relationship`). */
function deploymentAssociation(relationship: ApollonRelationship, elements: ApollonElementRecord): string {
  const typeOf = (end: ApollonRelationship['source']) => (end?.element ? elements[end.element]?.type : undefined);
  return typeOf(relationship.source) === 'DeploymentNode' && typeOf(relationship.target) === 'DeploymentNode'
    ? 'CommunicationPath'
    : 'DeploymentRelation';
}

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
    pseudoStates: STATE_PSEUDO_STATES,
  },
  /**
   * Agent (`agent_diagram_processor.py`): a state is a `ReasoningState` when its `stateType` is `reasoning`; its
   * actions and fallback actions make one `Body` each, which the backend builds without an id, so they are folded
   * into the state (an edit of an action is a change of the state, which is linked to code). A transition from the
   * initial node is no transition: its target state is initial.
   */
  AgentDiagram: {
    elements: {
      ...IGNORED_STATE_NODES,
      AgentState: { metaclass: (element) => (element.stateType === 'reasoning' ? 'ReasoningState' : 'AgentState') },
      AgentReasoningState: { metaclass: 'ReasoningState' },
      AgentStateBody: { metaclass: 'AgentState', fold: { mode: 'list', feature: 'actions', describe: true } },
      AgentStateFallbackBody: { metaclass: 'AgentState', fold: { mode: 'list', feature: 'fallbackActions', describe: true } },
      AgentIntent: { metaclass: 'Intent' },
      AgentIntentBody: { metaclass: 'Intent', fold: { mode: 'list', feature: 'trainingSentences' } },
      AgentRagElement: { metaclass: 'RAG' },
      AgentTool: { metaclass: 'Tool' },
      AgentSkill: { metaclass: 'Skill' },
      AgentWorkspace: { metaclass: 'Workspace' },
      // The backend makes an LLM wrapper from it by name, with no id.
      AgentLLM: { metaclass: 'LLMWrapper', traceable: false },
    },
    relationships: { AgentStateTransition: 'Transition', AgentStateTransitionInit: 'Transition' },
    pseudoStates: STATE_PSEUDO_STATES,
  },
  BPMN: {
    elements: {
      BPMNTask: { metaclass: agenticOr('AgenticTask', 'Task') },
      BPMNSubprocess: { metaclass: 'SubProcess' },
      BPMNTransaction: { metaclass: 'Transaction' },
      BPMNCallActivity: { metaclass: 'CallActivity' },
      BPMNAnnotation: { metaclass: 'TextAnnotation' },
      BPMNStartEvent: { metaclass: 'StartEvent' },
      BPMNIntermediateEvent: { metaclass: 'IntermediateEvent' },
      BPMNEndEvent: { metaclass: 'EndEvent' },
      BPMNGateway: { metaclass: agenticOr('AgenticGateway', 'Gateway') },
      BPMNDataObject: { metaclass: 'DataObject' },
      BPMNDataStore: { metaclass: 'DataStore' },
      BPMNPool: { metaclass: 'Participant' },
      BPMNSwimlane: { metaclass: agenticOr('AgenticLane', 'Lane') },
      BPMNGroup: { metaclass: 'Group' },
    },
    relationships: {
      BPMNFlow: (flow) => BPMN_FLOW_METACLASSES[String(flow.flowType ?? 'sequence')] ?? 'SequenceFlow',
    },
  },
  NNDiagram: {
    elements: NN_ELEMENTS,
    // Next/composition/association edges order and group the layers; the B-UML network has no element for them,
    // so a change shows as the edge's own artifact (named after its ends), never linked to code.
    relationships: { NNNext: 'LayerOrder', NNComposition: 'NNComposition', NNAssociation: 'NNAssociation' },
    untraceableRelationships: ['LayerOrder', 'NNComposition', 'NNAssociation'],
  },
  ComponentDiagram: {
    elements: {
      Component: { metaclass: componentMetaclass },
      Subsystem: { metaclass: 'Subsystem' },
      ComponentInterface: { metaclass: 'Interface' },
    },
    relationships: {
      ComponentInterfaceProvided: 'InterfaceProvided',
      ComponentInterfaceRequired: 'InterfaceRequired',
      ComponentDependency: (dependency) =>
        (stereotypeTokens(dependency.stereotype).some((token) => AGENTIC_EDGE_KINDS.has(token)) ? 'AgenticEdge' : 'ComponentDependency'),
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
      DeploymentAssociation: deploymentAssociation,
      DeploymentInterfaceProvided: 'InterfaceProvided',
      DeploymentInterfaceRequired: 'InterfaceRequired',
      DeploymentDependency: 'DeploymentDependency',
    },
  },
};

const metaclassOf = (rule: ElementRule, element: ApollonElement): string =>
  (typeof rule.metaclass === 'function' ? rule.metaclass(element) : rule.metaclass);

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
      elementType: metaclassOf(rule, element), name, parentElementId: owner, rank: depthOf(element, elements),
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
      const entry = rule.fold.describe ? describeMember(member) : member.name ?? '';
      owner.features[feature] = value(previous ? `${previous}\n${entry}` : entry);
    } else {
      const feature = typeof member.attributeName === 'string' && member.attributeName ? member.attributeName : member.type;
      owner.features[feature] = value(isScalar(member.value) ? member.value : member.name);
    }
  }

  const pseudo = table.pseudoStates;
  for (const rel of Object.values(model.relationships ?? {})) {
    if (!rel || typeof rel.type !== 'string') continue;
    const mapped = table.relationships[rel.type];
    if (!mapped) continue;
    const source = rel.source?.element;
    const target = rel.target?.element;
    if (pseudo) {
      // A transition from the initial node marks its target initial, one to a final node its source final.
      const from = source ? elements[source]?.type : undefined;
      const to = target ? elements[target]?.type : undefined;
      if (from === pseudo.initial || (pseudo.final !== undefined && to === pseudo.final)) {
        const state = from === pseudo.initial ? (target ? result.get(target) : undefined) : (source ? result.get(source) : undefined);
        if (state) state.features[from === pseudo.initial ? 'initial' : 'final'] = value('true');
        continue;
      }
    }
    const metaclass = typeof mapped === 'function' ? mapped(rel, elements) : mapped;
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

/** A folded member as one entry of its owner's list: its name, then its other scalar fields (`key=value`). */
function describeMember(member: ApollonElement): string {
  const fields = Object.entries(scalarFeatures(member))
    .filter(([, field]) => field.key !== '' && field.key !== 'false')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([field, entry]) => `${field}=${entry.display}`);
  return fields.length > 0 ? `${member.name ?? ''} (${fields.join(', ')})` : member.name ?? '';
}

/* ------------------------------------------------------------------ quantum circuits */

export interface QuantumModelLike {
  cols?: unknown[][];
  gateMetadata?: Record<string, GateMetadata | undefined>;
  initialStates?: unknown[];
}

/** Symbols of a column that are no gate: the column's gates are controlled by them (`ControlState`). */
const CONTROL_SYMBOLS = new Set(['•', '◦']);

/** Two-wire gates: one gate over the first two wires of the column that carry its symbol, keyed on the first. */
const PAIR_GATES: Array<[string[], string]> = [
  [['Swap'], 'SwapGate'],
  [['RXX', 'rxx'], 'RXXGate'],
  [['RZZ', 'rzz'], 'RZZGate'],
  [['RZX', 'rzx'], 'RZXGate'],
  [['RYY', 'ryy'], 'RYYGate'],
  [['Bell', 'BELL'], 'BellGate'],
  [['iSwap', 'ISWAP'], 'iSwapGate'],
  [['SqrtSwap', 'SQRT_SWAP'], 'SqrtSwapGate'],
];
const PAIR_METACLASS = new Map(PAIR_GATES.flatMap(([symbols, metaclass]) => symbols.map((symbol) => [symbol, metaclass] as const)));

/** One-wire symbols -> metaclass, as `quantum_diagram_processor.py::_create_gate` builds them. */
const GATE_SYMBOLS: Array<[string[], string]> = [
  [['H'], 'HadamardGate'],
  [['X'], 'PauliXGate'],
  [['Y'], 'PauliYGate'],
  [['Z'], 'PauliZGate'],
  [['S', 'Z^½'], 'SGate'],
  [['T', 'Z^¼'], 'TGate'],
  [['S_DAG', 'Z^-½', 'V', 'X^½', 'V_DAG', 'X^-½', 'SQRT_Y', 'Y^½', 'SQRT_Y_DAG', 'Y^-½', 'T_DAG', 'Z^-¼', 'SQRT_SQRT_X', 'X^¼',
    'SQRT_SQRT_X_DAG', 'X^-¼', 'SQRT_SQRT_Y', 'Y^¼', 'SQRT_SQRT_Y_DAG', 'Y^-¼'], 'ParametricGate'],
  [['Phase', 'PHASE'], 'PhaseGate'],
  [['X_POW'], 'RXGate'],
  [['Y_POW'], 'RYGate'],
  [['Z_POW'], 'RZGate'],
  [['EXP_X', 'exp(iXt)', 'EXP_Y', 'exp(iYt)', 'EXP_Z', 'exp(iZt)', 'Z_POW_T', 'Z^t', 'Z_POW_NEG_T', 'Z^-t', 'Y_POW_T', 'Y^t',
    'Y_POW_NEG_T', 'Y^-t', 'X_POW_T', 'X^t', 'X_POW_NEG_T', 'X^-t', 'Z_FUNC_T', 'RZ_FUNC_T', 'Y_FUNC_T', 'RY_FUNC_T',
    'X_FUNC_T', 'RX_FUNC_T'], 'TimeDependentGate'],
  [['TIME_SHIFT', 'TimeShift', 'TIME_SHIFT_INV', 'TimeShiftInv', 'CYCLE_BITS', 'Cycle', 'INTERLEAVE', 'Interleave',
    'DEINTERLEAVE', 'Deinterleave', 'REVERSE_BITS', 'Reverse', 'ROTATE_BITS_LEFT', 'RotateLeft', 'ROTATE_BITS_RIGHT',
    'RotateRight'], 'OrderGate'],
  [['Bloch', 'BLOCH', 'Density', 'DENSITY', 'Amps', 'Amplitude', 'AMPLITUDE', 'AMP', 'Chance', 'CHANCE', 'SAMPLE', 'Sample',
    'DETECT', 'Detect', 'AXIS_SAMPLE', 'AxisSample'], 'DisplayOperation'],
  [['Measure', 'MEASURE', 'MEASURE_X', 'MeasureX', 'Measure X', 'MEASURE_Y', 'MeasureY', 'Measure Y'], 'Measurement'],
  [['POST_SELECT_OFF', '|0⟩', 'POST_SELECT_ON', '|1⟩', 'POST_SELECT_X_OFF', '|+⟩', 'POST_SELECT_X_ON', '|−⟩',
    'POST_SELECT_Y_OFF', '|i⟩', 'POST_SELECT_Y_ON', '|-i⟩'], 'PostSelection'],
  [['RANDOM', 'Random'], 'InputGate'],
  [['QFT', 'qft', 'QFT_DAG', 'qft†', 'QFT†'], 'QFTGate'],
  [['PhaseGradient', 'PHASE_GRADIENT', 'PHASE_GRADIENT_DAG', 'PhaseGradient†', 'PHASE_GRADIENT_INV', 'PhaseGradientInv',
    'PHASE_GRADIENT_INV_DAG', 'PhaseGradientInv†'], 'PhaseGradientGate'],
  [['+1', 'INC', 'inc', '-1', 'DEC', 'dec', '+A', 'ADD', 'add', '-A', 'SUB', 'sub', '×A', 'MUL', 'mul', '+AB', 'ADD_AB', '-AB',
    'SUB_AB', '×A⁻¹', 'MUL_INV', 'COUNT_1S', 'Count', 'XOR', 'Xor'], 'ArithmeticGate'],
  [['MOD_INC', 'ModInc', 'MOD_DEC', 'ModDec', 'MOD_ADD', 'ModAdd', 'MOD_SUB', 'ModSub', 'MOD_MUL', 'ModMul', 'MOD_INV_MUL',
    'ModInvMul', 'MOD_MUL_B', 'ModMulB', 'MOD_MUL_B_INV', 'ModMulBInv'], 'ModularArithmeticGate'],
  [['COMPARE', 'compare', '<', 'GREATER_THAN', '>', 'LESS_EQUAL', '<=', '≤', 'GREATER_EQUAL', '>=', '≥', 'EQUAL', '==', '=',
    'NOT_EQUAL', '!=', '≠', 'COMPARE_A_LT', 'A<', 'COMPARE_A_GT', 'A>', 'COMPARE_A_EQ', 'A='], 'ComparisonGate'],
  [['ONE', '1', 'MINUS_ONE', 'PHASE_I', 'i', 'PHASE_MINUS_I', '-i', 'PHASE_SQRT_I', '√i', 'PHASE_SQRT_MINUS_I', '√-i'], 'ScalarGate'],
  [['SPACER', '…', 'spacer'], 'SpacerGate'],
];
const GATE_METACLASS = new Map(GATE_SYMBOLS.flatMap(([symbols, metaclass]) => symbols.map((symbol) => [symbol, metaclass] as const)));

/** The metaclass of a one-wire gate symbol, as `_create_gate` decides it (exact symbols, then prefixes); a symbol
 *  it does not know is a `CustomGate`. */
function gateMetaclass(symbol: string): string {
  const exact = GATE_METACLASS.get(symbol);
  if (exact) return exact;
  if (symbol.startsWith('Rx')) return 'RXGate';
  if (symbol.startsWith('Ry')) return 'RYGate';
  if (symbol.startsWith('Rz')) return 'RZGate';
  if (/^(input|Input|INPUT)/.test(symbol)) return 'InputGate';
  if (symbol.startsWith('<<') || symbol.startsWith('>>')) return 'OrderGate';
  return 'CustomGate';
}

/** A cell's gate metadata (`gateMetadata["<column>_<wire>"]`). */
interface GateMetadata {
  label?: unknown;
  type?: unknown;
  height?: unknown;
  isFunctionGate?: unknown;
  nestedCircuit?: unknown;
}

/**
 * The qubits and gates of a quantum circuit, as `quantum_diagram_processor.py` builds them. A circuit's cells have no
 * ids: a gate is known by its cell (column and wire, prefixed with the diagram id, as element ids are unique
 * project-wide), the cell the backend keys it on, so moving a gate is recorded as deleting it and creating it
 * elsewhere. A gate over several wires (a swap, a two-qubit rotation, a function gate of some height) is one gate,
 * at its first wire (`wires` lists them all); the control cells of a column are no gate but a feature (`controls`)
 * of each gate of the column. Qubits have no id in the backend: they are recorded for their initial state, never
 * linked to code.
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
    const symbols = col.map((cell) => (cell === 1 || cell === '1' || cell === null || cell === undefined || cell === ''
      ? null
      : typeof cell === 'string' ? cell : JSON.stringify(cell)));
    const controls = symbols.flatMap((symbol, wire) => (symbol && CONTROL_SYMBOLS.has(symbol) ? [`q${wire} ${symbol}`] : []));
    const covered = new Set<number>();
    const gate = (wire: number, metaclass: string, symbol: string, gateWires: number[]) => {
      gateWires.forEach((w) => covered.add(w));
      const metadata = model?.gateMetadata?.[`${column}_${wire}`];
      const label = typeof metadata?.label === 'string' && metadata.label ? metadata.label : symbol;
      result.set(`${diagramId}:gate:${column}:${wire}`, {
        elementType: metaclass, name: label, parentElementId: `${diagramId}:qubit:${wire}`, rank: 1,
        features: {
          name: value(label),
          symbol: value(symbol),
          ...(gateWires.length > 1 ? { wires: value(gateWires.map((w) => `q${w}`).join(', ')) } : {}),
          ...(controls.length > 0 ? { controls: value(controls.join(', ')) } : {}),
        },
      });
    };
    // Two-wire gates: one per kind, at the first wire carrying it.
    for (const [kindSymbols, metaclass] of PAIR_GATES) {
      const kindWires = symbols.flatMap((symbol, wire) => (symbol && kindSymbols.includes(symbol) ? [wire] : []));
      if (kindWires.length > 0) gate(kindWires[0], metaclass, symbols[kindWires[0]]!, kindWires.slice(0, 2));
      kindWires.forEach((w) => covered.add(w));
    }
    symbols.forEach((symbol, wire) => {
      if (!symbol || covered.has(wire) || CONTROL_SYMBOLS.has(symbol) || PAIR_METACLASS.has(symbol)) return;
      const metadata = model?.gateMetadata?.[`${column}_${wire}`];
      const isFunction = symbol.startsWith('__FUNC__') || metadata?.isFunctionGate === true;
      if (metadata?.nestedCircuit || metadata?.isFunctionGate || isFunction) {
        // A function gate spans `height` wires from this one; without a height, the wires with the same symbol.
        const height = typeof metadata?.height === 'number' && metadata.height > 1 ? Math.floor(metadata.height) : 0;
        const gateWires = height > 0
          ? Array.from({ length: height }, (_, i) => wire + i)
          : symbols.flatMap((other, w) => (w === wire || (isFunction && !metadata && other === symbol) ? [w] : []));
        gate(wire, metadata?.nestedCircuit ? 'FunctionGate' : 'CustomGate', symbol, gateWires);
        return;
      }
      gate(wire, gateMetaclass(symbol), symbol, [wire]);
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

/* ------------------------------------------------------------------ traceable elements */

/**
 * The metaclasses of elements the backend builds no element for, so generated code is never linked to them: the
 * rules marked `traceable: false` in {@link APOLLON_TABLES}, a circuit's qubits, a GUI table's columns (known by
 * their table and field, not by an id), and those an earlier version of the editor recorded (`ControlState`, a
 * control cell, now a gate's `controls`; `Composition` and `LayerOrder`, NN edges before they were named apart). An
 * element of one of these is history only: the Coverage and Requirements views never count it as missing code.
 */
export const UNTRACEABLE_METACLASSES: ReadonlySet<string> = new Set([
  ...Object.values(APOLLON_TABLES).flatMap((table) => [
    ...Object.values(table!.elements).flatMap((rule) =>
      (rule.traceable === false && typeof rule.metaclass === 'string' ? [rule.metaclass] : [])),
    ...(table!.untraceableRelationships ?? []),
  ]),
  'Qubit',
  ...Object.values(COLUMN_METACLASSES),
  'ControlState', 'Composition',
]);

/** Whether generated code can be linked to an element of this metaclass (see {@link UNTRACEABLE_METACLASSES}). */
export const isTraceableType = (elementType: string): boolean => !UNTRACEABLE_METACLASSES.has(elementType);

/**
 * Bring the trace's artifacts of one diagram in line with what the current recording traces, from `snapshot`, the
 * diagram's elements as recorded now. An earlier version of the editor recorded some elements under another
 * metaclass (a reasoning state as an `AgentState`, an agentic task as a `Task`, an NN reference as an `NN`) or
 * recorded elements the backend has no counterpart for (an agent state's actions as `Body` artifacts, the transition
 * from an initial node, a control cell, each wire of a two-wire gate): an artifact whose element is in the snapshot
 * takes its metaclass (a relabelling, not a change of the model), and the changes returned (to record with the
 * diagram's next edit) delete each live artifact the editor recorded that the snapshot no longer has, so it no longer
 * shows as an element without code. Artifacts a generation's trace brought (never created by the editor) are left as
 * they are. Returns no change on a trace already in line, so it costs one pass over the trace per recorded edit.
 */
export function alignDiagramArtifacts(
  trace: TraceFile, diagramId: string, snapshot: Map<string, Snapshot>, previous: Map<string, Snapshot>,
): ElementChange[] {
  const byId = new Map(trace.artifacts.map((a) => [a.id, a]));
  const diagram = trace.artifacts.find((a): a is ModelArtifact => isModelArtifact(a) && a.elementId === diagramId && !a.parentId);
  if (!diagram) return [];
  const lifecycle = new Map<string, ChangeKind>();
  for (const operation of trace.operations) {
    if (operation.type !== 'ModelingSession') continue;
    for (const change of operation.changes) if (change.kind !== 'UPDATED') lifecycle.set(change.artifactId, change.kind);
  }
  const inDiagram = (artifact: TraceArtifact): boolean => {
    let current: TraceArtifact | undefined = artifact;
    for (let steps = 0; current?.parentId && steps < 64; steps += 1) {
      current = byId.get(current.parentId);
      if (current === diagram) return true;
    }
    return false;
  };
  const stale: ElementChange[] = [];
  for (const artifact of trace.artifacts) {
    if (!isModelArtifact(artifact) || artifact === diagram || !inDiagram(artifact)) continue;
    const now = snapshot.get(artifact.elementId);
    if (now) {
      if (now.elementType !== artifact.elementType) artifact.elementType = now.elementType;
      continue;
    }
    // Recorded by the editor, still live, and in neither version: an element the recording no longer traces.
    if (lifecycle.get(artifact.id) !== 'CREATED' || previous.has(artifact.elementId)) continue;
    stale.push({
      kind: 'DELETED', elementId: artifact.elementId, elementType: artifact.elementType, name: artifact.name,
      parentElementId: null, oldValue: artifact.name,
    });
  }
  return stale;
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
