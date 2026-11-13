import { NodeTypes } from "@xyflow/react" // Explicitly differentiate imported type
import { Class, ColorDescription, ClassOCLConstraintNode } from "./classDiagram"
import { Comment } from "./common"
import { ObjectName } from "./objectDiagram"
import { CommunicationObjectName } from "./communicationDiagram"
import { TitleAndDesctiption } from "./TitleAndDescriptionNode"
import Package from "./classDiagram/Package"
import {
  Activity,
  ActivityInitialNode,
  ActivityFinalNode,
  ActivityActionNode,
  ActivityObjectNode,
  ActivityMergeNode,
  ActivityForkNode,
  ActivityForkNodeHorizontal,
} from "./activityDiagram"
import { UseCase, UseCaseActor, UseCaseSystem } from "./useCaseDiagram"
import {
  Component,
  ComponentInterface,
  ComponentSubsystem,
} from "./componentDiagram"
import {
  DeploymentNode,
  DeploymentComponent,
  DeploymentArtifact,
  DeploymentInterface,
} from "./deploymentDiagram"
import {
  FlowchartTerminal,
  FlowchartProcess,
  FlowchartDecision,
  FlowchartInputOutput,
  FlowchartFunctionCall,
} from "./flowchart"
import { SyntaxTreeTerminal } from "./syntaxTreeDiagram/SyntaxTreeTerminal"
import { SyntaxTreeNonterminal } from "./syntaxTreeDiagram/SyntaxTreeNonterminal"
import { PetriNetTransition, PetriNetPlace } from "./petriNetDiagram"
import {
  BPMNTask,
  BPMNStartEvent,
  BPMNIntermediateEvent,
  BPMNEndEvent,
  BPMNGateway,
  BPMNSubprocess,
  BPMNTransaction,
  BPMNCallActivity,
  BPMNAnnotation,
  BPMNDataObject,
  BPMNDataStore,
  BPMNPool,
  BPMNGroup,
  BPMNSwimlane,
} from "./bpmn"
import { ReachabilityGraphMarking } from "./reachabilityGraphDiagram"
import {
  SfcStart,
  SfcStep,
  SfcActionTable,
  SfcTransitionBranch,
  SfcJump,
} from "./sfcDiagram"
// Type-only: agentDiagram/nnDiagram/stateMachineDiagram/userDiagram register
// their components into the runtime registry via `registerNodeTypes` (see
// each barrel's own file) rather than through `defaultNodeTypes` below, to
// avoid a circular import (those barrels import `registerNodeTypes` from
// this file). A type-only import has no runtime footprint, so it's safe to
// pull their node-type keys in here to keep `DiagramNodeType` accurate.
import type { AgentDiagramNodeType } from "./agentDiagram"
import type { NNDiagramNodeType } from "./nnDiagram"
import type { StateMachineDiagramNodeType } from "./stateMachineDiagram"
import type { UserDiagramNodeType } from "./userDiagram"

/**
 * Default React-Flow node-type registry shipped with BESSER WME.
 * The exported `diagramNodeTypes` is a **live, mutable view** of this
 * registry plus any types BESSER (or other consumers) register at runtime
 * via `registerNodeTypes`. Read sites (`App.tsx`, ReactFlow's `nodeTypes`
 * prop) should consume `diagramNodeTypes` directly so additions take
 * effect on next render.
 */
const defaultNodeTypes = {
  package: Package,
  class: Class,
  // Free-standing OCL constraint as a sticky-note shape.
  ClassOCLConstraint: ClassOCLConstraintNode,
  objectName: ObjectName,
  communicationObjectName: CommunicationObjectName,
  colorDescription: ColorDescription,
  // Free-form sticky-note Comment node, ported from
  // v3 `common/comments`. Available across all diagram types so
  // designers can annotate any model.
  comment: Comment,
  titleAndDesctiption: TitleAndDesctiption,
  activity: Activity,
  activityInitialNode: ActivityInitialNode,
  activityFinalNode: ActivityFinalNode,
  activityActionNode: ActivityActionNode,
  activityObjectNode: ActivityObjectNode,
  activityMergeNode: ActivityMergeNode,
  activityForkNode: ActivityForkNode,
  activityForkNodeHorizontal: ActivityForkNodeHorizontal,
  useCase: UseCase,
  useCaseActor: UseCaseActor,
  useCaseSystem: UseCaseSystem,
  component: Component,
  componentInterface: ComponentInterface,
  componentSubsystem: ComponentSubsystem,
  deploymentNode: DeploymentNode,
  deploymentComponent: DeploymentComponent,
  deploymentArtifact: DeploymentArtifact,
  deploymentInterface: DeploymentInterface,
  flowchartTerminal: FlowchartTerminal,
  flowchartProcess: FlowchartProcess,
  flowchartDecision: FlowchartDecision,
  flowchartInputOutput: FlowchartInputOutput,
  flowchartFunctionCall: FlowchartFunctionCall,
  syntaxTreeTerminal: SyntaxTreeTerminal,
  syntaxTreeNonterminal: SyntaxTreeNonterminal,
  petriNetTransition: PetriNetTransition,
  petriNetPlace: PetriNetPlace,
  bpmnTask: BPMNTask,
  bpmnStartEvent: BPMNStartEvent,
  bpmnIntermediateEvent: BPMNIntermediateEvent,
  bpmnEndEvent: BPMNEndEvent,
  bpmnGateway: BPMNGateway,
  bpmnSubprocess: BPMNSubprocess,
  bpmnTransaction: BPMNTransaction,
  bpmnCallActivity: BPMNCallActivity,
  bpmnAnnotation: BPMNAnnotation,
  bpmnDataObject: BPMNDataObject,
  bpmnDataStore: BPMNDataStore,
  bpmnPool: BPMNPool,
  bpmnSwimlane: BPMNSwimlane,
  bpmnGroup: BPMNGroup,
  reachabilityGraphMarking: ReachabilityGraphMarking,
  sfcStart: SfcStart,
  sfcStep: SfcStep,
  sfcActionTable: SfcActionTable,
  sfcTransitionBranch: SfcTransitionBranch,
  sfcJump: SfcJump,
} satisfies NodeTypes

/**
 * Mutable registry. Defaults are seeded from `defaultNodeTypes`; consumers
 * extend it via `registerNodeTypes`. We deliberately keep the *same object
 * reference* so consumers reading `diagramNodeTypes` once still see updates.
 */
const _nodeTypeRegistry: NodeTypes = { ...defaultNodeTypes }

/**
 * Register additional node types. Existing entries are overwritten — this is
 * intentional, so BESSER can swap an upstream stock node out for a custom
 * implementation if needed.
 */
export const registerNodeTypes = (custom: NodeTypes): void => {
  for (const [key, value] of Object.entries(custom)) {
    _nodeTypeRegistry[key] = value
  }
}

/**
 * The merged node-type registry. Read sites pass this object to
 * `<ReactFlow nodeTypes={diagramNodeTypes} />`.
 */
export const diagramNodeTypes: NodeTypes = _nodeTypeRegistry

// 2. Union type from keys.
// Bound to `defaultNodeTypes` (not `diagramNodeTypes`) so that the canonical
// upstream key set stays visible in the type system, plus the node-type
// keys of the four diagram packages that self-register at import time
// (agent/nn/stateMachine/user — see the type-only imports above). Any
// further `registerNodeTypes` caller still widens the *runtime* registry
// but passes through as an arbitrary string — consumers cast to
// `DiagramNodeType` at the boundary in that case.
export type DiagramNodeType =
  | keyof typeof defaultNodeTypes
  | AgentDiagramNodeType
  | NNDiagramNodeType
  | StateMachineDiagramNodeType
  | UserDiagramNodeType

// 3. Enum-like object (manually declared once, same keys as `defaultNodeTypes`
// plus the four self-registering diagram packages above).
export const DiagramNodeTypeRecord: Record<DiagramNodeType, DiagramNodeType> = {
  package: "package",
  class: "class",
  ClassOCLConstraint: "ClassOCLConstraint",
  objectName: "objectName",
  communicationObjectName: "communicationObjectName",
  colorDescription: "colorDescription",
  comment: "comment",
  titleAndDesctiption: "titleAndDesctiption",
  activity: "activity",
  activityInitialNode: "activityInitialNode",
  activityFinalNode: "activityFinalNode",
  activityActionNode: "activityActionNode",
  activityObjectNode: "activityObjectNode",
  activityMergeNode: "activityMergeNode",
  activityForkNode: "activityForkNode",
  activityForkNodeHorizontal: "activityForkNodeHorizontal",
  useCase: "useCase",
  useCaseActor: "useCaseActor",
  useCaseSystem: "useCaseSystem",
  component: "component",
  componentInterface: "componentInterface",
  componentSubsystem: "componentSubsystem",
  deploymentNode: "deploymentNode",
  deploymentComponent: "deploymentComponent",
  deploymentArtifact: "deploymentArtifact",
  deploymentInterface: "deploymentInterface",
  flowchartTerminal: "flowchartTerminal",
  flowchartProcess: "flowchartProcess",
  flowchartDecision: "flowchartDecision",
  flowchartInputOutput: "flowchartInputOutput",
  flowchartFunctionCall: "flowchartFunctionCall",
  syntaxTreeTerminal: "syntaxTreeTerminal",
  syntaxTreeNonterminal: "syntaxTreeNonterminal",
  petriNetTransition: "petriNetTransition",
  petriNetPlace: "petriNetPlace",
  bpmnTask: "bpmnTask",
  bpmnStartEvent: "bpmnStartEvent",
  bpmnIntermediateEvent: "bpmnIntermediateEvent",
  bpmnEndEvent: "bpmnEndEvent",
  bpmnGateway: "bpmnGateway",
  bpmnSubprocess: "bpmnSubprocess",
  bpmnTransaction: "bpmnTransaction",
  bpmnCallActivity: "bpmnCallActivity",
  bpmnAnnotation: "bpmnAnnotation",
  bpmnDataObject: "bpmnDataObject",
  bpmnDataStore: "bpmnDataStore",
  bpmnPool: "bpmnPool",
  bpmnSwimlane: "bpmnSwimlane",
  bpmnGroup: "bpmnGroup",
  reachabilityGraphMarking: "reachabilityGraphMarking",
  sfcStart: "sfcStart",
  sfcStep: "sfcStep",
  sfcActionTable: "sfcActionTable",
  sfcTransitionBranch: "sfcTransitionBranch",
  sfcJump: "sfcJump",
  AgentState: "AgentState",
  AgentIntent: "AgentIntent",
  AgentRagElement: "AgentRagElement",
  AgentTool: "AgentTool",
  AgentSkill: "AgentSkill",
  AgentWorkspace: "AgentWorkspace",
  AgentLLM: "AgentLLM",
  Conv1DLayer: "Conv1DLayer",
  Conv2DLayer: "Conv2DLayer",
  Conv3DLayer: "Conv3DLayer",
  PoolingLayer: "PoolingLayer",
  RNNLayer: "RNNLayer",
  LSTMLayer: "LSTMLayer",
  GRULayer: "GRULayer",
  LinearLayer: "LinearLayer",
  FlattenLayer: "FlattenLayer",
  EmbeddingLayer: "EmbeddingLayer",
  DropoutLayer: "DropoutLayer",
  LayerNormalizationLayer: "LayerNormalizationLayer",
  BatchNormalizationLayer: "BatchNormalizationLayer",
  TensorOp: "TensorOp",
  Configuration: "Configuration",
  TrainingDataset: "TrainingDataset",
  TestDataset: "TestDataset",
  NNContainer: "NNContainer",
  NNReference: "NNReference",
  State: "State",
  StateBody: "StateBody",
  StateFallbackBody: "StateFallbackBody",
  StateCodeBlock: "StateCodeBlock",
  StateActionNode: "StateActionNode",
  StateObjectNode: "StateObjectNode",
  StateInitialNode: "StateInitialNode",
  StateFinalNode: "StateFinalNode",
  StateMergeNode: "StateMergeNode",
  StateForkNode: "StateForkNode",
  StateForkNodeHorizontal: "StateForkNodeHorizontal",
  UserModelName: "UserModelName",
  UserModelAttribute: "UserModelAttribute",
  UserModelIcon: "UserModelIcon",
} as const
