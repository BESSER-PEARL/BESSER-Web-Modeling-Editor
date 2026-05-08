import { NodeTypes } from "@xyflow/react" // Explicitly differentiate imported type
import { Class, ColorDescription } from "./classDiagram"
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
} from "./bpmn"
import { ReachabilityGraphMarking } from "./reachabilityGraphDiagram"
import {
  SfcStart,
  SfcStep,
  SfcActionTable,
  SfcTransitionBranch,
  SfcJump,
} from "./sfcDiagram"

/**
 * Default React-Flow node-type registry shipped with upstream Apollon.
 * The exported `diagramNodeTypes` is a **live, mutable view** of this
 * registry plus any types BESSER (or other consumers) register at runtime
 * via `registerNodeTypes`. Read sites (`App.tsx`, ReactFlow's `nodeTypes`
 * prop) should consume `diagramNodeTypes` directly so additions take
 * effect on next render.
 */
const defaultNodeTypes = {
  package: Package,
  class: Class,
  objectName: ObjectName,
  communicationObjectName: CommunicationObjectName,
  colorDescription: ColorDescription,
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
// upstream key set stays visible in the type system. Custom types registered
// via `registerNodeTypes` widen the runtime registry but pass through as
// arbitrary strings — consumers cast to `DiagramNodeType` at the boundary.
export type DiagramNodeType = keyof typeof defaultNodeTypes

// 3. Enum-like object (manually declared once, same keys)
export const DiagramNodeTypeRecord: Record<DiagramNodeType, DiagramNodeType> = {
  package: "package",
  class: "class",
  objectName: "objectName",
  communicationObjectName: "communicationObjectName",
  colorDescription: "colorDescription",
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
  bpmnGroup: "bpmnGroup",
  reachabilityGraphMarking: "reachabilityGraphMarking",
  sfcStart: "sfcStart",
  sfcStep: "sfcStep",
  sfcActionTable: "sfcActionTable",
  sfcTransitionBranch: "sfcTransitionBranch",
  sfcJump: "sfcJump",
} as const
