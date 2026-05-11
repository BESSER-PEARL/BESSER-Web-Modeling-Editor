/**
 * Central, immutable constants for BESSER WME.
 * Grouped by domain, deep-frozen. Import from "@/constants".
 */
import React from "react"
import {
  ActivityActionNodeSVG,
  ActivityFinalNodeSVG,
  ActivityForkNodeHorizontalSVG,
  ActivityForkNodeSVG,
  ActivityInitialNodeSVG,
  ActivityMergeNodeSVG,
  ActivityObjectNodeSVG,
  ActivitySVG,
  ClassSVG,
  ClassOCLConstraintSVG,
  UseCaseNodeSVG,
  UseCaseSystemNodeSVG,
  UseCaseActorNodeSVG,
  ComponentNodeSVG,
  ComponentInterfaceNodeSVG,
  ComponentSubsystemNodeSVG,
  FlowchartTerminalNodeSVG,
  FlowchartProcessNodeSVG,
  FlowchartDecisionNodeSVG,
  FlowchartInputOutputNodeSVG,
  FlowchartFunctionCallNodeSVG,
  DeploymentNodeSVG,
  DeploymentComponentSVG,
  DeploymentArtifactSVG,
  DeploymentInterfaceSVG,
  SyntaxTreeNonterminalNodeSVG,
  SyntaxTreeTerminalNodeSVG,
  ObjectNameSVG,
  CommunicationObjectNameSVG,
  PetriNetPlaceSVG,
  PetriNetTransitionSVG,
  BPMNTaskNodeSVG,
  BPMNEventNodeSVG,
  BPMNGatewayNodeSVG,
  BPMNSubprocessNodeSVG,
  BPMNAnnotationNodeSVG,
  BPMNDataObjectNodeSVG,
  BPMNDataStoreNodeSVG,
  BPMNPoolNodeSVG,
  BPMNGroupNodeSVG,
  SfcStartNodeSVG,
  SfcStepNodeSVG,
  SfcJumpNodeSVG,
  SfcTransitionBranchNodeSVG,
  SfcActionTableNodeSVG,
} from "@/components"
import { ReachabilityGraphMarkingSVG } from "@/components/svgs/nodes/reachabilityGraphDiagram/ReachabilityGraphMarkingSVG"
import {
  StateSVG,
  StateInitialNodeSVG,
  StateFinalNodeSVG,
  StateCodeBlockSVG,
} from "@/components/svgs/nodes/stateMachineDiagram"
// SA-4 / SA-FIX-AGENT-OCL: AgentDiagram + UserDiagram palette previews.
// `AgentIntentObjectComponent` was removed from the palette — it is a
// child-of-AgentIntent slot row, not a top-level draggable. Its SVG
// remains importable from `@/components/svgs/nodes/agentDiagram` for
// the inline canvas rendering of folded entity-slot rows.
import {
  AgentStateSVG,
  AgentIntentSVG,
  AgentRagElementSVG,
} from "@/components/svgs/nodes/agentDiagram"
import {
  UserModelStaticPreviewSVG,
  getUserModelNamePaletteEntries,
} from "@/components/svgs/nodes/userDiagram"
// SA-5: NNDiagram palette previews. Inlined alongside the other BESSER
// SVGs per SA-3's pattern (avoids the TDZ cycle that direct
// `registerPaletteEntry` side-effects would trigger).
import {
  Conv1DLayerSVG,
  Conv2DLayerSVG,
  Conv3DLayerSVG,
  PoolingLayerSVG,
  RNNLayerSVG,
  LSTMLayerSVG,
  GRULayerSVG,
  LinearLayerSVG,
  FlattenLayerSVG,
  EmbeddingLayerSVG,
  DropoutLayerSVG,
  LayerNormalizationLayerSVG,
  BatchNormalizationLayerSVG,
  TensorOpSVG,
  ConfigurationSVG,
  TrainingDatasetSVG,
  TestDatasetSVG,
  NNContainerSVG,
  NNReferenceSVG,
} from "@/components/svgs/nodes/nnDiagram"
import { DiagramNodeType } from "@/nodes"
import { ClassType, UMLDiagramType } from "@/types"
import { v4 as uuidv4 } from "uuid"

/* -------------------------------------------------------------------------- */
/* Canvas                                                                     */
/* -------------------------------------------------------------------------- */
export const CANVAS = Object.freeze({
  MIN_SCALE_TO_ZOOM_OUT: 0.4,
  MAX_SCALE_TO_ZOOM_IN: 2.5,
  MOUSE_UP_OFFSET_PX: 5,
  SNAP_TO_GRID_PX: 10,
  EXTRA_SPACE_FOR_EXTENSION: 10,
  PASTE_OFFSET_PX: 20,
} as const)

/* -------------------------------------------------------------------------- */
/* Theme                                                                      */
/* -------------------------------------------------------------------------- */
export const CSS_VARIABLE_FALLBACKS: Readonly<Record<string, string>> =
  Object.freeze({
    "--besser-primary": "#3e8acc",
    "--besser-primary-contrast": "#000000",
    "--besser-secondary": "#6c757d",
    "--besser-alert-warning-yellow": "#ffc107",
    "--besser-alert-warning-background": "#fff3cd",
    "--besser-alert-warning-border": "#ffeeba",
    "--besser-interactive-selection": "#f39c12",
    "--besser-background": "#ffffff",
    "--besser-background-inverse": "#000000",
    "--besser-background-variant": "#f8f9fa",
    "--besser-gray": "#e9ecef",
    "--besser-grid": "rgba(36, 39, 36, 0.1)",
    "--besser-gray-variant": "#495057",
    "--besser-alert-danger-color": "#721c24",
    "--besser-alert-danger-background": "#f8d7da",
    "--besser-alert-danger-border": "#f5c6cb",
    "--besser-switch-box-border-color": "#dee2e6",
    "--besser-list-group-color": "#ffffff",
    "--besser-btn-outline-secondary-color": "#6c757d",
    "--besser-modal-bottom-border": "#e9ecef",
  })

export const STROKE_COLOR = CSS_VARIABLE_FALLBACKS["--besser-primary-contrast"]
export const FILL_COLOR = CSS_VARIABLE_FALLBACKS["--besser-background"]
export const INTERACTIVE_SELECTION_COLOR = `var(--besser-interactive-selection, ${CSS_VARIABLE_FALLBACKS["--besser-interactive-selection"]})`
export const INTERACTIVE_SELECTION_FILL = `color-mix(in srgb, var(--besser-interactive-selection, ${CSS_VARIABLE_FALLBACKS["--besser-interactive-selection"]}) 18%, transparent)`

/* -------------------------------------------------------------------------- */
/* Layout                                                                     */
/* -------------------------------------------------------------------------- */
export const LAYOUT = Object.freeze({
  DEFAULT_FONT:
    "400 16px Inter, system-ui, Avenir, Helvetica, Arial, sans-serif",
  DEFAULT_HEADER_HEIGHT: 40,
  DEFAULT_HEADER_HEIGHT_WITH_STEREOTYPE: 50,
  DEFAULT_ATTRIBUTE_HEIGHT: 30,
  DEFAULT_METHOD_HEIGHT: 30,
  DEFAULT_PADDING: 10,
  LINE_WIDTH: 2,
  LINE_WIDTH_INTERFACE: 2,
  LINE_WIDTH_EDGE: 2,
  ICON_LINE_WIDTH: 1.5,
  /**
   * Typography tokens for wrapped node labels. `NAME_FONT_SIZE` matches the
   * SVG `<text>` browser default so un-styled labels don't visibly shrink,
   * and `NAME_LINE_HEIGHT` is `round(16 * 1.2)` — what pretext uses internally
   * and what `MultilineText` falls back to when no explicit line-height is
   * passed. Used by every node that wraps its label.
   */
  NAME_FONT_SIZE: 16,
  NAME_LINE_HEIGHT: 19,
  /** Stereotype tspans like `«component»` render at 0.8em of the name font. */
  STEREOTYPE_LINE_HEIGHT: 15,
  STEREOTYPE_NAME_GAP: 4,
} as const)

const generateUUID = () => uuidv4()

export const INTERFACE_SIZE = 30
export const INTERFACE_RADIUS = INTERFACE_SIZE / 2
export const INTERFACE_STROKE_WIDTH = 2
export const INTERFACE_SOCKET_GAP = 4

export const INTERFACE = Object.freeze({
  SIZE: INTERFACE_SIZE,
  RADIUS: INTERFACE_RADIUS,
  STROKE_WIDTH: INTERFACE_STROKE_WIDTH,
  SOCKET_GAP: INTERFACE_SOCKET_GAP,
} as const)

/* -------------------------------------------------------------------------- */
/* Edges                                                                      */
/* -------------------------------------------------------------------------- */
// Base marker sizes (exported for reference in marker configs)
export const MARKER_BASE_SIZE = 18
export const BPMN_MARKER_SIZE = 11

export const EDGES = Object.freeze({
  /** Negative padding extends target point to node boundary (React Flow handles are offset 3px) */
  MARKER_PADDING: -3,
  /** Positive padding pulls source point back to node boundary (React Flow handles are offset 3px from node edge) */
  SOURCE_CONNECTION_POINT_PADDING: 3,
  /** Border radius for step-style edge corners */
  STEP_BORDER_RADIUS: 0,
  /** Width of the invisible stroke used for edge selection/highlighting */
  EDGE_HIGHLIGHT_STROKE_WIDTH: 15,
} as const)

/* -------------------------------------------------------------------------- */
/* Z-Index                                                                    */
/* -------------------------------------------------------------------------- */
export const ZINDEX = Object.freeze({
  BASE: 0,
  HEADER_SWITCH: 1,
  DRAGGABLE_GHOST: 2,
  MINIMAP: 5,
  PANEL: 10,
  MODAL: 9998,
  LABEL: 9998,
  DRAGGABLE_ELEMENT: 9999,
  TOOLTIP: 10000,
} as const)

/* -------------------------------------------------------------------------- */
/* Markers                                                                    */
/* -------------------------------------------------------------------------- */
export type MarkerShape =
  | "triangle"
  | "arrow"
  | "rhombus"
  | "circle"
  | "semicircle"

export interface MarkerConfig {
  readonly type: MarkerShape
  readonly filled: boolean
  readonly size: number
  readonly widthFactor: number
  readonly heightFactor: number
  readonly arcSpanDegrees?: number // Only for semicircle type: arc span in degrees
}

// Interface socket markers - radius derived from INTERFACE.RADIUS
const INTERFACE_SOCKET_SIZE = INTERFACE_RADIUS // Must equal INTERFACE.SIZE / 2

export const MARKER_CONFIGS = Object.freeze({
  // Class diagram markers - golden ratio inspired proportions
  "black-rhombus": {
    type: "rhombus",
    filled: true,
    size: MARKER_BASE_SIZE,
    widthFactor: 1.0,
    heightFactor: 0.618,
  },
  "white-rhombus": {
    type: "rhombus",
    filled: false,
    size: MARKER_BASE_SIZE,
    widthFactor: 1.0,
    heightFactor: 0.618,
  },
  "white-triangle": {
    type: "triangle",
    filled: false,
    size: MARKER_BASE_SIZE,
    widthFactor: 1.0,
    heightFactor: 0.866,
  },
  "black-triangle": {
    type: "triangle",
    filled: true,
    size: MARKER_BASE_SIZE,
    widthFactor: 1.0,
    heightFactor: 0.866,
  },
  "black-arrow": {
    type: "arrow",
    filled: false,
    size: MARKER_BASE_SIZE,
    widthFactor: 1.0,
    heightFactor: 0.866,
  },
  // Component/Deployment diagram - interface socket
  // Size = interface radius so arc perfectly overlaps the interface circle
  "required-interface": {
    type: "semicircle",
    filled: false,
    size: INTERFACE_SOCKET_SIZE,
    widthFactor: 1,
    heightFactor: 1,
    arcSpanDegrees: 150,
  },
  "required-interface-quarter": {
    type: "semicircle",
    filled: false,
    size: INTERFACE_SOCKET_SIZE,
    widthFactor: 1,
    heightFactor: 1,
    arcSpanDegrees: 90,
  },
  "required-interface-threequarter": {
    type: "semicircle",
    filled: false,
    size: INTERFACE_SOCKET_SIZE,
    widthFactor: 1,
    heightFactor: 1,
    arcSpanDegrees: 270,
  },
  // BPMN markers - compact style
  "bpmn-white-triangle": {
    type: "triangle",
    filled: false,
    size: BPMN_MARKER_SIZE,
    widthFactor: 1.0,
    heightFactor: 0.866,
  },
  "bpmn-black-triangle": {
    type: "triangle",
    filled: true,
    size: BPMN_MARKER_SIZE,
    widthFactor: 1.0,
    heightFactor: 0.866,
  },
  "bpmn-white-circle": {
    type: "circle",
    filled: false,
    size: BPMN_MARKER_SIZE,
    widthFactor: 1,
    heightFactor: 1,
  },
  "bpmn-arrow": {
    type: "arrow",
    filled: false,
    size: BPMN_MARKER_SIZE,
    widthFactor: 1.0,
    heightFactor: 0.866,
  },
} as const satisfies Record<string, MarkerConfig>)

export type MarkerId = keyof typeof MARKER_CONFIGS

export const MARKERS = Object.freeze({
  STROKE_WIDTH: Object.freeze({
    triangle: 1.3,
    arrow: 1.5,
    rhombus: 1.3,
    circle: 1.3,
    semicircle: 2, // Must match INTERFACE.STROKE_WIDTH for pixel-perfect alignment
  } as const satisfies Record<MarkerShape, number>),
} as const)

/* -------------------------------------------------------------------------- */
/* Sidebar / Palette                                                          */
/* -------------------------------------------------------------------------- */
export const DROPS = Object.freeze({
  SIDEBAR_PREVIEW_SCALE: 0.8,
  DEFAULT_ELEMENT_WIDTH: 160,
} as const)

export type DropElementConfig = {
  readonly type: DiagramNodeType
  readonly width: number
  readonly height: number
  readonly defaultData?: Record<string, unknown>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly svg: React.FC<any>
  readonly marginTop?: number
  /**
   * SA-FIX-NN-DROPS: optional palette section header rendered ABOVE
   * this entry. Used by `Sidebar.tsx` to group large palettes (e.g.
   * NNDiagram) into v3 visual sections. When set on the first entry
   * of a group, the sidebar prepends a divider + label before
   * rendering the entry. Leave undefined to skip.
   */
  readonly sectionLabel?: string
}

/**
 * Default palette entries shipped with BESSER WME. The mutable
 * registry below seeds from this map; consumers add BESSER-specific
 * diagram types via `registerPaletteEntry`.
 */
const defaultDropElementConfigs: Record<string, ReadonlyArray<DropElementConfig>> = ({
  [UMLDiagramType.ClassDiagram]: [
    // SA-UX-FIX B5: Interface and Package are temporarily hidden from
    // the palette — the round-trip / generator surface for them is not
    // wired yet on the v4 path. Their node code stays in the tree
    // (Package.tsx, Interface stereotype) so re-enabling is a one-line
    // change.
    // Class palette entry #1: 1 starter attribute, no methods.
    // Sidebar React keys include the array index so two entries with
    // the same `type:"class" + name:"Class"` no longer collide.
    {
      type: "class",
      width: DROPS.DEFAULT_ELEMENT_WIDTH,
      height: 90,
      defaultData: {
        name: "Class",
        methods: [],
        attributes: [
          {
            id: generateUUID(),
            name: "attribute",
            visibility: "public",
            attributeType: "str",
          },
        ],
      },
      svg: ClassSVG,
    },
    // Class palette entry #2: 1 starter attribute + 1 starter method
    // (mirrors v3 default at packages/editor/.../uml-class/uml-class.ts).
    {
      type: "class",
      width: DROPS.DEFAULT_ELEMENT_WIDTH,
      height: 110,
      defaultData: {
        name: "Class",
        methods: [
          {
            id: generateUUID(),
            name: "method",
            visibility: "public",
            attributeType: "any",
            returnType: "any",
            parameters: [],
            implementationType: "none",
          },
        ],
        attributes: [
          {
            id: generateUUID(),
            name: "attribute",
            visibility: "public",
            attributeType: "str",
          },
        ],
      },
      svg: ClassSVG,
    },
    {
      type: "class",
      width: DROPS.DEFAULT_ELEMENT_WIDTH,
      height: 110,
      defaultData: {
        name: "Abstract",
        stereotype: ClassType.Abstract,
        methods: [
          {
            id: generateUUID(),
            name: "method",
            visibility: "public",
            attributeType: "any",
            returnType: "any",
            parameters: [],
            implementationType: "none",
          },
        ],
        attributes: [
          {
            id: generateUUID(),
            name: "attribute",
            visibility: "public",
            attributeType: "str",
          },
        ],
      },
      svg: ClassSVG,
    },
    // SA-FIX-CLASS-FUND #4: Enumeration literals start as `Enum_1`,
    // `Enum_2`, `Enum_3` — valid Python identifiers. Previous
    // "Case 1" / "Case 2" defaults included whitespace which the
    // round-trip / generator layer rejects.
    {
      type: "class",
      width: DROPS.DEFAULT_ELEMENT_WIDTH,
      height: 140,
      defaultData: {
        name: "Enumeration",
        stereotype: ClassType.Enumeration,
        methods: [],
        attributes: [
          { id: generateUUID(), name: "Enum_1" },
          { id: generateUUID(), name: "Enum_2" },
          { id: generateUUID(), name: "Enum_3" },
        ],
      },
      svg: ClassSVG,
    },
    // SA-FIX-CLASS-FUND #1: ClassOCLConstraint palette entry. The node
    // code + inspector were added earlier (SA-UX-FIX B1) but the palette
    // was missing — so the constraint could not be dragged from the
    // sidebar. Sticky-note shape preview matches the canvas rendering
    // at `lib/nodes/classDiagram/ClassOCLConstraint.tsx`.
    {
      type: "ClassOCLConstraint",
      width: 180,
      height: 90,
      defaultData: {
        name: "constraint",
        expression: "context Class inv: true",
      },
      svg: ClassOCLConstraintSVG,
    },
  ],
  [UMLDiagramType.ObjectDiagram]: [
    {
      type: "objectName",
      width: DROPS.DEFAULT_ELEMENT_WIDTH,
      height: 70,
      defaultData: {
        name: "Object",
        attributes: [{ id: generateUUID(), name: "attribute = value" }],
        methods: [],
      },
      svg: ObjectNameSVG,
    },
  ],
  [UMLDiagramType.ActivityDiagram]: [
    {
      type: "activity",
      width: DROPS.DEFAULT_ELEMENT_WIDTH,
      height: 120,
      defaultData: { name: "Activity" },
      svg: ActivitySVG,
    },
    {
      type: "activityInitialNode",
      width: 50,
      height: 50,
      defaultData: { name: "ActivityInitialNode" },
      svg: ActivityInitialNodeSVG,
    },
    {
      type: "activityFinalNode",
      width: 50,
      height: 50,
      defaultData: { name: "ActivityFinalNode" },
      svg: ActivityFinalNodeSVG,
    },
    {
      type: "activityActionNode",
      width: DROPS.DEFAULT_ELEMENT_WIDTH,
      height: 120,
      defaultData: { name: "Action" },
      svg: ActivityActionNodeSVG,
    },
    {
      type: "activityObjectNode",
      width: DROPS.DEFAULT_ELEMENT_WIDTH,
      height: 120,
      defaultData: { name: "Object" },
      svg: ActivityObjectNodeSVG,
    },
    {
      type: "activityMergeNode",
      width: DROPS.DEFAULT_ELEMENT_WIDTH,
      height: 120,
      defaultData: { name: "Condition" },
      svg: ActivityMergeNodeSVG,
    },
    {
      type: "activityForkNode",
      width: 20,
      height: 100,
      defaultData: { name: "Fork" },
      svg: ActivityForkNodeSVG,
    },
    {
      type: "activityForkNodeHorizontal",
      width: 100,
      height: 20,
      defaultData: { name: "Fork" },
      svg: ActivityForkNodeHorizontalSVG,
    },
  ],
  [UMLDiagramType.UseCaseDiagram]: [
    {
      type: "useCase",
      width: 160,
      height: 100,
      defaultData: { name: "Use Case" },
      svg: UseCaseNodeSVG,
    },
    {
      type: "useCaseActor",
      width: 100,
      height: 150,
      defaultData: { name: "Actor" },
      svg: UseCaseActorNodeSVG,
    },
    {
      type: "useCaseSystem",
      width: 160,
      height: 120,
      defaultData: { name: "System" },
      svg: UseCaseSystemNodeSVG,
    },
  ],
  [UMLDiagramType.CommunicationDiagram]: [
    {
      type: "communicationObjectName",
      width: 160,
      height: 70,
      defaultData: {
        name: "Object",
        methods: [],
        attributes: [{ id: generateUUID(), name: "attribute = value" }],
      },
      svg: CommunicationObjectNameSVG,
    },
  ],
  [UMLDiagramType.ComponentDiagram]: [
    {
      type: "component",
      width: 180,
      height: 120,
      defaultData: { name: "Component", isComponentHeaderShown: true },
      svg: ComponentNodeSVG,
    },
    {
      type: "componentSubsystem",
      width: 180,
      height: 120,
      defaultData: { name: "Subsystem", isComponentSubsystemHeaderShown: true },
      svg: ComponentSubsystemNodeSVG,
    },
    {
      type: "componentInterface",
      width: INTERFACE_SIZE,
      height: INTERFACE_SIZE,
      defaultData: { name: "Interface" },
      svg: ComponentInterfaceNodeSVG,
      marginTop: 10,
    }, // Must use INTERFACE.SIZE
  ],
  [UMLDiagramType.DeploymentDiagram]: [
    {
      type: "deploymentNode",
      width: 160,
      height: 100,
      defaultData: {
        name: "Node",
        isComponentHeaderShown: true,
        stereotype: "node",
      },
      svg: DeploymentNodeSVG,
    },
    {
      type: "deploymentComponent",
      width: 160,
      height: 100,
      defaultData: { name: "Component", isComponentHeaderShown: true },
      svg: DeploymentComponentSVG,
    },
    {
      type: "deploymentArtifact",
      width: 160,
      height: 50,
      defaultData: { name: "Artifact" },
      svg: DeploymentArtifactSVG,
    },
    {
      type: "deploymentInterface",
      width: INTERFACE_SIZE,
      height: INTERFACE_SIZE,
      defaultData: { name: "Interface" },
      svg: DeploymentInterfaceSVG,
      marginTop: 10,
    }, // Must use INTERFACE.SIZE
  ],
  [UMLDiagramType.SyntaxTree]: [
    {
      type: "syntaxTreeNonterminal",
      width: 160,
      height: 100,
      defaultData: { name: "Nonterminal" },
      svg: SyntaxTreeNonterminalNodeSVG,
    },
    {
      type: "syntaxTreeTerminal",
      width: 160,
      height: 100,
      defaultData: { name: "Terminal" },
      svg: SyntaxTreeTerminalNodeSVG,
    },
  ],
  [UMLDiagramType.PetriNet]: [
    {
      type: "petriNetTransition",
      width: 30,
      height: 60,
      defaultData: { name: "Transition" },
      svg: PetriNetTransitionSVG,
      marginTop: 15,
    },
    {
      type: "petriNetPlace",
      width: 60,
      height: 60,
      defaultData: { name: "Place" },
      svg: PetriNetPlaceSVG,
      marginTop: 5,
    },
  ],
  [UMLDiagramType.ReachabilityGraph]: [
    {
      type: "reachabilityGraphMarking",
      width: 160,
      height: 120,
      defaultData: { name: "Marking" },
      svg: ReachabilityGraphMarkingSVG,
    },
  ],
  [UMLDiagramType.Flowchart]: [
    {
      type: "flowchartTerminal",
      width: 160,
      height: 70,
      defaultData: { name: "Terminal" },
      svg: FlowchartTerminalNodeSVG,
    },
    {
      type: "flowchartProcess",
      width: 160,
      height: 70,
      defaultData: { name: "Process" },
      svg: FlowchartProcessNodeSVG,
    },
    {
      type: "flowchartDecision",
      width: 160,
      height: 70,
      defaultData: { name: "Decision" },
      svg: FlowchartDecisionNodeSVG,
    },
    {
      type: "flowchartInputOutput",
      width: 140,
      height: 70,
      defaultData: { name: "Input/Output" },
      svg: FlowchartInputOutputNodeSVG,
    },
    {
      type: "flowchartFunctionCall",
      width: 160,
      height: 70,
      defaultData: { name: "Function Call" },
      svg: FlowchartFunctionCallNodeSVG,
    },
  ],
  [UMLDiagramType.BPMN]: [
    {
      type: "bpmnTask",
      width: 160,
      height: 60,
      defaultData: { name: "Task" },
      svg: BPMNTaskNodeSVG,
    },
    {
      type: "bpmnSubprocess",
      width: 160,
      height: 60,
      defaultData: { name: "Subprocess" },
      svg: BPMNSubprocessNodeSVG,
    },
    {
      type: "bpmnTransaction",
      width: 160,
      height: 60,
      defaultData: { name: "Transaction", variant: "transaction" },
      svg: BPMNSubprocessNodeSVG,
    },
    {
      type: "bpmnCallActivity",
      width: 160,
      height: 60,
      defaultData: { name: "Call Activity", variant: "call" },
      svg: BPMNSubprocessNodeSVG,
    },
    {
      type: "bpmnGroup",
      width: 160,
      height: 60,
      defaultData: { name: "Group" },
      svg: BPMNGroupNodeSVG,
    },
    {
      type: "bpmnAnnotation",
      width: 160,
      height: 60,
      defaultData: { name: "Annotation" },
      svg: BPMNAnnotationNodeSVG,
    },
    {
      type: "bpmnStartEvent",
      width: 40,
      height: 40,
      defaultData: { name: "", variant: "start" },
      svg: BPMNEventNodeSVG,
    },
    {
      type: "bpmnIntermediateEvent",
      width: 40,
      height: 40,
      defaultData: { name: "", variant: "intermediate" },
      svg: BPMNEventNodeSVG,
    },
    {
      type: "bpmnEndEvent",
      width: 40,
      height: 40,
      defaultData: { name: "", variant: "end" },
      svg: BPMNEventNodeSVG,
    },
    {
      type: "bpmnGateway",
      width: 40,
      height: 40,
      defaultData: { name: "" },
      svg: BPMNGatewayNodeSVG,
    },
    {
      type: "bpmnDataObject",
      width: 40,
      height: 60,
      defaultData: { name: "" },
      svg: BPMNDataObjectNodeSVG,
    },
    {
      type: "bpmnDataStore",
      width: 60,
      height: 60,
      defaultData: { name: "" },
      svg: BPMNDataStoreNodeSVG,
    },
    {
      // SA-FINAL-3 Tier 6 #21: match the canvas's `minWidth=200, minHeight=120`
      // so the dropped pool no longer balloons immediately after drop.
      type: "bpmnPool",
      width: 200,
      height: 120,
      defaultData: { name: "Pool" },
      svg: BPMNPoolNodeSVG,
    },
  ],
  // SA-3: BESSER StateMachineDiagram palette. Mirrors the v3 fork's
  // `packages/editor/.../uml-state-diagram/state-preview.ts`. Body /
  // fallback-body are not draggable items — they are added inside an
  // existing State container, matching v3 behaviour.
  [UMLDiagramType.StateMachineDiagram]: [
    {
      type: "State" as never,
      width: DROPS.DEFAULT_ELEMENT_WIDTH,
      height: 100,
      defaultData: { name: "State" },
      svg: StateSVG,
    },
    {
      type: "StateInitialNode" as never,
      width: 45,
      height: 45,
      defaultData: { name: "" },
      svg: StateInitialNodeSVG,
    },
    {
      type: "StateFinalNode" as never,
      width: 45,
      height: 45,
      defaultData: { name: "" },
      svg: StateFinalNodeSVG,
    },
    // Per user (2025-05): drop StateActionNode / StateObjectNode /
    // StateMergeNode / StateForkNode / StateForkNodeHorizontal from the
    // StateMachineDiagram palette. The v3 BESSER state metamodel did not
    // expose these; their node implementations remain in the codebase so
    // existing models that reference them still render.
    {
      type: "StateCodeBlock" as never,
      width: 200,
      height: 150,
      defaultData: {
        name: "code",
        code: '# Sample code\nprint("Hello World")',
        language: "python",
      },
      svg: StateCodeBlockSVG,
    },
  ],
  // SA-4: BESSER AgentDiagram palette. Inlined directly here per
  // SA-3's pattern (avoids the TDZ cycle `nodes/index → constants →
  // @/components → @/utils/nodeUtils → @/nodes`). The non-droppable
  // body / fallback / intent body / description child nodes are NOT
  // included — they're inserted automatically inside the parent
  // container, mirroring v3 behaviour.
  [UMLDiagramType.AgentDiagram]: [
    {
      type: "AgentState" as never,
      width: DROPS.DEFAULT_ELEMENT_WIDTH,
      height: 100,
      defaultData: { name: "AgentState", replyType: "text" },
      svg: AgentStateSVG,
    },

    {
      type: "AgentState" as never,
      width: DROPS.DEFAULT_ELEMENT_WIDTH,
      height: 130,
      defaultData: {
        name: "AgentState",
        replyType: "text",
        bodies: [
          {
            id: "agentstate-template-body-text",
            name: "Hello world",
            replyType: "text",
          },
        ],
      },
      svg: AgentStateSVG,
    },
    {
      type: "AgentIntent" as never,
      width: DROPS.DEFAULT_ELEMENT_WIDTH,
      height: 100,
      defaultData: { name: "Intent", intent_description: "" },
      svg: AgentIntentSVG,
    },
    // SA-FIX-AGENT-OCL: `AgentIntentObjectComponent` removed from the
    // palette — it's a child-of-AgentIntent slot row (added via the
    // intent inspector), not a top-level draggable.
    {
      type: "AgentRagElement" as never,
      width: 160,
      height: 120,
      // SA-FIX-AGENT-OCL: defaultData stripped to just `name`. The
      // standalone RAG palette element no longer carries DB-mode
      // fields (`ragDatabaseName`, `dbCustomName`, `dbSelectionType`,
      // `dbQueryMode`) — those belong to the AgentState `db_reply`
      // mode (see `AgentStateEditPanel.tsx`), not to the cylinder.
      defaultData: { name: "RAG" },
      svg: AgentRagElementSVG,
    },
    // Per user (2025-05): AgentDiagram palette only carries the initial
    // state marker. The final-state marker was removed because the
    // BESSER agent metamodel doesn't have a final-state concept (an
    // agent loops on user input rather than terminating).
    {
      type: "StateInitialNode" as never,
      width: 45,
      height: 45,
      defaultData: { name: "" },
      svg: StateInitialNodeSVG,
    },
  ],
  // SA-4 / SA-FIX-User: BESSER UserDiagram palette. v3 generated one
  // drag-source per meta-model class via `composeUserModelPreview`
  // walking `getAvailableClasses()`. We replicate that here at module
  // load by reading the user meta-model JSON and producing N entries —
  // one per Personal_Information / Skill / Education / Disability / …
  // Each entry's `defaultData` pre-populates the `attributes` rows so
  // the dropped node lands fully wired to the meta-model. The
  // `UserModelIcon` entry stays as a static second drag-source.
  [UMLDiagramType.UserDiagram]: [
    // SA-FINAL U2: align dropped node's `defaultData.name` with the
    // preview SVG's header label. The preview uses
    // `${className[0].toLowerCase()}${className.slice(1)}_1` (e.g.
    // `personal_Information_1`) — keep parity so the dropped node
    // visually matches the palette card the user clicked.
    ...getUserModelNamePaletteEntries().map((entry) => ({
      type: "UserModelName" as never,
      // SA-FIX-USER-ICON: dropped node defaults to the icon view, so
      // only reserve room for the header (~40) and the glyph slot
      // (~60) — drop the attributes-driven height that was used for
      // the old class-style preview.
      width: DROPS.DEFAULT_ELEMENT_WIDTH,
      height: 100,
      defaultData: {
        name: `${entry.className.charAt(0).toLowerCase() + entry.className.slice(1)}_1`,
        className: entry.className,
        attributes: entry.attributes.map((a) => ({
          id: a.id,
          name: a.name,
          attributeType: a.attributeType,
          attributeOperator: "==",
        })),
        // SA-FIX-USER-ICON: dropped nodes default to icon view (matches
        // the v3 fork's preferred UserDiagram preview). The inspector
        // exposes a toggle to opt into the attributes view.
        view: "icon" as const,
      },
      svg: entry.svg,
    })),
    {
      type: "UserModelName" as never,
      width: DROPS.DEFAULT_ELEMENT_WIDTH,
      height: 100,
      defaultData: {
        name: "Alice",
        className: "User",
        attributes: [],
        // SA-FIX-USER-ICON: static fallback drag-source also defaults
        // to icon view.
        view: "icon" as const,
      },
      svg: UserModelStaticPreviewSVG,
    },
    // Per user (2025-05): the standalone UserModelIcon palette entry is
    // dropped — every UserModelName already renders in icon view by
    // default, so the dedicated icon-only drag-source was redundant.
  ],
  // SA-5: BESSER NNDiagram palette. One palette item per top-level
  // draggable: NNContainer, the 13 layer kinds, TrainingDataset,
  // TestDataset, TensorOp, Configuration, NNReference. Inlined here per
  // SA-3's pattern. Default `attributes` is `{}` — the inline editor
  // populates slots on first edit; the round-trip migrator preserves
  // any keys the user adds.
  [UMLDiagramType.NNDiagram]: [
    // SA-FIX-NN-DROPS: v3 visual section order — Structure → Layers →
    // TensorOps → Configuration → Datasets. Section labels mirror v3
    // `editor/src/main/packages/nn-diagram/nn-preview.ts`. NNReference
    // is reordered next to NNContainer so both Structure entries sit
    // together. The `sectionLabel` field on a group's first entry
    // tells `Sidebar.tsx` to prepend a divider + heading.
    {
      type: "NNContainer" as never,
      width: 320,
      height: 200,
      defaultData: { name: "MyModel" },
      svg: NNContainerSVG,
      sectionLabel: "NN Structure",
    },
    {
      type: "NNReference" as never,
      width: 140,
      height: 40,
      defaultData: { name: "ref" },
      svg: NNReferenceSVG,
    },
    // SA-UX-FIX-2 (B4): Heights bumped from 60 → 140 so the v3 80×80
    // layer-kind icon (restored in `_NNLayerBase.tsx`) has room above
    // the stereotype/name header.
    {
      type: "Conv1DLayer" as never,
      width: DROPS.DEFAULT_ELEMENT_WIDTH,
      height: 140,
      defaultData: { name: "Conv1D", attributes: {} },
      svg: Conv1DLayerSVG,
      sectionLabel: "NN Layers",
    },
    {
      type: "Conv2DLayer" as never,
      width: DROPS.DEFAULT_ELEMENT_WIDTH,
      height: 140,
      defaultData: { name: "Conv2D", attributes: {} },
      svg: Conv2DLayerSVG,
    },
    {
      type: "Conv3DLayer" as never,
      width: DROPS.DEFAULT_ELEMENT_WIDTH,
      height: 140,
      defaultData: { name: "Conv3D", attributes: {} },
      svg: Conv3DLayerSVG,
    },
    {
      type: "PoolingLayer" as never,
      width: DROPS.DEFAULT_ELEMENT_WIDTH,
      height: 140,
      defaultData: {
        name: "Pooling",
        // Disambiguated dimension slug: see open question #2.
        // SA-FIX-NN-ATTRS: seed the `pooling_type` mandatory slug so
        // a freshly dropped node reads the v3 default `max` before the
        // inspector's auto-fill effect runs.
        attributes: {
          "pooling.dimension": "2D",
          pooling_type: "max",
        },
      },
      svg: PoolingLayerSVG,
    },
    {
      type: "RNNLayer" as never,
      width: DROPS.DEFAULT_ELEMENT_WIDTH,
      height: 140,
      defaultData: { name: "RNN", attributes: {} },
      svg: RNNLayerSVG,
    },
    {
      type: "LSTMLayer" as never,
      width: DROPS.DEFAULT_ELEMENT_WIDTH,
      height: 140,
      defaultData: { name: "LSTM", attributes: {} },
      svg: LSTMLayerSVG,
    },
    {
      type: "GRULayer" as never,
      width: DROPS.DEFAULT_ELEMENT_WIDTH,
      height: 140,
      defaultData: { name: "GRU", attributes: {} },
      svg: GRULayerSVG,
    },
    {
      type: "LinearLayer" as never,
      width: DROPS.DEFAULT_ELEMENT_WIDTH,
      height: 140,
      defaultData: { name: "Linear", attributes: {} },
      svg: LinearLayerSVG,
    },
    {
      type: "FlattenLayer" as never,
      width: DROPS.DEFAULT_ELEMENT_WIDTH,
      height: 140,
      defaultData: { name: "Flatten", attributes: {} },
      svg: FlattenLayerSVG,
    },
    {
      type: "EmbeddingLayer" as never,
      width: DROPS.DEFAULT_ELEMENT_WIDTH,
      height: 140,
      defaultData: { name: "Embedding", attributes: {} },
      svg: EmbeddingLayerSVG,
    },
    {
      type: "DropoutLayer" as never,
      width: DROPS.DEFAULT_ELEMENT_WIDTH,
      height: 140,
      defaultData: { name: "Dropout", attributes: {} },
      svg: DropoutLayerSVG,
    },
    {
      type: "LayerNormalizationLayer" as never,
      width: DROPS.DEFAULT_ELEMENT_WIDTH,
      height: 140,
      defaultData: { name: "LayerNorm", attributes: {} },
      svg: LayerNormalizationLayerSVG,
    },
    {
      type: "BatchNormalizationLayer" as never,
      width: DROPS.DEFAULT_ELEMENT_WIDTH,
      height: 140,
      defaultData: {
        name: "BatchNorm",
        // Disambiguated dimension slug: see open question #2.
        // SA-FIX-NN-ATTRS: v3 default = '2D' (mirrors the conv2d
        // baseline). The widget's auto-fill effect honours this seed.
        attributes: { "batch_normalization.dimension": "2D" },
      },
      svg: BatchNormalizationLayerSVG,
    },
    {
      type: "TensorOp" as never,
      width: DROPS.DEFAULT_ELEMENT_WIDTH,
      height: 140,
      defaultData: { name: "TensorOp", attributes: {} },
      svg: TensorOpSVG,
      sectionLabel: "NN TensorOps",
    },
    {
      type: "Configuration" as never,
      width: DROPS.DEFAULT_ELEMENT_WIDTH,
      height: 140,
      defaultData: { name: "Configuration", attributes: {} },
      svg: ConfigurationSVG,
      sectionLabel: "NN Configuration",
    },
    {
      type: "TrainingDataset" as never,
      width: DROPS.DEFAULT_ELEMENT_WIDTH,
      height: 140,
      defaultData: { name: "TrainingDataset", attributes: {} },
      svg: TrainingDatasetSVG,
      sectionLabel: "NN Datasets",
    },
    {
      type: "TestDataset" as never,
      width: DROPS.DEFAULT_ELEMENT_WIDTH,
      height: 140,
      defaultData: { name: "TestDataset", attributes: {} },
      svg: TestDatasetSVG,
    },
  ],
  [UMLDiagramType.Sfc]: [
    {
      type: "sfcStart",
      width: 160,
      height: 70,
      defaultData: { name: "Start" },
      svg: SfcStartNodeSVG,
    },
    {
      type: "sfcStep",
      width: 160,
      height: 70,
      defaultData: { name: "Step" },
      svg: SfcStepNodeSVG,
    },
    {
      type: "sfcJump",
      width: 96,
      height: 48,
      defaultData: { name: "Jump" },
      svg: SfcJumpNodeSVG,
    },
    {
      type: "sfcTransitionBranch",
      width: 30,
      height: 30,
      defaultData: { name: "Branch", showHint: true },
      svg: SfcTransitionBranchNodeSVG,
    },
    {
      type: "sfcActionTable",
      width: 160,
      height: 30,
      defaultData: {
        name: "Action Table",
        actionRows: [
          {
            id: "1",
            identifier: "A",
            name: "Actions",
            fillColor: "",
            strokeColor: "",
          },
        ],
      },
      svg: SfcActionTableNodeSVG,
    },
  ],
})

/**
 * Mutable palette registry. Seeded from `defaultDropElementConfigs`;
 * consumers register BESSER-specific palette entries (e.g. for
 * StateMachineDiagram, AgentDiagram, NNDiagram, UserDiagram) via
 * `registerPaletteEntry(diagramType, entries)`. The same object
 * reference is preserved across mutations so existing reads
 * (`Sidebar.tsx`) keep observing updates.
 */
const _paletteRegistry: Record<string, ReadonlyArray<DropElementConfig>> = {
  ...defaultDropElementConfigs,
}

/**
 * Append palette entries for a given diagram type. If the diagram type
 * already has entries, the new ones are appended; pass `replace: true`
 * to overwrite instead.
 */
export const registerPaletteEntry = (
  diagramType: string,
  entries: ReadonlyArray<DropElementConfig>,
  options: { replace?: boolean } = {}
): void => {
  if (options.replace) {
    _paletteRegistry[diagramType] = [...entries]
    return
  }
  const existing = _paletteRegistry[diagramType] ?? []
  _paletteRegistry[diagramType] = [...existing, ...entries]
}

/**
 * The merged palette registry. Read sites:
 *   `dropElementConfigs[diagramType].map(...)`
 * Tolerates unknown diagram types by returning an empty array.
 */
export const dropElementConfigs: Readonly<
  Record<UMLDiagramType, ReadonlyArray<DropElementConfig>>
> = new Proxy(_paletteRegistry, {
  get(target, prop: string) {
    if (prop in target) return target[prop]
    return [] as ReadonlyArray<DropElementConfig>
  },
}) as Readonly<Record<UMLDiagramType, ReadonlyArray<DropElementConfig>>>

/**
 * SA-HIDE-NOISE: lightweight palette preview for the free-form Comment
 * sticky-note. Mirrors the silhouette rendered by `lib/nodes/common/
 * Comment.tsx` so the drag-ghost matches the dropped node. Inlined here
 * (rather than as a new `components/svgs/...` file) to keep the diff
 * scoped to `constants.ts` per the SA-HIDE-NOISE file allowlist.
 */
const CommentPaletteSVG: React.FC<{
  width: number
  height: number
  data?: { name?: string }
  SIDEBAR_PREVIEW_SCALE?: number
}> = ({ width, height, data, SIDEBAR_PREVIEW_SCALE }) => {
  const w = width * (SIDEBAR_PREVIEW_SCALE ?? 1)
  const h = height * (SIDEBAR_PREVIEW_SCALE ?? 1)
  const pointerHeight = 10
  const pointerWidth = 12
  const cornerRadius = 8
  const bodyHeight = height - pointerHeight
  return React.createElement(
    "svg",
    {
      width: w,
      height: h,
      viewBox: `0 0 ${width} ${height}`,
      overflow: "visible",
    },
    React.createElement("path", {
      d: `
        M ${cornerRadius} 0
        L ${width - cornerRadius} 0
        Q ${width} 0 ${width} ${cornerRadius}
        L ${width} ${bodyHeight - cornerRadius}
        Q ${width} ${bodyHeight} ${width - cornerRadius} ${bodyHeight}
        L ${pointerWidth + 5} ${bodyHeight}
        L ${pointerWidth / 2} ${height}
        L 5 ${bodyHeight}
        Q 0 ${bodyHeight} 0 ${bodyHeight - cornerRadius}
        L 0 ${cornerRadius}
        Q 0 0 ${cornerRadius} 0 Z
      `,
      fill: "#fff8c4",
      stroke: "#bda21f",
      strokeWidth: 1.2,
      strokeMiterlimit: "10",
    }),
    React.createElement(
      "text",
      {
        x: width / 2,
        y: bodyHeight / 2,
        textAnchor: "middle",
        dominantBaseline: "middle",
        fill: "#3a2e00",
        style: { fontSize: "12px" },
      },
      data?.name ?? "Comment"
    )
  )
}

/**
 * SA-HIDE-NOISE: free-form sticky-note Comment palette entry. Replaces
 * the previously always-on `ColorDescriptionConfig` block in the
 * `Sidebar` so designers can drop comment notes into any diagram. The
 * ColorDescription node renderer + inspector code remain in the tree
 * (re-enable is a one-line change in `Sidebar.tsx`) — only the palette
 * surface is hidden, per the SA-HIDE-NOISE brief.
 */
export const CommentConfig: DropElementConfig = Object.freeze({
  type: "comment",
  width: 160,
  height: 60,
  defaultData: { name: "Comment" },
  svg: CommentPaletteSVG,
})
