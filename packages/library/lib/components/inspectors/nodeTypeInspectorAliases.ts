import { registerInspectorAliases } from "./registry"

/**
 * React-Flow `node.type` → inspector registry key.
 *
 * The inspector registry is keyed by the popover type each node component
 * passes to `PopoverManager` (`"default"`, `"Component"`, `"BPMNTask"`, …),
 * but the right-side `PropertiesPanel` — the DEFAULT editing surface
 * (`settingsService.usePropertiesPanel` defaults to `true`) — looks up the
 * element's React-Flow `node.type`, which for most stock diagrams is
 * camelCase (`package`, `activityActionNode`, `bpmnTask`, …). Without these
 * aliases `getInspector("package", "edit")` returned `null` and the panel
 * never opened for those nodes.
 *
 * Targets mirror v3 `packages/popups.ts` (smart-generator): a type-specific
 * update form where v3 had one, otherwise the name + colours `DefaultPopup`
 * (`"default"` → `DefaultNodeEditPopover`). Aliases resolve at lookup time,
 * and cover every inspector kind (edit / feedbackGive / feedbackSee).
 *
 * Deliberately absent (v3 mapped them to `null` / never had an editor):
 * `UserModelIcon`, `titleAndDesctiption`, `sfcTransitionBranch`.
 * `activityMergeNode` registers its own dedicated panel (per-outgoing-flow
 * decisions, v3 `UMLActivityMergeNodeUpdate`) under its node type.
 */
export const NODE_TYPE_INSPECTOR_ALIASES: Readonly<Record<string, string>> = {
  // ClassDiagram
  package: "default",
  colorDescription: "default",

  // ActivityDiagram (activityMergeNode has its own panel)
  activity: "default",
  activityInitialNode: "default",
  activityFinalNode: "default",
  activityActionNode: "default",
  activityObjectNode: "default",
  activityForkNode: "default",
  activityForkNodeHorizontal: "default",

  // UseCaseDiagram
  useCase: "default",
  useCaseActor: "default",
  useCaseSystem: "default",

  // ComponentDiagram
  component: "Component",
  componentInterface: "default",
  componentSubsystem: "ComponentSubsystem",

  // DeploymentDiagram
  deploymentNode: "DeploymentNode",
  deploymentComponent: "DeploymentComponent",
  deploymentArtifact: "default",
  deploymentInterface: "default",

  // Flowchart
  flowchartTerminal: "FlowchartTerminal",
  flowchartProcess: "FlowchartProcess",
  flowchartDecision: "FlowchartDecision",
  flowchartInputOutput: "FlowchartInputOutput",
  flowchartFunctionCall: "FlowchartFunctionCall",

  // SyntaxTree
  syntaxTreeTerminal: "SyntaxTreeTerminal",
  syntaxTreeNonterminal: "SyntaxTreeNonterminal",

  // PetriNet
  petriNetPlace: "PetriNetPlace",
  petriNetTransition: "default",

  // ReachabilityGraph
  reachabilityGraphMarking: "ReachabilityGraphMarking",

  // SFC
  sfcStart: "default",
  sfcStep: "default",
  sfcJump: "default",
  sfcActionTable: "SfcActionTable",

  // BPMN
  bpmnTask: "BPMNTask",
  bpmnStartEvent: "BPMNStartEvent",
  bpmnIntermediateEvent: "BPMNIntermediateEvent",
  bpmnEndEvent: "BPMNEndEvent",
  bpmnGateway: "BPMNGateway",
  bpmnSubprocess: "BPMNSubprocess",
  bpmnTransaction: "BPMNTransaction",
  bpmnCallActivity: "BPMNCallActivity",
  bpmnAnnotation: "BPMNAnnotation",
  bpmnDataObject: "BPMNDataObject",
  bpmnDataStore: "BPMNDataStore",
  bpmnPool: "BPMNPool",
  bpmnSwimlane: "BPMNSwimlane",
  bpmnGroup: "BPMNGroup",
}

registerInspectorAliases(NODE_TYPE_INSPECTOR_ALIASES)
