// Temporary: removed when these features are ported to v4.
//
// The derivations (bpmn-to-component, component-to-deployment, lane-to-agent)
// are written against the v3 model (`elements` / `relationships` records,
// absolute `bounds`, `owner`). This module holds the v3 shapes they use and
// is the only place where project models (v4) are converted for them.
import type {
  BesserEdge,
  BesserNode,
  BPMNAgentRole,
  BPMNGatewayRole,
  BPMNReflectionMode,
  BpmnFlowType,
  UMLDiagramType as UMLDiagramTypeValue,
  UMLModel as V4UMLModel,
} from '@besser/wme';
import {
  UMLDiagramType,
  bpmnEdgeTypeToFlowType,
  convertV3EdgeTypeToV4,
  convertV3NodeTypeToV4,
  convertV3ToV4,
  convertV4ToV3Agent,
  normalizeV4Model,
} from '@besser/wme';
import { bpmnModelToComponentModel, type DerivationOpts } from './bpmn-to-component';
import { componentModelToDeploymentModel } from './component-to-deployment';
import { laneToAgentModel } from './lane-to-agent';
import type { AgentDerivationResult, DeploymentDerivationResult, DerivationResult } from './types';

/* ------------------------------------------------------------------------ */
/* v3 model shapes                                                          */
/* ------------------------------------------------------------------------ */

export enum Direction {
  Up = 'Up',
  Right = 'Right',
  Down = 'Down',
  Left = 'Left',
  Upright = 'Upright',
  Upleft = 'Upleft',
  Downright = 'Downright',
  Downleft = 'Downleft',
  Topright = 'Topright',
  Topleft = 'Topleft',
  Bottomright = 'Bottomright',
  Bottomleft = 'Bottomleft',
  Center = 'Center',
}

export type IPoint = { x: number; y: number };
export type IBoundary = { x: number; y: number; width: number; height: number };

export type UMLModelElement = {
  id: string;
  name: string;
  type: string;
  owner: string | null;
  bounds: IBoundary;
  highlight?: string;
  fillColor?: string;
  strokeColor?: string;
  textColor?: string;
  description?: string;
  icon?: string;
  uri?: string;
  assessmentNote?: string;
};

export type UMLModelComponent = Omit<UMLModelElement, 'bounds'> & {
  bounds?: IBoundary;
  [field: string]: unknown;
};

export type UMLElement = UMLModelElement;

export type UMLRelationship = UMLModelElement & {
  path: IPoint[];
  source: { element: string; direction: Direction };
  target: { element: string; direction: Direction };
  isManuallyLayouted?: boolean;
};

export type UMLModel = {
  version: `3.${number}.${number}`;
  type: UMLDiagramTypeValue;
  size: { width: number; height: number };
  elements: { [id: string]: UMLElement };
  interactive: { elements: { [id: string]: boolean }; relationships: { [id: string]: boolean } };
  relationships: { [id: string]: UMLRelationship };
  assessments: { [id: string]: unknown };
  components?: { [id: string]: UMLModelComponent };
  agentComponents?: { [id: string]: UMLModelComponent };
};

export interface AgentModelElement extends UMLModelElement {
  replyType: string;
  ragDatabaseName?: string;
  dbCustomName?: string;
  llm_name?: string;
}

export type AgentStateTransition = UMLRelationship & {
  params?: string | string[];
  transitionType?: 'predefined' | 'custom';
  predefined?: {
    predefinedType?: string;
    intentName?: string;
    fileType?: string;
    conditionValue?: string | { variable: string; operator: string; targetValue: string };
    formGuiId?: string;
  };
  custom?: { event?: string; condition?: string[]; guiEventGuiId?: string };
  predefinedType?: string;
  event?: string;
  condition?: string | string[];
  intentName?: string;
  variable?: string;
  operator?: string;
  targetValue?: string;
  conditionValue?:
    | string
    | { variable: string; operator: string; targetValue: string }
    | { events: string[]; conditions: string[] };
  fileType?: string;
};

export type BPMNSwimlane = UMLElement & {
  isAgentic?: boolean;
  role?: BPMNAgentRole;
  trustScore?: number;
  multiplicity?: number;
  agentDiagramRef?: string;
};

export type BPMNTask = UMLElement & {
  taskType: string;
  marker: string;
  isAgentic?: boolean;
  reflectionMode?: BPMNReflectionMode;
  trustScore?: number;
  agentDiagramRef?: string;
  reflectionReviewerLaneId?: string;
};

export type BPMNGateway = UMLElement & {
  gatewayType: string;
  isAgentic?: boolean;
  gatewayRole?: BPMNGatewayRole;
  trustScore?: number;
  governanceDsl?: string;
};

export type BPMNFlow = UMLRelationship & {
  flowType: BpmnFlowType;
  isDefault?: boolean;
};

export type UMLComponentComponent = UMLElement & {
  stereotype?: string;
  displayStereotype: boolean;
  realizes?: string[];
  processModelRefs?: string[];
  agentModelRef?: string;
};

export type UMLComponentSubsystem = UMLElement & {
  stereotype: string;
  displayStereotype: boolean;
};

export type UMLComponentDependency = UMLRelationship & {
  stereotype?: string;
};

export type UMLDeploymentNode = UMLElement & {
  stereotype: string;
  displayStereotype: boolean;
};

export type UMLDeploymentComponent = UMLElement & {
  stereotype?: string;
  displayStereotype: boolean;
};

export type UMLDeploymentArtifact = UMLElement & {
  manifests?: string[];
  agentModelRef?: string;
};

export type UMLDeploymentAssociation = UMLRelationship & {
  stereotype?: string;
};

/* ------------------------------------------------------------------------ */
/* v4 <-> v3                                                                */
/* ------------------------------------------------------------------------ */

const V3_NODE_TYPES = [
  'BPMNTask',
  'BPMNGateway',
  'BPMNStartEvent',
  'BPMNIntermediateEvent',
  'BPMNEndEvent',
  'BPMNSubprocess',
  'BPMNTransaction',
  'BPMNCallActivity',
  'BPMNAnnotation',
  'BPMNDataObject',
  'BPMNDataStore',
  'BPMNPool',
  'BPMNSwimlane',
  'BPMNGroup',
  'Component',
  'ComponentInterface',
  'Subsystem',
  'DeploymentNode',
  'DeploymentComponent',
  'DeploymentArtifact',
  'DeploymentInterface',
  'ColorLegend',
  'Comments',
];

const V3_EDGE_TYPES = [
  'ComponentDependency',
  'ComponentInterfaceProvided',
  'ComponentInterfaceRequired',
  'ComponentInterfaceRequiredQuarter',
  'ComponentInterfaceRequiredThreeQuarter',
  'DeploymentDependency',
  'DeploymentAssociation',
  'DeploymentInterfaceProvided',
  'DeploymentInterfaceRequired',
  'DeploymentInterfaceRequiredQuarter',
  'DeploymentInterfaceRequiredThreeQuarter',
  'Link',
];

/** v4 node type → v3 element type (inverse of `convertV3NodeTypeToV4`). */
const V4_TO_V3_NODE_TYPE: Record<string, string> = Object.fromEntries(
  V3_NODE_TYPES.map((t) => [convertV3NodeTypeToV4(t), t]),
);

const V4_TO_V3_EDGE_TYPE: Record<string, string> = Object.fromEntries(
  V3_EDGE_TYPES.map((t) => [convertV3EdgeTypeToV4(t), t]),
);

/** v3 element type of a v4 node type; unknown types pass through. */
const legacyNodeType = (v4Type: string): string => V4_TO_V3_NODE_TYPE[v4Type] ?? v4Type;

const HANDLE_TO_DIRECTION: Record<string, Direction> = {
  top: Direction.Up,
  right: Direction.Right,
  bottom: Direction.Down,
  left: Direction.Left,
  'right-top': Direction.Upright,
  'left-top': Direction.Upleft,
  'right-bottom': Direction.Downright,
  'left-bottom': Direction.Downleft,
};

const SIDE_TO_DIRECTION: Record<string, Direction> = {
  top: Direction.Up,
  bottom: Direction.Down,
  left: Direction.Left,
  right: Direction.Right,
};

function handleToDirection(handle: string | undefined | null): Direction {
  if (!handle) return Direction.Center;
  return HANDLE_TO_DIRECTION[handle] ?? SIDE_TO_DIRECTION[handle.split('-')[0]] ?? Direction.Center;
}

const HEADER_FLAGS = ['isComponentHeaderShown', 'isComponentSubsystemHeaderShown'] as const;

function absolutePosition(node: BesserNode, byId: Map<string, BesserNode>): IPoint {
  let { x, y } = node.position;
  const seen = new Set([node.id]);
  let parent = node.parentId ? byId.get(node.parentId) : undefined;
  while (parent && !seen.has(parent.id)) {
    seen.add(parent.id);
    x += parent.position.x;
    y += parent.position.y;
    parent = parent.parentId ? byId.get(parent.parentId) : undefined;
  }
  return { x, y };
}

function nodeToElement(node: BesserNode, byId: Map<string, BesserNode>): UMLElement {
  const data = { ...(node.data ?? {}) } as Record<string, unknown>;
  const headerFlag = HEADER_FLAGS.find((flag) => typeof data[flag] === 'boolean');
  const displayStereotype = headerFlag ? (data[headerFlag] as boolean) : undefined;
  for (const flag of HEADER_FLAGS) delete data[flag];
  return {
    ...data,
    id: node.id,
    name: typeof data.name === 'string' ? data.name : '',
    type: legacyNodeType(node.type),
    owner: node.parentId && byId.has(node.parentId) ? node.parentId : null,
    bounds: { ...absolutePosition(node, byId), width: node.width ?? 0, height: node.height ?? 0 },
    ...(displayStereotype !== undefined && { displayStereotype }),
  };
}

const centerOf = (el: UMLElement | undefined): IPoint =>
  el ? { x: el.bounds.x + el.bounds.width / 2, y: el.bounds.y + el.bounds.height / 2 } : { x: 0, y: 0 };

function edgeToRelationship(edge: BesserEdge, elements: Record<string, UMLElement>): UMLRelationship {
  const { points, label, name, ...rest } = (edge.data ?? {}) as Record<string, unknown>;
  const absolute: IPoint[] =
    Array.isArray(points) && points.length >= 2
      ? (points as IPoint[])
      : [centerOf(elements[edge.source]), centerOf(elements[edge.target])];
  const minX = Math.min(...absolute.map((p) => p.x));
  const minY = Math.min(...absolute.map((p) => p.y));
  const maxX = Math.max(...absolute.map((p) => p.x));
  const maxY = Math.max(...absolute.map((p) => p.y));
  const flowType = bpmnEdgeTypeToFlowType(edge.type);
  return {
    ...rest,
    id: edge.id,
    name: typeof name === 'string' ? name : typeof label === 'string' ? label : '',
    type: flowType ? 'BPMNFlow' : (V4_TO_V3_EDGE_TYPE[edge.type] ?? edge.type),
    owner: null,
    bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
    path: absolute.map((p) => ({ x: p.x - minX, y: p.y - minY })),
    source: { element: edge.source, direction: handleToDirection(edge.sourceHandle) },
    target: { element: edge.target, direction: handleToDirection(edge.targetHandle) },
    ...(flowType && { flowType }),
  };
}

/**
 * v4 model → the v3 shape the derivations read. Agent diagrams go through
 * the library inverse; BPMN / Component / Deployment through a generic one
 * (absolute bounds, `owner` = `parentId`, node / edge data spread under the
 * same names, header switches → `displayStereotype`).
 */
export function toLegacyV3(model: V4UMLModel): UMLModel {
  if (model.type === UMLDiagramType.AgentDiagram) {
    return convertV4ToV3Agent(model) as unknown as UMLModel;
  }
  const nodes = model.nodes ?? [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const elements: Record<string, UMLElement> = {};
  for (const node of nodes) elements[node.id] = nodeToElement(node, byId);
  const relationships: Record<string, UMLRelationship> = {};
  for (const edge of model.edges ?? []) relationships[edge.id] = edgeToRelationship(edge, elements);
  return {
    version: '3.0.0',
    type: model.type,
    size: { width: 0, height: 0 },
    interactive: {
      elements: { ...(model.interactive?.elements ?? {}) },
      relationships: { ...(model.interactive?.relationships ?? {}) },
    },
    elements,
    relationships,
    assessments: { ...(model.assessments ?? {}) },
    ...(model.components && { components: model.components as UMLModel['components'] }),
  };
}

/** v3 derivation output → v4 project model. */
export function fromLegacyV3(model: UMLModel): V4UMLModel {
  return normalizeV4Model(convertV3ToV4(model as unknown as Parameters<typeof convertV3ToV4>[0]));
}

/* ------------------------------------------------------------------------ */
/* v4 wrappers around the derivations                                       */
/* ------------------------------------------------------------------------ */

/** A derivation result whose `model` is the v4 project model. */
export type V4Result<R> = R extends { ok: true; model: UMLModel } ? Omit<R, 'model'> & { model: V4UMLModel } : R;

export type ComponentDerivationResult = V4Result<DerivationResult>;
export type DeploymentDerivationV4Result = V4Result<DeploymentDerivationResult>;
export type AgentDerivationV4Result = V4Result<AgentDerivationResult>;

export type ComponentDerivationOpts = Omit<DerivationOpts, 'agentDiagramsById'> & {
  agentDiagramsById?: Map<string, V4UMLModel>;
};

/**
 * A derived (v3) model as the derivation hooks store it. The derivations emit
 * centre-to-centre placeholder paths and leave the routing to the editor, so
 * the edges carry no points and the editor routes them from their ports.
 */
export function derivedToV4(model: UMLModel): V4UMLModel {
  const v4 = fromLegacyV3(model);
  return { ...v4, edges: v4.edges.map((edge) => ({ ...edge, data: { ...edge.data, points: [] } })) };
}

function liftResult<R extends { ok: boolean }>(result: R): V4Result<R> {
  if (!result.ok) return result as V4Result<R>;
  const ok = result as R & { model: UMLModel };
  return { ...ok, model: derivedToV4(ok.model) } as unknown as V4Result<R>;
}

/** BPMN (v4) → Component diagram (v4). */
export function deriveComponentModel(bpmn: V4UMLModel, opts?: ComponentDerivationOpts): ComponentDerivationResult {
  const agentDiagramsById = opts?.agentDiagramsById
    ? new Map([...opts.agentDiagramsById].map(([id, m]) => [id, toLegacyV3(m)]))
    : undefined;
  return liftResult(bpmnModelToComponentModel(toLegacyV3(bpmn), { ...opts, agentDiagramsById }));
}

/** Component diagram (v4) → Deployment diagram (v4). */
export function deriveDeploymentModel(
  component: V4UMLModel,
  multiplicityByComponentId: Record<string, number> = {},
): DeploymentDerivationV4Result {
  return liftResult(componentModelToDeploymentModel(toLegacyV3(component), multiplicityByComponentId));
}

/** One agentic BPMN lane (v4) → Agent diagram (v4). */
export function deriveAgentModel(bpmn: V4UMLModel, laneId: string): AgentDerivationV4Result {
  return liftResult(laneToAgentModel(toLegacyV3(bpmn), laneId));
}
