/* eslint-disable */
import { UMLModel, BesserNode, BesserEdge, Assessment } from "../typings"
import { UMLDiagramType } from "../types/DiagramType"
import { ClassType } from "../types/nodes/enums"
import { IPoint } from "../edges/Connection"
import {
  V3DiagramFormat,
  V3UMLModel,
  V3UMLElement,
  V3UMLRelationship,
  V3Assessment,
  V3Message,
  V3Messages,
} from "./v3Typings"
import { log } from "../logger"
import { INTERFACE } from "../constants"

import {
  ClassNodeProps,
  ClassNodeElement,
  ClassOCLConstraint,
  ObjectNodeProps,
  ObjectNodeAttribute,
  CommunicationObjectNodeProps,
  ComponentNodeProps,
  ComponentSubsystemNodeProps,
  DeploymentNodeProps,
  DeploymentComponentProps,
  PetriNetPlaceProps,
  BPMNTaskProps,
  BPMNGatewayProps,
  BPMNEventProps,
  ReachabilityGraphMarkingProps,
  ClassifierVisibility,
  ClassifierMethodImplementationType,
  StateNodeProps,
  StateBodyNodeProps,
  StateActionNodeProps,
  StateObjectNodeProps,
  StateCodeBlockProps,
  StateMarkerNodeProps,
} from "../types/nodes/NodeProps"
import { MessageData } from "@/edges/EdgeProps"
import { parseLegacyNameFormat } from "./classifierMemberDisplay"
import {
  COLLIDING_SLUGS,
  V3_ATTRIBUTE_TYPE_TO_SLUG,
  qualifySlug,
  v3AttributeTypeFor,
} from "@/nodes/nnDiagram/nnAttributeWidgetConfig"

function normalizeImportedInterfaceGeometry(
  nodeType: string,
  position: { x: number; y: number },
  width: number,
  height: number
): { position: { x: number; y: number }; width: number; height: number } {
  const isInterfaceNode =
    nodeType === "componentInterface" || nodeType === "deploymentInterface"

  if (!isInterfaceNode) {
    return { position, width, height }
  }

  if (width === INTERFACE.SIZE && height === INTERFACE.SIZE) {
    return { position, width, height }
  }

  // Keep the node center stable while normalizing to the standard interface size.
  return {
    position: {
      x: position.x + (width - INTERFACE.SIZE) / 2,
      y: position.y + (height - INTERFACE.SIZE) / 2,
    },
    width: INTERFACE.SIZE,
    height: INTERFACE.SIZE,
  }
}

interface V2DiagramFormat {
  version: string
  size: {
    width: number
    height: number
  }
  type: string
  interactive: {
    elements: string[]
    relationships: string[]
  }
  elements: V3UMLElement[]
  relationships: V3UMLRelationship[]
  assessments: V3Assessment[]
}

/**
 * Convert v2 format to v4 format
 */
export function convertV2ToV4(v2Data: V2DiagramFormat): UMLModel {
  // First convert v2 to v3 structure
  const v3Data: V3DiagramFormat = {
    id: "converted-diagram-" + Date.now(), // Generate a unique ID
    title: "Converted Diagram",
    model: {
      version: "3.0.0",
      type: v2Data.type,
      size: v2Data.size,
      interactive: {
        elements: {},
        relationships: {},
      },
      elements: {},
      relationships: {},
      assessments: {},
    },
  }

  if (v2Data.interactive?.elements) {
    v2Data.interactive.elements.forEach((id) => {
      v3Data.model.interactive.elements[id] = true
    })
  }

  if (v2Data.interactive?.relationships) {
    v2Data.interactive.relationships.forEach((id) => {
      v3Data.model.interactive.relationships[id] = true
    })
  }

  if (v2Data.elements) {
    v2Data.elements.forEach((element) => {
      v3Data.model.elements[element.id] = element
    })
  }
  if (v2Data.relationships) {
    v2Data.relationships.forEach((relationship) => {
      v3Data.model.relationships[relationship.id] = relationship
    })
  }

  if (v2Data.assessments) {
    v2Data.assessments.forEach((assessment) => {
      v3Data.model.assessments[assessment.modelElementId] = assessment
    })
  }

  return convertV3ToV4(v3Data)
}

/**
 * Check if data is in v2 format
 */
export function isV2Format(data: any): data is V2DiagramFormat {
  return (
    data &&
    data.version &&
    data.version.startsWith("2.") &&
    data.size &&
    data.type &&
    Array.isArray(data.elements) &&
    Array.isArray(data.relationships) &&
    Array.isArray(data.assessments) &&
    data.interactive &&
    Array.isArray(data.interactive.elements) &&
    Array.isArray(data.interactive.relationships) &&
    !data.model
  )
}

/**
 * Convert v3 handle directions to v4 handle IDs
 * V3 uses Direction enum, V4 uses HandleId enum
 */
export function convertV3HandleToV4(v3Handle: string): string {
  const handleMap: Record<string, string> = {
    // Main directions
    Up: "top",
    Right: "right",
    Down: "bottom",
    Left: "left",

    // Diagonal/corner handles
    Upright: "right-top",
    Upleft: "left-top",
    Downright: "right-bottom",
    Downleft: "left-bottom",

    // Handle intermediate positions if they exist in V3
    RightTop: "top-right",
    RightBottom: "bottom-right",
    LeftTop: "top-left",
    LeftBottom: "bottom-left",
  }

  return handleMap[v3Handle] || v3Handle.toLowerCase()
}

/**
 * Convert v3 node types to v4 node types
 */
export function convertV3NodeTypeToV4(v3Type: string): string {
  const typeMap: Record<string, string> = {
    // Class Diagram
    Class: "class",
    AbstractClass: "class",
    Interface: "class",
    Enumeration: "class",
    Package: "package",
    ClassAttribute: "classAttribute",
    ClassMethod: "classMethod",
    // SA-UX-FIX B1: free-standing OCL constraint nodes (when the v3
    // element has no owner class) are emitted as a dedicated v4 node
    // type rendered with a sticky-note shape — distinct from a regular
    // class. Owned constraints are collapsed onto the parent's
    // `data.oclConstraints` (handled by the filter in `convertV3ToV4`).
    ClassOCLConstraint: "ClassOCLConstraint",

    // Activity Diagram
    ActivityInitialNode: "activityInitialNode",
    ActivityFinalNode: "activityFinalNode",
    ActivityActionNode: "activityActionNode",
    ActivityObjectNode: "activityObjectNode",
    ActivityForkNode: "activityForkNode",
    ActivityForkNodeHorizontal: "activityForkNodeHorizontal",
    ActivityMergeNode: "activityMergeNode",
    ActivityDecisionNode: "activityMergeNode",
    Activity: "activity",

    // Use Case Diagram
    UseCase: "useCase",
    UseCaseActor: "useCaseActor",
    UseCaseSystem: "useCaseSystem",

    // Communication Diagram
    CommunicationObject: "communicationObjectName",

    // Component Diagram
    Component: "component",
    ComponentInterface: "componentInterface",
    Subsystem: "componentSubsystem",

    // Deployment Diagram
    DeploymentNode: "deploymentNode",
    DeploymentComponent: "deploymentComponent",
    DeploymentArtifact: "deploymentArtifact",
    DeploymentInterface: "deploymentInterface",

    // Object Diagram
    ObjectName: "objectName",
    ObjectAttribute: "objectAttribute",
    ObjectMethod: "objectMethod",

    // Petri Net
    PetriNetPlace: "petriNetPlace",
    PetriNetTransition: "petriNetTransition",

    // Reachability Graph
    ReachabilityGraphMarking: "reachabilityGraphMarking",

    // Syntax Tree
    SyntaxTreeNonterminal: "syntaxTreeNonterminal",
    SyntaxTreeTerminal: "syntaxTreeTerminal",

    // Flowchart
    FlowchartProcess: "flowchartProcess",
    FlowchartDecision: "flowchartDecision",
    FlowchartInputOutput: "flowchartInputOutput",
    FlowchartFunctionCall: "flowchartFunctionCall",
    FlowchartTerminal: "flowchartTerminal",

    // BPMN
    BPMNTask: "bpmnTask",
    BPMNGateway: "bpmnGateway",
    BPMNStartEvent: "bpmnStartEvent",
    BPMNIntermediateEvent: "bpmnIntermediateEvent",
    BPMNEndEvent: "bpmnEndEvent",
    BPMNSubprocess: "bpmnSubprocess",
    BPMNTransaction: "bpmnTransaction",
    BPMNCallActivity: "bpmnCallActivity",
    BPMNAnnotation: "bpmnAnnotation",
    BPMNDataObject: "bpmnDataObject",
    BPMNDataStore: "bpmnDataStore",
    BPMNPool: "bpmnPool",
    BPMNGroup: "bpmnGroup",

    // SFC Diagram
    SfcStart: "sfcStart",
    SfcStep: "sfcStep",
    SfcActionTable: "sfcActionTable",
    SfcTransitionBranch: "sfcTransitionBranch",
    SfcJump: "sfcJump",
    SfcPreviewSpacer: "sfcPreviewSpacer",

    // Special nodes
    ColorDescription: "colorDescription",
    TitleAndDescription: "titleAndDesctiption", // Note the typo in V4: "desctiption"
    // SA-HIDE-NOISE: free-form sticky-note Comment ported from v3
    // `common/comments`. v3 stored the body text on `UMLElement.name`,
    // so the data conversion is a pass-through (baseData carries
    // `name`). The v4 → v3 inverse map is in `invertNodeType`.
    Comments: "comment",

    // SA-3: StateMachineDiagram — node types are PascalCase identical to
    // v3 element-type strings, so the migrator passes them through. Per
    // the SA-3 brief, body / fallback-body / code-block are kept as
    // separate React-Flow nodes (using `parentId` for the State
    // hierarchy) rather than collapsed onto the parent state's data.
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

    // SA-4: AgentDiagram — same PascalCase passthrough as
    // StateMachineDiagram. AgentState bodies / intents bodies stay as
    // separate React-Flow children via `parentId`, mirroring SA-3.
    AgentState: "AgentState",
    AgentStateBody: "AgentStateBody",
    AgentStateFallbackBody: "AgentStateFallbackBody",
    AgentIntent: "AgentIntent",
    AgentIntentBody: "AgentIntentBody",
    AgentIntentDescription: "AgentIntentDescription",
    AgentIntentObjectComponent: "AgentIntentObjectComponent",
    AgentRagElement: "AgentRagElement",

    // SA-4: UserDiagram — collapsed shape for `UserModelName`
    // (attributes folded onto `data.attributes`). `UserModelAttribute`
    // and `UserModelIcon` exist as standalone node types only when v3
    // fixtures keep them unowned — the migrator's `convertV3ToV4`
    // filter drops them when an owner exists (see filter list below).
    UserModelName: "UserModelName",
    UserModelAttribute: "UserModelAttribute",
    UserModelIcon: "UserModelIcon",

    // SA-5: NNDiagram — PascalCase passthrough for the 18 top-level
    // node types. Per-attribute child elements (e.g.
    // `KernelDimAttributeConv2D`) are NOT in this map; they're
    // intercepted by the attribute-collapse filter and emitted onto
    // the parent layer's `data.attributes`. See
    // `convertV3NodeDataToV4` (NN cases) and the filter in
    // `convertV3ToV4`.
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
  }

  return typeMap[v3Type] || v3Type.toLowerCase()
}

/**
 * Convert v3 edge types to v4 edge types
 */
export function convertV3EdgeTypeToV4(
  v3Type: string,
  flowType?: string
): string {
  const edgeTypeMap: Record<string, string> = {
    // Class Diagram
    ClassBidirectional: "ClassBidirectional",
    ClassUnidirectional: "ClassUnidirectional",
    ClassInheritance: "ClassInheritance",
    ClassRealization: "ClassRealization",
    ClassDependency: "ClassDependency",
    ClassAggregation: "ClassAggregation",
    ClassComposition: "ClassComposition",
    // SA-2.1: BESSER-specific class edge types. v3 fork has no
    // dedicated renderer for either (both extend UMLAssociation), so
    // they passthrough verbatim — the v4 lib treats them as a
    // ClassDiagramEdge with appropriate stroke / marker styling
    // configured in `lib/edges/types.tsx`.
    ClassOCLLink: "ClassOCLLink",
    ClassLinkRel: "ClassLinkRel",

    // Activity Diagram
    ActivityControlFlow: "ActivityControlFlow",

    // Use Case Diagram
    UseCaseAssociation: "UseCaseAssociation",
    UseCaseInclude: "UseCaseInclude",
    UseCaseExtend: "UseCaseExtend",
    UseCaseGeneralization: "UseCaseGeneralization",

    // Communication Diagram
    CommunicationLink: "CommunicationLink",

    // Component Diagram
    ComponentDependency: "ComponentDependency",
    ComponentInterfaceProvided: "ComponentProvidedInterface",
    ComponentInterfaceRequired: "ComponentRequiredInterface",
    ComponentInterfaceRequiredQuarter: "ComponentRequiredQuarterInterface",
    ComponentInterfaceRequiredThreeQuarter:
      "ComponentRequiredThreeQuarterInterface",

    // Deployment Diagram
    DeploymentDependency: "DeploymentDependency",
    DeploymentAssociation: "DeploymentAssociation",
    DeploymentInterfaceProvided: "DeploymentProvidedInterface",
    DeploymentInterfaceRequired: "DeploymentRequiredInterface",
    DeploymentInterfaceRequiredQuarter: "DeploymentRequiredQuarterInterface",
    DeploymentInterfaceRequiredThreeQuarter:
      "DeploymentRequiredThreeQuarterInterface",

    // Object Diagram
    ObjectLink: "ObjectLink",

    // Petri Net
    PetriNetArc: "PetriNetArc",

    // Reachability Graph
    ReachabilityGraphArc: "ReachabilityGraphArc",

    // Syntax Tree
    SyntaxTreeLink: "SyntaxTreeLink",

    // Flowchart
    FlowchartFlowline: "FlowChartFlowline",

    // SA-3: StateMachineDiagram transition. Single edge type, passed
    // through verbatim — `params` / `guard` / etc. live on the edge
    // data (see `StateMachineDiagramEdge.tsx`).
    StateTransition: "StateTransition",

    // SA-4: AgentDiagram — two edge types. The transition data shape is
    // collapsed by `liftAgentTransitionDataToV4` below.
    AgentStateTransition: "AgentStateTransition",
    AgentStateTransitionInit: "AgentStateTransitionInit",

    // SA-4: UserDiagram — single link edge.
    UserModelLink: "UserModelLink",

    // SA-5: NNDiagram — three edge kinds passed through verbatim.
    NNNext: "NNNext",
    NNComposition: "NNComposition",
    NNAssociation: "NNAssociation",
  }
  if (v3Type === "BPMNFlow" && flowType) {
    const flowTypeMap: Record<string, string> = {
      sequence: "BPMNSequenceFlow",
      message: "BPMNMessageFlow",
      association: "BPMNAssociationFlow",
      dataAssociation: "BPMNDataAssociationFlow",
    }
    return flowTypeMap[flowType] || "BPMNSequenceFlow" // Default to sequence flow
  }

  return edgeTypeMap[v3Type] || v3Type
}

/**
 * Calculate relative position within parent bounds
 */
function calculateRelativePosition(
  child: V3UMLElement,
  parent: V3UMLElement
): { x: number; y: number } {
  return {
    x: child.bounds.x - parent.bounds.x,
    y: child.bounds.y - parent.bounds.y,
  }
}

/**
 * Lift a v3 `ClassAttribute` / `ClassMethod` / `ObjectAttribute` /
 * `ObjectMethod` element into the v4 row shape (`ClassNodeElement`). Two
 * cases:
 *
 * 1. New format — the v3 element carries explicit
 *    `visibility` + `attributeType` + the `is*` flags. Pass through.
 * 2. Legacy format — fall back to `parseLegacyNameFormat` against
 *    `element.name` (e.g. `"+ counter: int"`). The migrator writes the
 *    canonical separate fields after parse so future round-trips stay
 *    structured.
 *
 * Implementation-type / cross-diagram fields (`code`, `implementationType`,
 * `stateMachineId`, `quantumCircuitId`) are passed through verbatim — they
 * have always been first-class properties on the v3 `IUMLClassifierMember`.
 */

/**
 * SA-2.2 #38: extract a `UserModelAttribute` comparator from the row's
 * `name` (the v3 wire form `"age >= 18"` embeds it instead of the
 * separate field). Returns `undefined` when the name does not contain
 * a recognised comparator. Mirrors v3's `extractComparatorFromName` at
 * `packages/editor/.../uml-user-model-attribute.ts:27-33` — but
 * returns `undefined` instead of the v3 `'=='` default so the caller
 * can decide whether to fall back.
 */
function extractAttributeOperatorFromName(
  name?: string
): "<" | "<=" | "==" | ">=" | ">" | undefined {
  if (!name) return undefined
  const match = name.match(/^(?:.*?)(<=|>=|==|=|<|>)/)
  if (!match) return undefined
  const raw = match[1]
  if (raw === "=") return "=="
  return raw as "<" | "<=" | "==" | ">=" | ">"
}

function extractClassifierMember(
  childElement: V3UMLElement & {
    visibility?: ClassifierVisibility
    attributeType?: string
    code?: string
    implementationType?: ClassifierMethodImplementationType
    stateMachineId?: string
    quantumCircuitId?: string
    isOptional?: boolean
    isDerived?: boolean
    isId?: boolean
    isExternalId?: boolean
    defaultValue?: unknown
    // SA-FINAL C2: v3 ClassMethod elements that round-tripped from v4
    // carry the structured method signature alongside the legacy name.
    parameters?: {
      id: string
      name: string
      parameterType?: string
      defaultValue?: unknown
    }[]
    returnType?: string
  }
): ClassNodeElement {
  const baseMember: ClassNodeElement = {
    id: childElement.id,
    name: childElement.name,
    ...(childElement.fillColor && { fillColor: childElement.fillColor }),
    ...(childElement.textColor && { textColor: childElement.textColor }),
  }

  // New format: explicit visibility + attributeType present.
  if (
    childElement.visibility !== undefined &&
    childElement.attributeType !== undefined
  ) {
    return {
      ...baseMember,
      visibility: childElement.visibility,
      attributeType: childElement.attributeType,
      ...(childElement.code !== undefined && { code: childElement.code }),
      ...(childElement.implementationType && {
        implementationType: childElement.implementationType,
      }),
      ...(childElement.stateMachineId && {
        stateMachineId: childElement.stateMachineId,
      }),
      ...(childElement.quantumCircuitId && {
        quantumCircuitId: childElement.quantumCircuitId,
      }),
      ...(childElement.isOptional !== undefined && {
        isOptional: childElement.isOptional,
      }),
      ...(childElement.isDerived !== undefined && {
        isDerived: childElement.isDerived,
      }),
      ...(childElement.isId !== undefined && { isId: childElement.isId }),
      ...(childElement.isExternalId !== undefined && {
        isExternalId: childElement.isExternalId,
      }),
      ...(childElement.defaultValue !== undefined && {
        defaultValue: childElement.defaultValue,
      }),
      // SA-FINAL C2: lift method-signature fields back into the v4 row
      // shape. Mirrors `childRowToV3` so Class/Object methods round-trip
      // their `parameters[]` and `returnType` losslessly.
      ...(Array.isArray(childElement.parameters) &&
        childElement.parameters.length > 0 && {
          parameters: childElement.parameters.map((p) => ({
            id: p.id,
            name: p.name,
            ...(p.parameterType !== undefined && {
              parameterType: p.parameterType,
            }),
            ...(p.defaultValue !== undefined && {
              defaultValue: p.defaultValue,
            }),
          })),
        }),
      ...(childElement.returnType !== undefined && {
        returnType: childElement.returnType,
      }),
    }
  }

  // Legacy format: parse "+ counter: int" / "- doSomething(): str" out of
  // the row name and write canonical separate fields.
  const parsed = parseLegacyNameFormat(childElement.name ?? "")
  return {
    ...baseMember,
    name: parsed.name,
    visibility: parsed.visibility,
    attributeType: parsed.attributeType,
    ...(childElement.code !== undefined && { code: childElement.code }),
    ...(childElement.implementationType && {
      implementationType: childElement.implementationType,
    }),
    ...(childElement.stateMachineId && {
      stateMachineId: childElement.stateMachineId,
    }),
    ...(childElement.quantumCircuitId && {
      quantumCircuitId: childElement.quantumCircuitId,
    }),
  }
}

/**
 * Lift a v3 `ClassOCLConstraint` element into a v4
 * `ClassOCLConstraint` row on the owner class.
 *
 * Spec (`uml-v4-shape.md`, ClassDiagram §) recommends collapsing OCL
 * constraints onto their owner class; SA-2 picks that option to minimise
 * round-trip size. The v3 element's `name` becomes the constraint name
 * and its `expression` field (or `description` for older fixtures) the
 * OCL expression body.
 */
function extractOCLConstraint(
  element: V3UMLElement & {
    expression?: string
    description?: string
    kind?: string
  }
): ClassOCLConstraint {
  return {
    id: element.id,
    name: element.name ?? "",
    expression: element.expression ?? "",
    ...(element.description && { description: element.description }),
    ...(element.kind && { kind: element.kind }),
  }
}

/**
 * SA-5: collapse all v3 attribute child elements owned by a layer into
 * a flat `Record<string, unknown>` keyed by the v4 slug. Booleans
 * (`'true'` / `'false'`) are normalized to JS booleans per the brief;
 * everything else (numeric strings, free-text, list literals like
 * `'[3, 3]'`) is preserved as a string so the Python codegen can keep
 * its current `int(...)` / `float(...)` parsing behaviour.
 *
 * Open question #2 disambiguation: when the v3 element type's mapped
 * slug appears in `COLLIDING_SLUGS`, the result key is qualified with
 * the layer-kind prefix (e.g. `pooling.dimension`). Backend
 * (`nn_diagram_processor.py`, SA-6.1) already does the same.
 */
function collapseV3LayerAttributes(
  layerId: string,
  layerKind: string,
  allElements: Record<string, V3UMLElement>
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const child of Object.values(allElements)) {
    if (child.owner !== layerId) continue
    const slug = V3_ATTRIBUTE_TYPE_TO_SLUG[child.type]
    if (!slug) continue
    // Read the raw v3 value (most v3 attribute elements store it on a
    // `value` field rather than `name`; both legacy fixtures exist).
    const raw =
      (child as { value?: unknown }).value !== undefined
        ? (child as { value?: unknown }).value
        : child.name
    let coerced: unknown = raw
    if (raw === "true") coerced = true
    else if (raw === "false") coerced = false
    const key = COLLIDING_SLUGS.has(slug) ? qualifySlug(layerKind, slug) : slug
    out[key] = coerced
  }
  return out
}

/**
 * Convert V3 node data to V4 node data format
 */
function convertV3NodeDataToV4(
  element: V3UMLElement,
  allElements: Record<string, V3UMLElement>
): any {
  const baseData = {
    name: element.name,
    ...(element.fillColor && { fillColor: element.fillColor }),
    ...(element.strokeColor && { strokeColor: element.strokeColor }),
    ...(element.textColor && { textColor: element.textColor }),
    ...(element.highlight && { highlight: element.highlight }),
    ...(element.assessmentNote && { assessmentNote: element.assessmentNote }),
  }

  switch (element.type) {
    case "Class":
    case "AbstractClass":
    case "Interface":
    case "Enumeration": {
      const attributes: ClassNodeElement[] = []
      const methods: ClassNodeElement[] = []
      const oclConstraints: ClassOCLConstraint[] = []
      Object.values(allElements).forEach((childElement) => {
        if (childElement.owner === element.id) {
          if (childElement.type === "ClassAttribute") {
            attributes.push(extractClassifierMember(childElement))
          } else if (childElement.type === "ClassMethod") {
            methods.push(extractClassifierMember(childElement))
          } else if (childElement.type === "ClassOCLConstraint") {
            oclConstraints.push(extractOCLConstraint(childElement))
          }
        }
      })

      // Determine stereotype. PC-1 fix (SA-FIX-Class): freeform v3
      // `stereotype` strings survive too.
      let stereotype: string | undefined
      if (element.type === "AbstractClass") {
        stereotype = ClassType.Abstract
      } else if (element.type === "Interface") {
        stereotype = ClassType.Interface
      } else if (element.type === "Enumeration") {
        stereotype = ClassType.Enumeration
      } else {
        const freeform = (
          element as V3UMLElement & { stereotype?: string | null }
        ).stereotype
        if (freeform) stereotype = freeform
      }

      // PC-1/PC-2/PC-11 fix (SA-FIX-Class): preserve italic / underline /
      // description / uri / icon on the v4 node data.
      const ce = element as V3UMLElement & {
        italic?: boolean
        underline?: boolean
        description?: string
        uri?: string
        icon?: string
      }

      const classData: ClassNodeProps = {
        ...baseData,
        methods,
        attributes,
        ...(stereotype && { stereotype }),
        ...(ce.italic !== undefined && { italic: !!ce.italic }),
        ...(ce.underline !== undefined && { underline: !!ce.underline }),
        ...(ce.description !== undefined && { description: ce.description }),
        ...(ce.uri !== undefined && { uri: ce.uri }),
        ...(ce.icon !== undefined && { icon: ce.icon }),
        ...(oclConstraints.length > 0 && { oclConstraints }),
      }
      return classData
    }

    case "ClassOCLConstraint": {
      // SA-UX-FIX B1: Free-standing OCL constraint (no owner class).
      // Owned constraints are filtered out in `convertV3ToV4` and
      // collapsed onto their owner's `data.oclConstraints` instead.
      const e = element as V3UMLElement & {
        constraint?: string
        expression?: string
        description?: string
        kind?: string
      }
      return {
        ...baseData,
        // v3 constraint body lives on `constraint`; legacy fixtures may
        // use `expression`. Normalize to `expression` here.
        expression: e.expression ?? e.constraint ?? "",
        ...(e.description && { description: e.description }),
        ...(e.kind && { kind: e.kind }),
      }
    }

    case "ObjectName": {
      const attributes: ObjectNodeAttribute[] = []

      Object.values(allElements).forEach((childElement) => {
        if (childElement.owner === element.id) {
          if (childElement.type === "ObjectAttribute") {
            const member = extractClassifierMember(childElement) as
              ObjectNodeAttribute
            // v3 ObjectAttribute carried optional `attributeId` linking to a
            // class attribute in the sibling ClassDiagram.
            const linkedId = (childElement as { attributeId?: string })
              .attributeId
            if (linkedId) member.attributeId = linkedId
            // Object diagrams stash the runtime value in the row name as
            // `attribute = value`. Lift the value side into a structured
            // `value` field so the inspector can edit it cleanly.
            const rawName = childElement.name ?? ""
            const eqIndex = rawName.indexOf(" = ")
            if (eqIndex !== -1) {
              member.name = rawName.substring(0, eqIndex)
              member.value = rawName.substring(eqIndex + 3)
            }
            attributes.push(member)
          } else if (childElement.type === "ObjectMethod") {
            // SA-FIX-OBJECT-DEEP: v3 ObjectMethod was a mistake —
            // UML object diagrams don't render methods because objects
            // are instances, not types. Drop the row on import (don't
            // surface it on the v4 node) and log a warning so legacy
            // fixtures with stray ObjectMethod elements are visible.
            // eslint-disable-next-line no-console
            console.warn(
              `[versionConverter] Dropping legacy ObjectMethod ${childElement.id} ` +
                `under ObjectName ${element.id}; object instances do not carry methods.`
            )
          }
        }
      })

      const objectData: ObjectNodeProps = {
        ...baseData,
        attributes,
        ...((element as { classId?: string }).classId && {
          classId: (element as { classId?: string }).classId,
        }),
        ...((element as { className?: string }).className && {
          className: (element as { className?: string }).className,
        }),
        // PC-4 Gap 1: v3 ObjectName inherits `stereotype: string | null`
        // from UMLClassifier. Lift it onto the v4 node so the SVG can
        // render the `«…»` band.
        ...((element as { stereotype?: string | null }).stereotype !== undefined &&
          (element as { stereotype?: string | null }).stereotype !== null && {
          stereotype: (element as { stereotype?: string | null }).stereotype as string,
        }),
        // v3 stored ObjectIcon as a separate child element. Spec
        // (`uml-v4-shape.md`, ObjectDiagram §): collapse it into the owner
        // node's `data.icon` SVG body. Find the icon child by walking
        // `allElements` for an ObjectIcon owned by this node.
        ...(() => {
          const iconChild = Object.values(allElements).find(
            (child) =>
              child.owner === element.id && child.type === "ObjectIcon"
          ) as { icon?: string } | undefined
          return iconChild?.icon ? { icon: iconChild.icon } : {}
        })(),
      }
      return objectData
    }

    case "CommunicationObject": {
      const attributes: Array<{ id: string; name: string }> = []
      const methods: Array<{ id: string; name: string }> = []
      Object.values(allElements).forEach((childElement) => {
        if (childElement.owner === element.id) {
          if (childElement.type === "ObjectAttribute") {
            attributes.push({
              id: childElement.id,
              name: childElement.name,
              ...(childElement.fillColor && {
                fillColor: childElement.fillColor,
              }),
              ...(childElement.textColor && {
                textColor: childElement.textColor,
              }),
            })
          } else if (childElement.type === "ObjectMethod") {
            methods.push({
              id: childElement.id,
              name: childElement.name,
              ...(childElement.fillColor && {
                fillColor: childElement.fillColor,
              }),
              ...(childElement.textColor && {
                textColor: childElement.textColor,
              }),
            })
          }
        }
      })
      const communicationData: CommunicationObjectNodeProps = {
        ...baseData,
        methods,
        attributes,
      }
      return communicationData
    }

    case "Component": {
      const componentData: ComponentNodeProps = {
        ...baseData,
        isComponentHeaderShown: element.displayStereotype !== false,
      }
      return componentData
    }

    case "ComponentSubsystem": {
      const subsystemData: ComponentSubsystemNodeProps = {
        ...baseData,
        isComponentSubsystemHeaderShown: element.displayStereotype !== false,
      }
      return subsystemData
    }

    case "DeploymentNode": {
      const deploymentData: DeploymentNodeProps = {
        ...baseData,
        isComponentHeaderShown: element.displayStereotype !== false,
        stereotype: element.stereotype || "",
      }
      return deploymentData
    }

    case "DeploymentComponent": {
      const deploymentComponentData: DeploymentComponentProps = {
        ...baseData,
        isComponentHeaderShown: element.displayStereotype !== false,
      }
      return deploymentComponentData
    }

    case "PetriNetPlace": {
      let capacity: number | "Infinity" = "Infinity"
      if (element.capacity !== undefined) {
        if (typeof element.capacity === "number") {
          capacity = element.capacity
        } else if (typeof element.capacity === "string") {
          if (element.capacity === "Infinity" || element.capacity === "∞") {
            capacity = "Infinity"
          } else {
            const parsed = parseFloat(element.capacity)
            capacity = isNaN(parsed) ? "Infinity" : parsed
          }
        }
      }

      const petriNetData: PetriNetPlaceProps = {
        ...baseData,
        tokens: element.amountOfTokens || 0,
        capacity,
      }
      return petriNetData
    }

    case "BPMNTask": {
      const bpmnTaskData: BPMNTaskProps = {
        ...baseData,
        taskType: (element.taskType as any) || "default",
        marker: (element.marker as any) || "none",
      }
      return bpmnTaskData
    }

    case "BPMNGateway": {
      const bpmnGatewayData: BPMNGatewayProps = {
        ...baseData,
        gatewayType: (element.gatewayType as any) || "exclusive",
      }
      return bpmnGatewayData
    }

    case "BPMNStartEvent": {
      const bpmnStartEventData: BPMNEventProps = {
        ...baseData,
        eventType: (element.eventType as any) || "default",
      }
      return bpmnStartEventData
    }

    case "BPMNIntermediateEvent": {
      const bpmnIntermediateEventData: BPMNEventProps = {
        ...baseData,
        eventType: (element.eventType as any) || "default",
      }
      return bpmnIntermediateEventData
    }

    case "BPMNEndEvent": {
      const bpmnEndEventData: BPMNEventProps = {
        ...baseData,
        eventType: (element.eventType as any) || "default",
      }
      return bpmnEndEventData
    }

    case "ReachabilityGraphMarking": {
      const reachabilityData: ReachabilityGraphMarkingProps = {
        ...baseData,
        isInitialMarking: element.isInitialMarking || false,
      }
      return reachabilityData
    }

    /* ---------------------------------------------------------------- */
    /* SA-3: StateMachineDiagram                                          */
    /* ---------------------------------------------------------------- */

    case "State": {
      // v3 `IUMLState` carries `stereotype` / `italic` / `underline`
      // verbatim. `deviderPosition`, `hasBody`, `hasFallbackBody` are
      // recomputed at render time and don't survive into v4.
      const stateData: StateNodeProps = {
        ...baseData,
        ...(element.stereotype !== undefined && {
          stereotype: element.stereotype as string | null,
        }),
        ...((element as { italic?: boolean }).italic !== undefined && {
          italic: !!(element as { italic?: boolean }).italic,
        }),
        ...((element as { underline?: boolean }).underline !== undefined && {
          underline: !!(element as { underline?: boolean }).underline,
        }),
      }
      return stateData
    }

    case "StateBody":
    case "StateFallbackBody": {
      // Both body kinds are simple labels in v3; pass through as-is so
      // round-trip stays structural. `code` / `kind` are BESSER editor
      // extensions surfaced by the inspector.
      const e = element as { code?: string; kind?: string }
      const data: StateBodyNodeProps & { code?: string; kind?: string } = {
        ...baseData,
        ...(e.code !== undefined && { code: e.code }),
        ...(e.kind !== undefined && { kind: e.kind }),
      }
      return data
    }

    case "StateActionNode": {
      const actionData: StateActionNodeProps = {
        ...baseData,
        ...((element as { code?: string }).code !== undefined && {
          code: (element as { code?: string }).code,
        }),
      }
      return actionData
    }

    case "StateObjectNode": {
      // Spec open question 4 resolution: `classId` is preserved on
      // `StateObjectNode` exactly like `ObjectName.classId`.
      const e = element as { classId?: string; className?: string }
      const objectData: StateObjectNodeProps = {
        ...baseData,
        ...(e.classId && { classId: e.classId }),
        ...(e.className && { className: e.className }),
      }
      return objectData
    }

    case "StateCodeBlock": {
      const e = element as { code?: string; language?: string }
      const codeBlockData: StateCodeBlockProps = {
        ...baseData,
        code: e.code ?? "",
        language: e.language ?? "python",
      }
      return codeBlockData
    }

    case "StateInitialNode":
    case "StateFinalNode":
    case "StateMergeNode":
    case "StateForkNode":
    case "StateForkNodeHorizontal": {
      const markerData: StateMarkerNodeProps = baseData
      return markerData
    }

    /* ---------------------------------------------------------------- */
    /* SA-4: AgentDiagram                                                 */
    /* ---------------------------------------------------------------- */

    case "AgentState": {
      // v3 `AgentState` extends `IUMLState` with an additional
      // `replyType: string` (default `'text'`). Pass through `stereotype`
      // / `italic` / `underline` like SA-3's `State`.
      //
      // SA-FIX-Agent: walk the v3 element table and fold every
      // `AgentStateBody` / `AgentStateFallbackBody` whose `owner` is
      // this state into the parent's `data.bodies` array. v3 stored a
      // `bodies: string[]` and `fallbackBodies: string[]` on the parent
      // pointing at child element ids; we honour that order if present
      // and fall back to insertion order. The original v3 element ids
      // are preserved on each row so the inverse migrator emits them
      // back with the same ids.
      const e = element as {
        stereotype?: string | null
        italic?: boolean
        underline?: boolean
        replyType?: string
        bodies?: string[]
        fallbackBodies?: string[]
      }
      const v3RowToV4 = (row: V3UMLElement) => {
        const r = row as V3UMLElement & {
          replyType?: string
          ragDatabaseName?: string
          dbSelectionType?: string
          dbCustomName?: string
          dbQueryMode?: string
          dbOperation?: string
          dbSqlQuery?: string
          code?: string
        }
        return {
          id: r.id,
          name: r.name,
          ...(r.replyType !== undefined && { replyType: r.replyType }),
          ...(r.ragDatabaseName !== undefined && {
            ragDatabaseName: r.ragDatabaseName,
          }),
          ...(r.dbSelectionType !== undefined && {
            dbSelectionType: r.dbSelectionType,
          }),
          ...(r.dbCustomName !== undefined && {
            dbCustomName: r.dbCustomName,
          }),
          ...(r.dbQueryMode !== undefined && { dbQueryMode: r.dbQueryMode }),
          ...(r.dbOperation !== undefined && { dbOperation: r.dbOperation }),
          ...(r.dbSqlQuery !== undefined && { dbSqlQuery: r.dbSqlQuery }),
          ...(r.code !== undefined && { code: r.code }),
          ...((r.fillColor as string | undefined) && {
            fillColor: r.fillColor,
          }),
          ...((r.textColor as string | undefined) && {
            textColor: r.textColor,
          }),
        }
      }
      const ownedByType = (
        type: "AgentStateBody" | "AgentStateFallbackBody"
      ): V3UMLElement[] =>
        Object.values(allElements).filter(
          (c) => c.owner === element.id && c.type === type
        )
      const orderedBodies: V3UMLElement[] =
        Array.isArray(e.bodies) && e.bodies.length > 0
          ? (e.bodies
              .map((bid) => allElements[bid])
              .filter(
                (b): b is V3UMLElement =>
                  !!b && b.type === "AgentStateBody"
              ) as V3UMLElement[])
          : ownedByType("AgentStateBody")
      const orderedFallbacks: V3UMLElement[] =
        Array.isArray(e.fallbackBodies) && e.fallbackBodies.length > 0
          ? (e.fallbackBodies
              .map((bid) => allElements[bid])
              .filter(
                (b): b is V3UMLElement =>
                  !!b && b.type === "AgentStateFallbackBody"
              ) as V3UMLElement[])
          : ownedByType("AgentStateFallbackBody")
      // v3 parity: main + fallback bodies live in separate arrays on the
      // parent. Replaces the prior `kind: 'fallback'` discriminator on each
      // body row — the row's container array IS the discriminator.
      const mainRows = orderedBodies.map(v3RowToV4)
      const fallbackRows = orderedFallbacks.map(v3RowToV4)
      return {
        ...baseData,
        replyType: e.replyType ?? "text",
        ...(e.stereotype !== undefined && { stereotype: e.stereotype }),
        ...(e.italic !== undefined && { italic: !!e.italic }),
        ...(e.underline !== undefined && { underline: !!e.underline }),
        ...(mainRows.length > 0 && { bodies: mainRows }),
        ...(fallbackRows.length > 0 && { fallbackBodies: fallbackRows }),
      }
    }

    case "AgentIntent": {
      // v3 `AgentIntent` extends `IUMLState` with `intent_description`.
      const e = element as {
        intent_description?: string
        stereotype?: string | null
        italic?: boolean
        underline?: boolean
      }
      return {
        ...baseData,
        ...(e.intent_description !== undefined && {
          intent_description: e.intent_description,
        }),
        ...(e.stereotype !== undefined && { stereotype: e.stereotype }),
        ...(e.italic !== undefined && { italic: !!e.italic }),
        ...(e.underline !== undefined && { underline: !!e.underline }),
      }
    }

    case "AgentIntentBody": {
      // v3 stored the training utterance verbatim on `name`.
      return baseData
    }

    case "AgentIntentDescription": {
      // v3 stored the description text on `name`.
      return baseData
    }

    case "AgentIntentObjectComponent": {
      const e = element as {
        entity?: string
        slot?: string
        value?: string
      }
      return {
        ...baseData,
        ...(e.entity !== undefined && { entity: e.entity }),
        ...(e.slot !== undefined && { slot: e.slot }),
        ...(e.value !== undefined && { value: e.value }),
      }
    }

    case "AgentRagElement": {
      // Open question #5: preserve BOTH `dbCustomName` and
      // `ragDatabaseName` verbatim. Display in the editor resolves
      // `dbCustomName ?? ragDatabaseName`; the BAF generator picks
      // based on `dbSelectionType`.
      const e = element as {
        ragDatabaseName?: string
        dbSelectionType?: string
        dbCustomName?: string
        dbQueryMode?: string
        dbOperation?: string
        dbSqlQuery?: string
        ragType?: string
      }
      return {
        ...baseData,
        ...(e.ragDatabaseName !== undefined && {
          ragDatabaseName: e.ragDatabaseName,
        }),
        ...(e.dbSelectionType !== undefined && {
          dbSelectionType: e.dbSelectionType,
        }),
        ...(e.dbCustomName !== undefined && { dbCustomName: e.dbCustomName }),
        ...(e.dbQueryMode !== undefined && { dbQueryMode: e.dbQueryMode }),
        ...(e.dbOperation !== undefined && { dbOperation: e.dbOperation }),
        ...(e.dbSqlQuery !== undefined && { dbSqlQuery: e.dbSqlQuery }),
        ...(e.ragType !== undefined && { ragType: e.ragType }),
      }
    }

    /* ---------------------------------------------------------------- */
    /* SA-4: UserDiagram                                                  */
    /* ---------------------------------------------------------------- */

    case "UserModelName": {
      // Spec open question #1: preserve `classId` / `className` for
      // parity with `ObjectName.classId`. Collapse `UserModelAttribute`
      // children onto `data.attributes` (like ObjectAttribute does).
      const attributes: Array<{
        id: string
        name: string
        attributeType?: string
        defaultValue?: unknown
        attributeOperator?: "<" | "<=" | "==" | ">=" | ">"
        attributeId?: string
        value?: unknown
        fillColor?: string
        textColor?: string
      }> = []
      Object.values(allElements).forEach((childElement) => {
        if (
          childElement.owner === element.id &&
          childElement.type === "UserModelAttribute"
        ) {
          const c = childElement as V3UMLElement & {
            attributeType?: string
            defaultValue?: unknown
            attributeOperator?: "<" | "<=" | "==" | ">=" | ">"
            attributeId?: string
            value?: unknown
          }
          // SA-2.2 #38: synthesize `attributeOperator` from the name
          // when the v3 fixture only embeds the comparator in the row's
          // `name` (`"age >= 18"` rather than as a separate field).
          // Mirrors v3's `extractComparatorFromName` at
          // `uml-user-model-attribute.ts:27-33`. When both are present
          // the explicit field wins (matching v3's `deserialize` order
          // at `uml-user-model-attribute.ts:73-77`).
          const synthesizedOperator =
            c.attributeOperator ??
            extractAttributeOperatorFromName(c.name)
          attributes.push({
            id: c.id,
            name: c.name,
            ...(c.attributeType !== undefined && {
              attributeType: c.attributeType,
            }),
            ...(c.defaultValue !== undefined && {
              defaultValue: c.defaultValue,
            }),
            ...(synthesizedOperator !== undefined && {
              attributeOperator: synthesizedOperator,
            }),
            ...(c.attributeId !== undefined && { attributeId: c.attributeId }),
            ...(c.value !== undefined && { value: c.value }),
            ...(c.fillColor && { fillColor: c.fillColor }),
            ...(c.textColor && { textColor: c.textColor }),
          })
        }
      })
      const e = element as {
        classId?: string
        className?: string
        description?: string
        icon?: string
        view?: "icon" | "attributes"
      }
      return {
        ...baseData,
        attributes,
        ...(e.classId && { classId: e.classId }),
        ...(e.className && { className: e.className }),
        ...(e.description && { description: e.description }),
        ...(() => {
          const iconChild = Object.values(allElements).find(
            (c) =>
              c.owner === element.id && c.type === "UserModelIcon"
          ) as { icon?: string } | undefined
          if (e.icon) return { icon: e.icon }
          if (iconChild?.icon) return { icon: iconChild.icon }
          return {}
        })(),
        // SA-FIX-USER-ICON: per-node render mode. v3 fixtures never
        // carry an explicit `view`, so default migrated UserModelName
        // nodes to `"icon"` to match the v3 fork's preferred preview.
        // A v4 fixture that already stamps `view: "attributes"` is
        // preserved verbatim.
        view: e.view ?? "icon",
      }
    }

    case "UserModelAttribute": {
      // Standalone (unowned) UserModelAttribute — rare; the migrator
      // collapses owned ones onto the parent. Preserve all fields.
      const e = element as {
        attributeType?: string
        defaultValue?: unknown
        attributeOperator?: "<" | "<=" | "==" | ">=" | ">"
      }
      // SA-2.2 #38 (also applies to unowned rows): synthesize the
      // comparator from `name` when not stored explicitly.
      const synthesized =
        e.attributeOperator ?? extractAttributeOperatorFromName(element.name)
      return {
        ...baseData,
        ...(e.attributeType !== undefined && {
          attributeType: e.attributeType,
        }),
        ...(e.defaultValue !== undefined && {
          defaultValue: e.defaultValue,
        }),
        ...(synthesized !== undefined && {
          attributeOperator: synthesized,
        }),
      }
    }

    case "UserModelIcon": {
      const e = element as { icon?: string }
      return {
        ...baseData,
        ...(e.icon !== undefined && { icon: e.icon }),
      }
    }

    /* ---------------------------------------------------------------- */
    /* SA-5: NNDiagram                                                    */
    /* ---------------------------------------------------------------- */

    case "Conv1DLayer":
    case "Conv2DLayer":
    case "Conv3DLayer":
    case "PoolingLayer":
    case "RNNLayer":
    case "LSTMLayer":
    case "GRULayer":
    case "LinearLayer":
    case "FlattenLayer":
    case "EmbeddingLayer":
    case "DropoutLayer":
    case "LayerNormalizationLayer":
    case "BatchNormalizationLayer":
    case "TensorOp":
    case "Configuration":
    case "TrainingDataset":
    case "TestDataset": {
      // Walk the v3 element table for every child whose `owner === layerId`
      // and whose `type` maps to a v4 attribute slug; aggregate into a
      // flat `attributes` dict. Open question #2: slugs that collide
      // across layer kinds (`dimension` on Pooling vs BatchNorm) are
      // emitted in qualified form (`pooling.dimension` /
      // `batch_normalization.dimension`).
      const attributes = collapseV3LayerAttributes(
        element.id,
        element.type,
        allElements
      )
      // The v3 `Name*Attribute*` element holds the same name as the
      // layer's `name` field; prefer the layer name (the v3 view's
      // canonical authoring surface), falling back to the attribute
      // value if the layer name is empty (per spec note in
      // `uml-v4-shape.md` NNDiagram §).
      const nameFromAttr = attributes["name"]
      if (
        (!element.name || element.name.trim() === "") &&
        typeof nameFromAttr === "string" &&
        nameFromAttr !== ""
      ) {
        ;(baseData as { name: string }).name = nameFromAttr
      }
      // The collapsed `name` attribute is redundant with the layer's
      // own `name` field — drop it from the `attributes` dict so the
      // round-trip doesn't double-write.
      if ("name" in attributes) delete attributes["name"]
      const e = element as {
        description?: string
        assessmentNote?: string
      }
      return {
        ...baseData,
        attributes,
        ...(e.description && { description: e.description }),
        ...(e.assessmentNote && { assessmentNote: e.assessmentNote }),
      }
    }

    case "NNContainer": {
      // Container retains name + optional entry-layer reference. v3
      // names this field variously (`entryLayer`, `inputLayer`); we
      // accept either and emit `entryLayerId` on v4.
      const e = element as {
        entryLayer?: string
        inputLayer?: string
        entryLayerId?: string
        description?: string
      }
      const entryLayerId = e.entryLayerId ?? e.entryLayer ?? e.inputLayer
      return {
        ...baseData,
        ...(entryLayerId && { entryLayerId }),
        ...(e.description && { description: e.description }),
      }
    }

    case "NNReference": {
      // SA-FIX-NN-ATTRS: v3's `NNReference` carries the referenced NN
      // on the legacy `referencedNN` slot (see
      // `packages/editor/.../nn-reference.ts`). The previous migrator
      // only knew about `referenceTarget` / `target` / `referencedId`
      // so legacy v3 fixtures silently lost their target. Accept
      // `referencedNN` first so round-trips through the live editor
      // preserve it.
      const e = element as {
        referenceTarget?: string
        target?: string
        referencedId?: string
        referencedNN?: string
      }
      const referenceTarget =
        e.referenceTarget ?? e.target ?? e.referencedId ?? e.referencedNN
      return {
        ...baseData,
        ...(referenceTarget && { referenceTarget }),
      }
    }

    // For other BPMN elements that just need base data
    case "BPMNSubprocess":
    case "BPMNTransaction":
    case "BPMNCallActivity":
    case "BPMNAnnotation":
    case "BPMNDataObject":
    case "BPMNDataStore":
    case "BPMNPool":
    case "BPMNGroup":
      return baseData

    default:
      // For all other node types, return base data
      return baseData
  }
}
/**
 * Convert V3 messages format to V4 MessageData array
 */
export function convertV3MessagesToV4(
  messages: V3Messages | MessageData[] | undefined
): MessageData[] {
  if (!messages) {
    return []
  }

  // If already V4 format (array), return as is
  if (Array.isArray(messages)) {
    return messages as MessageData[]
  }

  // If V3 format (object with IDs), convert to array
  if (typeof messages === "object" && messages !== null) {
    return Object.values(messages).map((message: V3Message) => ({
      text: message.name,
      direction: message.direction === "source" ? "target" : "source",
      id: message.id,
    }))
  }

  return []
}

/**
 * Convert v3 element to v4 node
 */
function convertV3ElementToV4Node(
  element: V3UMLElement,
  allElements: Record<string, V3UMLElement>
): BesserNode {
  const nodeType = convertV3NodeTypeToV4(element.type)
  let position = { x: element.bounds.x, y: element.bounds.y }
  if (element.owner) {
    const parent = allElements[element.owner]
    if (parent) {
      position = calculateRelativePosition(element, parent)
    }
  }

  const data = convertV3NodeDataToV4(element, allElements)
  const normalizedGeometry = normalizeImportedInterfaceGeometry(
    nodeType,
    position,
    element.bounds.width,
    element.bounds.height
  )

  const baseNode: BesserNode = {
    id: element.id,
    type: nodeType as any,
    position: normalizedGeometry.position,
    width: normalizedGeometry.width,
    height: normalizedGeometry.height,
    measured: {
      width: normalizedGeometry.width,
      height: normalizedGeometry.height,
    },
    data,
    ...(element.owner && { parentId: element.owner }),
  }

  return baseNode
}

/**
 * SA-4 AgentStateTransition data lifter.
 *
 * Collapses the 5 legacy v3 transition shapes into the canonical v4
 * `AgentStateTransitionData` (per `docs/source/migrations/uml-v4-shape.md`
 * "Legacy AgentStateTransition shapes"):
 *
 *   1. Canonical predefined: `{transitionType: 'predefined', predefined: {...}}`
 *   2. Canonical custom:     `{transitionType: 'custom', custom: {...}}`
 *   3. Legacy flat predefined: `{predefinedType, variable, operator, targetValue}`
 *      (and the file-received variant `{predefinedType, fileType}`)
 *   4. Legacy flat custom: `{condition: 'custom_transition', customEvent, customConditions}`
 *   5. Legacy nested: `{conditionValue: { events, conditions }}`
 *
 * Detection priority cascade (per the SA-4 brief):
 *   - `transitionType === 'custom'` → custom
 *   - `condition === 'custom_transition'` → custom
 *   - non-empty `custom.event` || `custom.condition` → custom
 *   - nested `conditionValue.events` || `conditionValue.conditions` → custom
 *   - otherwise → predefined with `predefinedType` resolved from
 *     `predefined.predefinedType ?? predefinedType ?? legacy condition`.
 *
 * Returns the `data` patch fragment (empty for non-agent edges so the
 * caller can spread it unconditionally). Also stamps `legacyShape` (1-5)
 * + the original `legacy` bag for round-trip preservation.
 */
function liftAgentTransitionDataToV4(
  relationship: V3UMLRelationship
): Record<string, unknown> {
  if (relationship.type !== "AgentStateTransition") return {}

  const r = relationship as V3UMLRelationship & {
    transitionType?: "predefined" | "custom"
    predefinedType?: string
    intentName?: string
    variable?: string
    operator?: string
    targetValue?: string
    fileType?: string
    event?: string
    customEvent?: string
    customConditions?: string[]
    conditions?: string[]
    condition?: string | string[]
    conditionValue?:
      | string
      | { variable?: string; operator?: string; targetValue?: string }
      | { events?: string[]; conditions?: string[] }
    predefined?: {
      predefinedType?: string
      intentName?: string
      fileType?: string
      conditionValue?:
        | string
        | { variable?: string; operator?: string; targetValue?: string }
    }
    custom?: {
      event?: string
      condition?: string[]
    }
    params?: Record<string, unknown>
  }

  const legacyConditionStr =
    typeof r.condition === "string" ? r.condition : undefined
  const legacyConditionArr = Array.isArray(r.condition) ? r.condition : undefined
  const nested = r.conditionValue as
    | { events?: string[]; conditions?: string[] }
    | undefined
  const hasNestedEventsConditions =
    !!nested &&
    typeof nested === "object" &&
    nested !== null &&
    ("events" in nested || "conditions" in nested) &&
    !("variable" in nested) &&
    !("operator" in nested)

  const hasExplicitCustomBag =
    !!r.custom &&
    ((typeof r.custom.event === "string" && r.custom.event !== "None") ||
      (Array.isArray(r.custom.condition) && r.custom.condition.length > 0))

  // Detect legacy shape for round-trip preservation.
  let legacyShape: 1 | 2 | 3 | 4 | 5 | undefined
  if (
    r.transitionType &&
    (r.predefined?.predefinedType !== undefined ||
      r.custom?.event !== undefined ||
      r.custom?.condition !== undefined)
  ) {
    legacyShape = r.transitionType === "custom" ? 2 : 1
  } else if (legacyConditionStr === "custom_transition") {
    legacyShape = 4
  } else if (hasNestedEventsConditions) {
    legacyShape = 5
  } else if (
    r.predefinedType !== undefined &&
    (r.variable !== undefined ||
      r.operator !== undefined ||
      r.targetValue !== undefined ||
      r.fileType !== undefined)
  ) {
    legacyShape = 3
  } else if (r.transitionType !== undefined) {
    // Brief's shape #5 — `transitionType` already present without
    // structured `predefined`/`custom`. (The brief calls this shape #5;
    // the spec doc reuses #5 for the nested events/conditions shape —
    // both legitimately collapse to the same canonical custom form.)
    legacyShape = 5
  }

  // Compute the `transitionType` per priority cascade.
  const isCustom =
    r.transitionType === "custom" ||
    legacyConditionStr === "custom_transition" ||
    hasExplicitCustomBag ||
    hasNestedEventsConditions ||
    r.customEvent !== undefined ||
    (Array.isArray(r.customConditions) && r.customConditions.length > 0)

  if (isCustom) {
    // Resolve event + conditions from the various legacy locations.
    let event: string =
      r.custom?.event ||
      r.event ||
      r.customEvent ||
      (hasNestedEventsConditions && nested?.events && nested.events.length > 0
        ? nested.events[0]!
        : "WildcardEvent")

    let condition: string[] = []
    if (Array.isArray(r.custom?.condition) && r.custom.condition.length > 0) {
      condition = r.custom.condition
    } else if (Array.isArray(r.conditions) && r.conditions.length > 0) {
      condition = r.conditions
    } else if (legacyConditionArr) {
      condition = legacyConditionArr
    } else if (
      Array.isArray(r.customConditions) &&
      r.customConditions.length > 0
    ) {
      condition = r.customConditions
    } else if (hasNestedEventsConditions && nested?.conditions) {
      condition = nested.conditions
    }

    return {
      transitionType: "custom" as const,
      custom: { event, condition },
      ...(legacyShape !== undefined && { legacyShape }),
      legacy: {
        ...(r.transitionType !== undefined && { transitionType: r.transitionType }),
        ...(r.predefined && { predefined: r.predefined }),
        ...(r.custom && { custom: r.custom }),
        ...(r.predefinedType !== undefined && {
          predefinedType: r.predefinedType,
        }),
        ...(r.condition !== undefined && { condition: r.condition }),
        ...(r.conditionValue !== undefined && {
          conditionValue: r.conditionValue,
        }),
        ...(r.event !== undefined && { event: r.event }),
        ...(r.customEvent !== undefined && { customEvent: r.customEvent }),
        ...(r.customConditions !== undefined && {
          customConditions: r.customConditions,
        }),
      },
    }
  }

  // Predefined branch.
  const predefinedType =
    r.predefined?.predefinedType ||
    r.predefinedType ||
    legacyConditionStr ||
    "when_intent_matched"
  const predefined: {
    predefinedType: string
    intentName?: string
    fileType?: string
    conditionValue?:
      | string
      | { variable?: string; operator?: string; targetValue?: string }
  } = { predefinedType }

  if (predefinedType === "when_intent_matched") {
    predefined.intentName =
      r.predefined?.intentName ??
      r.intentName ??
      (typeof r.predefined?.conditionValue === "string"
        ? r.predefined.conditionValue
        : typeof r.conditionValue === "string"
          ? r.conditionValue
          : "")
  } else if (predefinedType === "when_file_received") {
    predefined.fileType =
      r.predefined?.fileType ??
      r.fileType ??
      (typeof r.predefined?.conditionValue === "string"
        ? r.predefined.conditionValue
        : typeof r.conditionValue === "string"
          ? r.conditionValue
          : "")
  } else if (predefinedType === "when_variable_operation_matched") {
    // Prefer the structured form on `predefined.conditionValue`, else
    // fall back to flat fields, else the top-level `conditionValue`.
    const cv = r.predefined?.conditionValue
    if (
      typeof cv === "object" &&
      cv !== null &&
      "variable" in cv &&
      "operator" in cv &&
      "targetValue" in cv
    ) {
      predefined.conditionValue = {
        variable: (cv as { variable?: string }).variable ?? "",
        operator: (cv as { operator?: string }).operator ?? "",
        targetValue: (cv as { targetValue?: string }).targetValue ?? "",
      }
    } else if (
      r.variable !== undefined ||
      r.operator !== undefined ||
      r.targetValue !== undefined
    ) {
      predefined.conditionValue = {
        variable: r.variable ?? "",
        operator: r.operator ?? "",
        targetValue: r.targetValue ?? "",
      }
    } else if (
      typeof r.conditionValue === "object" &&
      r.conditionValue !== null &&
      "variable" in r.conditionValue
    ) {
      predefined.conditionValue = {
        variable:
          (r.conditionValue as { variable?: string }).variable ?? "",
        operator:
          (r.conditionValue as { operator?: string }).operator ?? "",
        targetValue:
          (r.conditionValue as { targetValue?: string }).targetValue ?? "",
      }
    }
  } else {
    // Plain conditionValue (string), e.g. `when_no_intent_matched` =>
    // empty string.
    if (typeof r.predefined?.conditionValue === "string") {
      predefined.conditionValue = r.predefined.conditionValue
    } else if (typeof r.conditionValue === "string") {
      predefined.conditionValue = r.conditionValue
    }
  }

  return {
    transitionType: "predefined" as const,
    predefined,
    ...(legacyShape !== undefined && { legacyShape }),
    legacy: {
      ...(r.transitionType !== undefined && { transitionType: r.transitionType }),
      ...(r.predefined && { predefined: r.predefined }),
      ...(r.custom && { custom: r.custom }),
      ...(r.predefinedType !== undefined && {
        predefinedType: r.predefinedType,
      }),
      ...(r.condition !== undefined && { condition: r.condition }),
      ...(r.conditionValue !== undefined && {
        conditionValue: r.conditionValue,
      }),
      ...(r.intentName !== undefined && { intentName: r.intentName }),
      ...(r.variable !== undefined && { variable: r.variable }),
      ...(r.operator !== undefined && { operator: r.operator }),
      ...(r.targetValue !== undefined && { targetValue: r.targetValue }),
      ...(r.fileType !== undefined && { fileType: r.fileType }),
    },
  }
}

/**
 * Convert v3 relationship to v4 edge
 */
function convertV3RelationshipToV4Edge(
  relationship: V3UMLRelationship
): BesserEdge {
  const edgeType = convertV3EdgeTypeToV4(
    relationship.type,
    relationship.flowType
  )
  let points: IPoint[] = []
  if (relationship.path && relationship.path.length > 0) {
    points = relationship.path.map((point) => ({
      x: point.x + relationship.bounds.x,
      y: point.y + relationship.bounds.y,
    }))
  }

  // SA-3: StateTransition carries params / guard / code / eventName
  // alongside the generic edge data. Pull those through verbatim — the
  // v3 deserializer at
  // `packages/editor/.../uml-state-transition.ts:14` treats `params` as
  // `string | string[] | { [id]: string }`; v4 normalises to dict.
  // SA-2.1: ObjectLink carries `associationId` at the v3 relationship
  // root level (see `packages/editor/.../uml-object-link.ts:9`). Pull
  // it through to the v4 edge `data` so the bridge-driven picker in
  // `ObjectLinkEditPanel` can author and round-trip the link to a
  // ClassDiagram association id.
  const r = relationship as V3UMLRelationship & {
    params?: string | string[] | { [id: string]: string }
    guard?: string
    code?: string
    eventName?: string
    associationId?: string
  }
  const normalizedParams: { [id: string]: string } = {}
  if (r.params !== undefined && r.params !== null) {
    if (typeof r.params === "string") {
      normalizedParams["0"] = r.params
    } else if (Array.isArray(r.params)) {
      r.params.forEach((p, idx) => {
        normalizedParams[idx.toString()] = p
      })
    } else if (typeof r.params === "object") {
      Object.assign(normalizedParams, r.params)
    }
  }

  const edge: BesserEdge = {
    id: relationship.id,
    source: relationship.source.element,
    target: relationship.target.element,
    type: edgeType as any,
    sourceHandle: convertV3HandleToV4(relationship.source.direction || ""),
    targetHandle: convertV3HandleToV4(relationship.target.direction || ""),
    data: {
      label: relationship.name || "",
      // SA-3: hoist `name` so the StateMachineDiagramEdge label-formatter
      // (`name [guard]`) can read a single field; keeps parity with v3.
      ...(relationship.name && { name: relationship.name }),
      sourceMultiplicity: relationship.source.multiplicity || "",
      targetMultiplicity: relationship.target.multiplicity || "",
      sourceRole: relationship.source.role || "",
      targetRole: relationship.target.role || "",
      isManuallyLayouted: relationship.isManuallyLayouted || false,
      messages: convertV3MessagesToV4(relationship.messages),
      // Preserve flowType for BPMN edges
      ...(relationship.flowType && { flowType: relationship.flowType }),
      // SA-3: StateTransition-specific data.
      ...(Object.keys(normalizedParams).length > 0 && {
        params: normalizedParams,
      }),
      ...(r.guard && { guard: r.guard }),
      ...(r.code && { code: r.code }),
      ...(r.eventName && { eventName: r.eventName }),
      // SA-2.1: ObjectLink-only field. Living on the same generic edge
      // data shape is fine because the v3 source-of-truth puts it at
      // the relationship root, alongside `name` / `path`. Other edge
      // types simply don't carry it.
      ...(r.associationId && { associationId: r.associationId }),

      // SA-4: AgentStateTransition canonical data — collapsed from the
      // five legacy v3 shapes (see `liftAgentTransitionDataToV4` and
      // `uml-v4-shape.md` "Legacy AgentStateTransition shapes" §). The
      // lifter is a no-op (returns `{}`) for any other edge type.
      ...liftAgentTransitionDataToV4(relationship),
      // Visual properties
      ...(relationship.fillColor && { fillColor: relationship.fillColor }),
      ...(relationship.strokeColor && {
        strokeColor: relationship.strokeColor,
      }),
      ...(relationship.textColor && { textColor: relationship.textColor }),
      ...(relationship.highlight && { highlight: relationship.highlight }),
      ...(relationship.assessmentNote && {
        assessmentNote: relationship.assessmentNote,
      }),
      points: points,
    },
  }

  return edge
}

/**
 * Convert V3 assessment to V4 assessment
 */
function convertV3AssessmentToV4(v3Assessment: V3Assessment): Assessment {
  return {
    modelElementId: v3Assessment.modelElementId,
    elementType: v3Assessment.elementType as any, // This needs proper typing
    score: v3Assessment.score,
    ...(v3Assessment.feedback && { feedback: v3Assessment.feedback }),
    ...(v3Assessment.dropInfo && { dropInfo: v3Assessment.dropInfo }),
    ...(v3Assessment.label && { label: v3Assessment.label }),
    ...(v3Assessment.labelColor && { labelColor: v3Assessment.labelColor }),
    ...(v3Assessment.correctionStatus && {
      correctionStatus: v3Assessment.correctionStatus,
    }),
  }
}

/**
 * Main conversion function from v3 to v4 format
 */
export function convertV3ToV4(v3Data: V3DiagramFormat | V3UMLModel): UMLModel {
  // Support both wrapped and flat V3 shapes
  const model: V3UMLModel =
    (v3Data as V3DiagramFormat).model || (v3Data as V3UMLModel)
  const id = (v3Data as V3DiagramFormat).id || "converted-diagram-" + Date.now()
  const title = (v3Data as V3DiagramFormat).title || ""

  const nodes: BesserNode[] = Object.values(model.elements)
    .filter((element) => {
      // Skip child rows that are collapsed into their owner's data.
      if (
        [
          "ClassAttribute",
          "ClassMethod",
          "ObjectAttribute",
          "ObjectMethod",
          "ObjectIcon",
        ].includes(element.type)
      ) {
        return false
      }
      // ClassOCLConstraint: collapse onto its owner class as a
      // `data.oclConstraints` row when an owner exists; otherwise keep
      // the node free-standing (rare). Spec recommendation:
      // `uml-v4-shape.md` ClassDiagram §.
      if (element.type === "ClassOCLConstraint") {
        const owner = element.owner ? model.elements[element.owner] : undefined
        if (
          owner &&
          ["Class", "AbstractClass", "Interface", "Enumeration"].includes(
            owner.type
          )
        ) {
          return false
        }
      }
      // SA-4: UserModelAttribute / UserModelIcon — collapse onto the
      // owner UserModelName when an owner exists. Standalone (unowned)
      // nodes survive for legacy round-trip.
      if (
        (element.type === "UserModelAttribute" ||
          element.type === "UserModelIcon") &&
        element.owner &&
        model.elements[element.owner]?.type === "UserModelName"
      ) {
        return false
      }
      // SA-FIX-Agent: AgentStateBody / AgentStateFallbackBody — collapse
      // onto the owner AgentState's `data.bodies` array. v3 carried
      // each body row as its own element connected via `owner`; v4
      // renders them inline on the parent like Class attribute rows.
      // The `convertV3ElementToV4Node` for `AgentState` walks the
      // element table and folds children onto `data.bodies` (preserving
      // their original ids for round-trip).
      if (
        (element.type === "AgentStateBody" ||
          element.type === "AgentStateFallbackBody") &&
        element.owner &&
        model.elements[element.owner]?.type === "AgentState"
      ) {
        return false
      }
      // SA-5: NN attribute child elements collapse onto their owner
      // layer's `data.attributes`. The slug map declares them
      // exhaustively. Section helpers (`NNSectionTitle`,
      // `NNSectionSeparator`) are sidebar-only — drop them entirely
      // per `uml-v4-shape.md` NNDiagram §.
      if (V3_ATTRIBUTE_TYPE_TO_SLUG[element.type] !== undefined) {
        return false
      }
      if (
        element.type === "NNSectionTitle" ||
        element.type === "NNSectionSeparator"
      ) {
        return false
      }
      return true
    })
    .map((element) => convertV3ElementToV4Node(element, model.elements))

  const edges: BesserEdge[] = Object.values(model.relationships).map(
    (relationship) => convertV3RelationshipToV4Edge(relationship)
  )

  const assessments: Record<string, Assessment> = {}
  if (model.assessments) {
    Object.entries(model.assessments).forEach(([id, v3Assessment]) => {
      try {
        assessments[id] = convertV3AssessmentToV4(v3Assessment)
      } catch (error) {
        log.warn(`Failed to convert assessment for element ${id}:`, error)
      }
    })
  }

  return {
    version: "4.0.0",
    id,
    title,
    type: model.type as UMLDiagramType,
    nodes,
    edges,
    assessments,
    interactive:
      model.interactive &&
      (Object.values(model.interactive.elements ?? {}).some(Boolean) ||
        Object.values(model.interactive.relationships ?? {}).some(Boolean))
        ? {
            elements: Object.fromEntries(
              Object.entries(model.interactive.elements ?? {}).filter(
                ([, included]) => included
              )
            ),
            relationships: Object.fromEntries(
              Object.entries(model.interactive.relationships ?? {}).filter(
                ([, included]) => included
              )
            ),
          }
        : undefined,
  }
}

/**
 * Check if data is in v3 format
 */
export function isV3Format(data: any): data is V3DiagramFormat {
  // Accept both wrapped ({ id, title, model: V3UMLModel }) and flat V3 model
  const wrapped =
    data &&
    data.model &&
    data.model.version &&
    typeof data.model.version === "string" &&
    data.model.version.startsWith("3.") &&
    data.model.elements &&
    data.model.relationships &&
    typeof data.model.elements === "object" &&
    typeof data.model.relationships === "object"

  const flat =
    data &&
    data.version &&
    typeof data.version === "string" &&
    data.version.startsWith("3.") &&
    data.elements &&
    data.relationships &&
    typeof data.elements === "object" &&
    typeof data.relationships === "object"

  return !!(wrapped || flat)
}

/**
 * Check if data is in v4 format
 */
export function isV4Format(data: any): data is UMLModel {
  return (
    data &&
    data.version &&
    data.version.startsWith("4.") &&
    Array.isArray(data.nodes) &&
    Array.isArray(data.edges)
  )
}

/**
 * BESSER ClassDiagram v3 → v4 migrator. Thin wrapper around `convertV3ToV4`
 * that asserts the input is a ClassDiagram so callers can fan out per
 * diagram type. The migration logic itself is in `convertV3ToV4` and the
 * shared `extractClassifierMember` / `extractOCLConstraint` helpers — they
 * handle the BESSER additions (full `IUMLClassifierMember` row shape, OCL
 * constraint collapse, legacy-name fallback parse).
 */
export function migrateClassDiagramV3ToV4(
  data: V3DiagramFormat | V3UMLModel
): UMLModel {
  const v4 = convertV3ToV4(data)
  if (v4.type !== "ClassDiagram") {
    throw new Error(
      `migrateClassDiagramV3ToV4: expected ClassDiagram, got ${v4.type}`
    )
  }
  return v4
}

/**
 * BESSER ObjectDiagram v3 → v4 migrator. See
 * `migrateClassDiagramV3ToV4` for the shared shape rules; ObjectDiagram
 * additionally lifts `classId` / `className` / `icon` onto the object node
 * and `attributeId` / `value` onto each attribute row.
 */
export function migrateObjectDiagramV3ToV4(
  data: V3DiagramFormat | V3UMLModel
): UMLModel {
  const v4 = convertV3ToV4(data)
  if (v4.type !== "ObjectDiagram") {
    throw new Error(
      `migrateObjectDiagramV3ToV4: expected ObjectDiagram, got ${v4.type}`
    )
  }
  return v4
}

/**
 * SA-3 StateMachineDiagram v3 → v4 migrator.
 *
 * Wraps `convertV3ToV4` with the per-diagram type guard. Per the SA-3
 * brief, this migrator does **not** collapse `StateBody` /
 * `StateFallbackBody` onto the parent state — those remain separate
 * React-Flow child nodes whose `parentId` points at the containing
 * `State`. That diverges from `uml-v4-shape.md`'s "collapse into
 * `data.bodies`" recommendation; the brief's React-Flow `parentId`
 * pattern wins because the State container resizes to accommodate
 * children dragged in from the palette in the v3 fork (see
 * `uml-state.ts::reorderChildren` / `uml-state.ts::render`), which
 * `parentId` reproduces directly without re-implementing reorder/auto-grow.
 */
export function migrateStateMachineDiagramV3ToV4(
  data: V3DiagramFormat | V3UMLModel
): UMLModel {
  const v4 = convertV3ToV4(data)
  if (v4.type !== "StateMachineDiagram") {
    throw new Error(
      `migrateStateMachineDiagramV3ToV4: expected StateMachineDiagram, got ${v4.type}`
    )
  }
  return v4
}

/**
 * SA-4 AgentDiagram v3 → v4 migrator. See
 * `migrateClassDiagramV3ToV4` for the shared shape rules; AgentDiagram
 * additionally:
 *  - Folds `AgentStateBody` / `AgentStateFallbackBody` onto the parent
 *    AgentState's `data.bodies[]` (SA-FIX-Agent).
 *  - Folds `AgentIntentBody` / `AgentIntentDescription` /
 *    `AgentIntentObjectComponent` onto the parent AgentIntent's
 *    `data.training_phrases[]` / `data.intent_description` /
 *    `data.entity_slots[]` inline arrays (SA-FIX-INTENT-INLINE). The
 *    fold happens via `normalizeV4Model` so legacy v4 fixtures and
 *    locally-stored projects converge on the inline shape too.
 *  - Collapses the 5 legacy `AgentStateTransition` shapes onto the
 *    canonical v4 `AgentStateTransitionData` via
 *    `liftAgentTransitionDataToV4`. The `legacy` bag is preserved on
 *    the edge data so the v3 → v4 → v3 cycle is information-equivalent.
 *  - Resolves spec open question #5: `AgentRagElement.dbCustomName` and
 *    `ragDatabaseName` are BOTH preserved verbatim on `data` — the
 *    editor renders `dbCustomName ?? ragDatabaseName`.
 */
export function migrateAgentDiagramV3ToV4(
  data: V3DiagramFormat | V3UMLModel
): UMLModel {
  const v4 = convertV3ToV4(data)
  if (v4.type !== "AgentDiagram") {
    throw new Error(
      `migrateAgentDiagramV3ToV4: expected AgentDiagram, got ${v4.type}`
    )
  }
  // SA-FIX-INTENT-INLINE: fold legacy intent children onto inline arrays
  // so callers always see the canonical v4 shape.
  return normalizeV4Model(v4)
}

/**
 * SA-4 UserDiagram v3 → v4 migrator. Wraps `convertV3ToV4` with the
 * type guard. The user-modelling diagram collapses
 * `UserModelAttribute` / `UserModelIcon` children onto their owner
 * `UserModelName` (per `uml-v4-shape.md` UserDiagram §); the migrator's
 * filter takes care of that.
 *
 * Spec open question #1 resolution: `classId` is preserved for parity
 * with `ObjectName.classId`.
 */
export function migrateUserDiagramV3ToV4(
  data: V3DiagramFormat | V3UMLModel
): UMLModel {
  const v4 = convertV3ToV4(data)
  if (v4.type !== "UserDiagram") {
    throw new Error(
      `migrateUserDiagramV3ToV4: expected UserDiagram, got ${v4.type}`
    )
  }
  return v4
}

/**
 * Reverse direction of `convertV3ToV4` for round-trip tests on the
 * BESSER diagram types this SA owns (ClassDiagram + ObjectDiagram).
 *
 * Semantics: emit a canonical v3 `UMLModel` from a v4 `UMLModel`,
 * re-expanding the collapsed child rows (`ClassAttribute`, `ClassMethod`,
 * `ObjectAttribute`, `ObjectMethod`, `ClassOCLConstraint`,
 * `ObjectIcon`) back into top-level `elements` keyed by id and pointing
 * at their owner via `owner`.
 *
 * Round-trip assertion: `convertV3ToV4(convertV4ToV3Class(m))` ⇔ `m` for
 * ClassDiagram and ObjectDiagram fixtures (modulo the canonicalisation
 * the migrator performs on legacy-format names — that's why the test
 * fixtures use the structured format).
 */
export function convertV4ToV3Class(v4: UMLModel): V3UMLModel {
  const elements: Record<string, V3UMLElement> = {}
  const relationships: Record<string, V3UMLRelationship> = {}

  // Map v4 `node.type === 'class'` + stereotype back to the v3 element type.
  const classV3Type = (stereotype?: ClassType | string | null): string => {
    if (stereotype === ClassType.Abstract) return "AbstractClass"
    if (stereotype === ClassType.Interface) return "Interface"
    if (stereotype === ClassType.Enumeration) return "Enumeration"
    return "Class"
  }

  for (const node of v4.nodes) {
    if (node.type === "class") {
      const data = node.data as ClassNodeProps
      // PC-1/PC-2/PC-11 fix (SA-FIX-Class): preserve freeform stereotype
      // + italic / underline / description / uri / icon on v3 emit.
      const isPredefinedStereotype =
        data.stereotype === ClassType.Abstract ||
        data.stereotype === ClassType.Interface ||
        data.stereotype === ClassType.Enumeration
      const v3Element: V3UMLElement & {
        stereotype?: string | null
        italic?: boolean
        underline?: boolean
        description?: string
        uri?: string
        icon?: string
      } = {
        id: node.id,
        name: data.name,
        type: classV3Type(data.stereotype),
        owner: node.parentId ?? null,
        bounds: {
          x: node.position.x,
          y: node.position.y,
          width: node.width,
          height: node.height,
        },
        attributes: data.attributes.map((a) => a.id),
        methods: data.methods.map((m) => m.id),
        ...(data.fillColor && { fillColor: data.fillColor }),
        ...(data.strokeColor && { strokeColor: data.strokeColor }),
        ...(data.textColor && { textColor: data.textColor }),
        ...(!isPredefinedStereotype && data.stereotype
          ? { stereotype: data.stereotype }
          : {}),
        ...(data.italic !== undefined && { italic: !!data.italic }),
        ...(data.underline !== undefined && { underline: !!data.underline }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.uri !== undefined && { uri: data.uri }),
        ...(data.icon !== undefined && { icon: data.icon }),
      }
      elements[node.id] = v3Element

      for (const attr of data.attributes) {
        elements[attr.id] = childRowToV3(attr, node.id, "ClassAttribute")
      }
      for (const m of data.methods) {
        elements[m.id] = childRowToV3(m, node.id, "ClassMethod")
      }
      for (const ocl of data.oclConstraints ?? []) {
        elements[ocl.id] = {
          id: ocl.id,
          name: ocl.name,
          type: "ClassOCLConstraint",
          owner: node.id,
          bounds: { x: 0, y: 0, width: 0, height: 0 },
          ...(ocl.expression !== undefined && {
            expression: ocl.expression,
          } as { expression?: string }),
          ...(ocl.description && { description: ocl.description } as {
            description?: string
          }),
          ...(ocl.kind && { kind: ocl.kind } as { kind?: string }),
        } as V3UMLElement & {
          expression?: string
          description?: string
          kind?: string
        }
      }
    } else if (node.type === "objectName") {
      const data = node.data as ObjectNodeProps
      const v3Element: V3UMLElement & {
        classId?: string
        className?: string
        stereotype?: string | null
      } = {
        id: node.id,
        name: data.name,
        type: "ObjectName",
        owner: node.parentId ?? null,
        bounds: {
          x: node.position.x,
          y: node.position.y,
          width: node.width,
          height: node.height,
        },
        attributes: data.attributes.map((a) => a.id),
        // SA-FIX-OBJECT-DEEP: object instances don't carry methods —
        // emit an empty `methods` array on the v3 element so the wire
        // shape stays compatible with consumers that read the field.
        methods: [],
        ...(data.fillColor && { fillColor: data.fillColor }),
        ...(data.strokeColor && { strokeColor: data.strokeColor }),
        ...(data.textColor && { textColor: data.textColor }),
        ...(data.classId && { classId: data.classId }),
        ...(data.className && { className: data.className }),
        // PC-4 Gap 1: re-emit stereotype on the v3 element so the round
        // trip preserves the `«…»` band.
        ...(data.stereotype !== undefined &&
          data.stereotype !== null && { stereotype: data.stereotype }),
      }
      elements[node.id] = v3Element

      for (const attr of data.attributes) {
        const child = childRowToV3(attr, node.id, "ObjectAttribute") as
          V3UMLElement & {
            attributeId?: string
            attributeType?: string
          }
        if (attr.attributeId) child.attributeId = attr.attributeId
        // Preserve the v3 "name = value" wire form when the row carries a
        // structured `value`. The collapse on the v4 side stripped `=
        // value` into a separate field; recombine on emit.
        if (attr.value !== undefined && attr.value !== null && attr.value !== "") {
          child.name = `${attr.name} = ${attr.value}`
        }
        elements[attr.id] = child
      }
      // SA-FIX-OBJECT-DEEP: no ObjectMethod rows to emit — object
      // instances don't carry methods.
      // Re-emit ObjectIcon as a separate child element when present.
      if (data.icon) {
        const iconId = `${node.id}-icon`
        elements[iconId] = {
          id: iconId,
          name: "",
          type: "ObjectIcon",
          owner: node.id,
          bounds: { x: 0, y: 0, width: 0, height: 0 },
          icon: data.icon,
        } as V3UMLElement & { icon?: string }
      }
    } else if (node.type === "ClassOCLConstraint") {
      // SA-UX-FIX B1: free-standing OCL constraint node — round-trip
      // back to a v3 `ClassOCLConstraint` element with the OCL body
      // stored in the v3-canonical `constraint` field.
      const data = node.data as {
        name?: string
        expression?: string
        description?: string
        kind?: string
      }
      elements[node.id] = {
        id: node.id,
        name: data.name ?? "",
        type: "ClassOCLConstraint",
        owner: node.parentId ?? null,
        bounds: {
          x: node.position.x,
          y: node.position.y,
          width: node.width,
          height: node.height,
        },
        ...(data.expression !== undefined && {
          constraint: data.expression,
        }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.kind !== undefined && { kind: data.kind }),
      } as V3UMLElement & {
        constraint?: string
        description?: string
        kind?: string
      }
    } else {
      // Other node types (e.g. Package): pass through with v3 type
      // recovery via the inverse type map. SA-2 only owns Class /
      // Object diagrams — anything else falls through to a best-effort
      // shape that other SAs can refine.
      elements[node.id] = {
        id: node.id,
        name: (node.data as { name?: string }).name ?? "",
        type: invertNodeType(node.type),
        owner: node.parentId ?? null,
        bounds: {
          x: node.position.x,
          y: node.position.y,
          width: node.width,
          height: node.height,
        },
      } as V3UMLElement
    }
  }

  for (const edge of v4.edges) {
    const data = (edge.data ?? {}) as Record<string, unknown>
    const points = (data.points as { x: number; y: number }[]) ?? []
    const minX = points.length ? Math.min(...points.map((p) => p.x)) : 0
    const minY = points.length ? Math.min(...points.map((p) => p.y)) : 0
    relationships[edge.id] = {
      id: edge.id,
      name: (data.name as string) ?? (data.label as string) ?? "",
      type: edge.type,
      owner: null,
      bounds: { x: minX, y: minY, width: 0, height: 0 },
      path: points.map((p) => ({ x: p.x - minX, y: p.y - minY })),
      source: {
        element: edge.source,
        direction: invertHandle(edge.sourceHandle),
        ...(typeof data.sourceMultiplicity === "string" &&
          data.sourceMultiplicity && {
            multiplicity: data.sourceMultiplicity as string,
          }),
        ...(typeof data.sourceRole === "string" && data.sourceRole && {
          role: data.sourceRole as string,
        }),
      },
      target: {
        element: edge.target,
        direction: invertHandle(edge.targetHandle),
        ...(typeof data.targetMultiplicity === "string" &&
          data.targetMultiplicity && {
            multiplicity: data.targetMultiplicity as string,
          }),
        ...(typeof data.targetRole === "string" && data.targetRole && {
          role: data.targetRole as string,
        }),
      },
      ...(data.isManuallyLayouted === true && { isManuallyLayouted: true }),
      ...(typeof data.flowType === "string" && {
        flowType: data.flowType as string,
      }),
      // SA-2.1: ObjectLink → v3 root-level `associationId`. Other edge
      // types never set this field, so the spread is a no-op for them.
      ...(typeof data.associationId === "string" &&
        data.associationId && {
          associationId: data.associationId as string,
        }),
    } as V3UMLRelationship
  }

  return {
    version: "3.0.0",
    type: v4.type,
    size: { width: 0, height: 0 },
    interactive: v4.interactive
      ? {
          elements: v4.interactive.elements,
          relationships: v4.interactive.relationships,
        }
      : { elements: {}, relationships: {} },
    elements,
    relationships,
    assessments:
      v4.assessments &&
      Object.fromEntries(
        Object.entries(v4.assessments).map(([id, a]) => [id, a as V3Assessment])
      ),
  } as V3UMLModel
}

/**
 * Helper: serialise one v4 row (`ClassNodeElement` / `ObjectNodeAttribute`)
 * back into a v3 `ClassAttribute` / `ClassMethod` / `ObjectAttribute` /
 * `ObjectMethod` element. Preserves all the structured BESSER fields so
 * `convertV3ToV4` can round-trip without falling back to the legacy
 * name parser.
 */
function childRowToV3(
  row: ClassNodeElement,
  ownerId: string,
  type: "ClassAttribute" | "ClassMethod" | "ObjectAttribute" | "ObjectMethod"
): V3UMLElement {
  const out: V3UMLElement & {
    visibility?: ClassifierVisibility
    attributeType?: string
    code?: string
    implementationType?: ClassifierMethodImplementationType
    stateMachineId?: string
    quantumCircuitId?: string
    isOptional?: boolean
    isDerived?: boolean
    isId?: boolean
    isExternalId?: boolean
    defaultValue?: unknown
    // SA-FINAL C2: ClassMethod-only fields. v3 v3 method elements
    // historically baked params + return type into the `name` string
    // ("foo(a: int): str"). The v4 row stores them as structured
    // `parameters[]` + `returnType`. Persist both back to v3 so a
    // round-trip cycle never loses data even though the legacy v3
    // inspector cannot edit them out of band.
    parameters?: { id: string; name: string; parameterType?: string; defaultValue?: unknown }[]
    returnType?: string
  } = {
    id: row.id,
    name: row.name,
    type,
    owner: ownerId,
    bounds: { x: 0, y: 0, width: 0, height: 0 },
    ...(row.fillColor && { fillColor: row.fillColor }),
    ...(row.textColor && { textColor: row.textColor }),
  }
  if (row.visibility !== undefined) out.visibility = row.visibility
  if (row.attributeType !== undefined) out.attributeType = row.attributeType
  if (row.code !== undefined) out.code = row.code
  if (row.implementationType !== undefined)
    out.implementationType = row.implementationType
  if (row.stateMachineId) out.stateMachineId = row.stateMachineId
  if (row.quantumCircuitId) out.quantumCircuitId = row.quantumCircuitId
  if (row.isOptional !== undefined) out.isOptional = row.isOptional
  if (row.isDerived !== undefined) out.isDerived = row.isDerived
  if (row.isId !== undefined) out.isId = row.isId
  if (row.isExternalId !== undefined) out.isExternalId = row.isExternalId
  if (row.defaultValue !== undefined) out.defaultValue = row.defaultValue
  // SA-FINAL C2: only emit on method rows. Attribute rows never set
  // these in v4 (they're documented "ignored on attribute rows").
  if (type === "ClassMethod" || type === "ObjectMethod") {
    if (Array.isArray(row.parameters) && row.parameters.length > 0) {
      out.parameters = row.parameters.map((p) => ({
        id: p.id,
        name: p.name,
        ...(p.parameterType !== undefined && { parameterType: p.parameterType }),
        ...(p.defaultValue !== undefined && { defaultValue: p.defaultValue }),
      }))
    }
    if (row.returnType !== undefined) out.returnType = row.returnType
  }
  return out
}

const invertNodeType = (v4Type: string): string => {
  const map: Record<string, string> = {
    class: "Class",
    package: "Package",
    objectName: "ObjectName",
    // SA-HIDE-NOISE: free-form sticky-note Comment. v3 element type is
    // `Comments` (plural — see `packages/editor/.../common/comments/`).
    comment: "Comments",
    // SA-3: StateMachine node-type strings are PascalCase identical to
    // v3 element types — falling through is correct, but listed here
    // for grep-ability.
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

    // SA-4: AgentDiagram + UserDiagram — passthrough.
    AgentState: "AgentState",
    AgentStateBody: "AgentStateBody",
    AgentStateFallbackBody: "AgentStateFallbackBody",
    AgentIntent: "AgentIntent",
    AgentIntentBody: "AgentIntentBody",
    AgentIntentDescription: "AgentIntentDescription",
    AgentIntentObjectComponent: "AgentIntentObjectComponent",
    AgentRagElement: "AgentRagElement",
    UserModelName: "UserModelName",
    UserModelAttribute: "UserModelAttribute",
    UserModelIcon: "UserModelIcon",

    // SA-5: NNDiagram passthrough for the inverse migrator.
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
  }
  return map[v4Type] ?? v4Type
}

/**
 * SA-3 inverse migrator: v4 StateMachineDiagram → v3 `UMLModel`.
 *
 * Mirrors `convertV4ToV3Class` but for the StateMachine universe. The
 * only structural rewrite is the body/fallback-body mapping: in v4 they
 * sit as children with `parentId`, and the parent state's v3 wire form
 * cached `bodies: string[]` / `fallbackBodies: string[]`. We rebuild
 * those arrays at emit time by walking the children once.
 *
 * Edge data round-trip:
 *  - `name`, `guard` pass through verbatim,
 *  - `params` dict is emitted in its richest form (object) — the v3
 *    deserializer accepts string / array / object, so this is the
 *    cleanest form for round-tripping,
 *  - `code` and `eventName` (BESSER additions per the SA-3 brief) are
 *    preserved on the relationship element.
 */
export function convertV4ToV3StateMachine(v4: UMLModel): V3UMLModel {
  const elements: Record<string, V3UMLElement> = {}
  const relationships: Record<string, V3UMLRelationship> = {}

  // Pre-index children by parentId so the State emitter can rebuild
  // the v3 `bodies` / `fallbackBodies` id arrays without quadratic walks.
  const childrenByParent: Record<
    string,
    { bodies: string[]; fallbackBodies: string[] }
  > = {}
  for (const node of v4.nodes) {
    if (!node.parentId) continue
    const slot = (childrenByParent[node.parentId] ||= {
      bodies: [],
      fallbackBodies: [],
    })
    // node.type is narrowed to upstream DiagramNodeType keys; widen with
    // a string cast since BESSER state types are runtime-registered.
    const nt = node.type as string
    if (nt === "StateBody") slot.bodies.push(node.id)
    else if (nt === "StateFallbackBody") slot.fallbackBodies.push(node.id)
  }

  for (const node of v4.nodes) {
    const baseV3: V3UMLElement = {
      id: node.id,
      name: (node.data as { name?: string }).name ?? "",
      type: invertNodeType(node.type as string),
      owner: node.parentId ?? null,
      bounds: {
        x: node.position.x,
        y: node.position.y,
        width: node.width,
        height: node.height,
      },
      ...((node.data as { fillColor?: string }).fillColor && {
        fillColor: (node.data as { fillColor?: string }).fillColor,
      }),
      ...((node.data as { strokeColor?: string }).strokeColor && {
        strokeColor: (node.data as { strokeColor?: string }).strokeColor,
      }),
      ...((node.data as { textColor?: string }).textColor && {
        textColor: (node.data as { textColor?: string }).textColor,
      }),
    }

    switch (node.type as string) {
      case "State": {
        const data = node.data as StateNodeProps
        const slot = childrenByParent[node.id]
        const stateOut = {
          ...baseV3,
          ...(data.stereotype !== undefined && {
            stereotype: data.stereotype as string | null,
          }),
          ...(data.italic !== undefined && { italic: data.italic }),
          ...(data.underline !== undefined && { underline: data.underline }),
          bodies: slot?.bodies ?? [],
          fallbackBodies: slot?.fallbackBodies ?? [],
          hasBody: (slot?.bodies.length ?? 0) > 0,
          hasFallbackBody: (slot?.fallbackBodies.length ?? 0) > 0,
        } as unknown as V3UMLElement
        elements[node.id] = stateOut
        break
      }
      case "StateBody":
      case "StateFallbackBody": {
        const data = node.data as StateBodyNodeProps & {
          code?: string
          kind?: string
        }
        const out: V3UMLElement & { code?: string; kind?: string } = {
          ...baseV3,
          ...(data.code !== undefined && { code: data.code }),
          ...(data.kind !== undefined && { kind: data.kind }),
        }
        elements[node.id] = out as V3UMLElement
        break
      }
      case "StateActionNode": {
        const data = node.data as StateActionNodeProps
        elements[node.id] = {
          ...baseV3,
          ...(data.code !== undefined && {
            code: data.code,
          }),
        } as V3UMLElement & { code?: string }
        break
      }
      case "StateObjectNode": {
        const data = node.data as StateObjectNodeProps
        elements[node.id] = {
          ...baseV3,
          ...(data.classId && { classId: data.classId }),
          ...(data.className && { className: data.className }),
        } as V3UMLElement & { classId?: string; className?: string }
        break
      }
      case "StateCodeBlock": {
        const data = node.data as StateCodeBlockProps
        elements[node.id] = {
          ...baseV3,
          code: data.code ?? "",
          language: data.language ?? "python",
        } as V3UMLElement & { code: string; language: string }
        break
      }
      case "StateInitialNode":
      case "StateFinalNode":
      case "StateMergeNode":
      case "StateForkNode":
      case "StateForkNodeHorizontal": {
        elements[node.id] = baseV3
        break
      }
      default: {
        // Other node types in a StateMachine fixture (unlikely): pass
        // through with a best-effort shape.
        elements[node.id] = baseV3
      }
    }
  }

  for (const edge of v4.edges) {
    const data = (edge.data ?? {}) as Record<string, unknown>
    const points = (data.points as { x: number; y: number }[]) ?? []
    const minX = points.length ? Math.min(...points.map((p) => p.x)) : 0
    const minY = points.length ? Math.min(...points.map((p) => p.y)) : 0
    const params = (data.params as { [k: string]: string } | undefined) ?? {}
    relationships[edge.id] = {
      id: edge.id,
      name: (data.name as string) ?? (data.label as string) ?? "",
      type: edge.type,
      owner: null,
      bounds: { x: minX, y: minY, width: 0, height: 0 },
      path: points.map((p) => ({ x: p.x - minX, y: p.y - minY })),
      source: {
        element: edge.source,
        direction: invertHandle(edge.sourceHandle),
      },
      target: {
        element: edge.target,
        direction: invertHandle(edge.targetHandle),
      },
      ...(Object.keys(params).length > 0 && { params }),
      ...(typeof data.guard === "string" && data.guard && {
        guard: data.guard,
      }),
      ...(typeof data.code === "string" && data.code && { code: data.code }),
      ...(typeof data.eventName === "string" && data.eventName && {
        eventName: data.eventName,
      }),
    } as V3UMLRelationship & {
      params?: { [k: string]: string }
      guard?: string
      code?: string
      eventName?: string
    }
  }

  return {
    version: "3.0.0",
    type: v4.type,
    size: { width: 0, height: 0 },
    interactive: v4.interactive
      ? {
          elements: v4.interactive.elements,
          relationships: v4.interactive.relationships,
        }
      : { elements: {}, relationships: {} },
    elements,
    relationships,
    assessments:
      v4.assessments &&
      Object.fromEntries(
        Object.entries(v4.assessments).map(([id, a]) => [id, a as V3Assessment])
      ),
  } as V3UMLModel
}

const invertHandle = (h: string | undefined): string => {
  if (!h) return ""
  const map: Record<string, string> = {
    top: "Up",
    right: "Right",
    bottom: "Down",
    left: "Left",
  }
  return map[h] ?? h
}

/* -------------------------------------------------------------------------- */
/* SA-4: AgentDiagram + UserDiagram reverse migrators                          */
/* -------------------------------------------------------------------------- */

type AgentTransitionV4 = {
  name?: string
  transitionType?: "predefined" | "custom"
  predefined?: {
    predefinedType?: string
    intentName?: string
    fileType?: string
    conditionValue?:
      | string
      | { variable?: string; operator?: string; targetValue?: string }
  }
  custom?: { event?: string; condition?: string[] }
  params?: { [k: string]: string }
  legacyShape?: 1 | 2 | 3 | 4 | 5
  legacy?: Record<string, unknown>
}

/**
 * SA-4 inverse migrator: v4 AgentDiagram → v3 `UMLModel`.
 *
 * Re-emits the canonical v3 wire shape (matching the most common writer
 * pattern — shapes #1 and #2 from the spec). The round-trip is
 * "v3 → v4 → v3' where v3' is canonicalised but information-equivalent";
 * the test asserts structural equality after a second migrate-back, not
 * literal equality with the original v3 input.
 *
 * For `AgentStateTransition`:
 *  - In the predefined branch, emit `{transitionType, predefined: {predefinedType,
 *    intentName?, fileType?, conditionValue?}, custom: {condition: []}}`.
 *  - In the custom branch, emit `{transitionType, predefined: {predefinedType: ''},
 *    custom: {event, condition}}`.
 */
export function convertV4ToV3Agent(v4: UMLModel): V3UMLModel {
  const elements: Record<string, V3UMLElement> = {}
  const relationships: Record<string, V3UMLRelationship> = {}

  for (const node of v4.nodes) {
    const nt = node.type as string
    const baseV3: V3UMLElement = {
      id: node.id,
      name: (node.data as { name?: string }).name ?? "",
      type: invertNodeType(nt),
      owner: node.parentId ?? null,
      bounds: {
        x: node.position.x,
        y: node.position.y,
        width: node.width,
        height: node.height,
      },
      ...((node.data as { fillColor?: string }).fillColor && {
        fillColor: (node.data as { fillColor?: string }).fillColor,
      }),
      ...((node.data as { strokeColor?: string }).strokeColor && {
        strokeColor: (node.data as { strokeColor?: string }).strokeColor,
      }),
      ...((node.data as { textColor?: string }).textColor && {
        textColor: (node.data as { textColor?: string }).textColor,
      }),
    }

    switch (nt) {
      case "AgentState": {
        // SA-FIX-Agent: re-expand the inline `data.bodies` array back
        // into top-level v3 elements (`AgentStateBody` /
        // `AgentStateFallbackBody`) with the original ids preserved.
        // The parent state also re-emits the v3 `bodies: string[]` /
        // `fallbackBodies: string[]` arrays so the v3 wire form is
        // round-trip equivalent.
        type AgentBodyRowV4 = {
          id: string
          name?: string
          code?: string
          replyType?: string
          ragDatabaseName?: string
          dbSelectionType?: string
          dbCustomName?: string
          dbQueryMode?: string
          dbOperation?: string
          dbSqlQuery?: string
          fillColor?: string
          textColor?: string
        }
        const data = node.data as Record<string, unknown> & {
          bodies?: AgentBodyRowV4[]
          fallbackBodies?: AgentBodyRowV4[]
        }
        const bodyIds: string[] = []
        const fallbackIds: string[] = []
        const emitRow = (row: AgentBodyRowV4, isFallback: boolean) => {
          const v3Type: string = isFallback
            ? "AgentStateFallbackBody"
            : "AgentStateBody"
          elements[row.id] = {
            id: row.id,
            name: row.name ?? "",
            type: v3Type,
            owner: node.id,
            bounds: { x: 0, y: 0, width: 0, height: 0 },
            ...(row.replyType !== undefined && { replyType: row.replyType }),
            ...(row.ragDatabaseName !== undefined && {
              ragDatabaseName: row.ragDatabaseName,
            }),
            ...(row.dbSelectionType !== undefined && {
              dbSelectionType: row.dbSelectionType,
            }),
            ...(row.dbCustomName !== undefined && {
              dbCustomName: row.dbCustomName,
            }),
            ...(row.dbQueryMode !== undefined && {
              dbQueryMode: row.dbQueryMode,
            }),
            ...(row.dbOperation !== undefined && {
              dbOperation: row.dbOperation,
            }),
            ...(row.dbSqlQuery !== undefined && {
              dbSqlQuery: row.dbSqlQuery,
            }),
            ...(row.code !== undefined && { code: row.code }),
            ...(row.fillColor && { fillColor: row.fillColor }),
            ...(row.textColor && { textColor: row.textColor }),
          } as V3UMLElement
          if (isFallback) fallbackIds.push(row.id)
          else bodyIds.push(row.id)
        }
        for (const row of data.bodies ?? []) emitRow(row, false)
        for (const row of data.fallbackBodies ?? []) emitRow(row, true)
        elements[node.id] = {
          ...baseV3,
          ...(data.replyType !== undefined && {
            replyType: data.replyType,
          }),
          ...(data.stereotype !== undefined && { stereotype: data.stereotype }),
          ...(data.italic !== undefined && { italic: !!data.italic }),
          ...(data.underline !== undefined && { underline: !!data.underline }),
          ...(bodyIds.length > 0 && { bodies: bodyIds }),
          ...(fallbackIds.length > 0 && { fallbackBodies: fallbackIds }),
        } as V3UMLElement
        break
      }
      case "AgentIntent": {
        const data = node.data as Record<string, unknown> & {
          training_phrases?: Array<{ id: string; name: string }>
          entity_slots?: Array<{
            id: string
            name: string
            entity?: string
            slot?: string
            value?: string
          }>
        }
        // SA-FIX-INTENT-INLINE: re-expand the inline arrays back into
        // top-level v3 elements. `training_phrases` → `AgentIntentBody`;
        // `entity_slots` → `AgentIntentObjectComponent`. Original row
        // ids are preserved so the v4 → v3 → v4 cycle keeps stable ids.
        //
        // v3 has no `AgentIntentDescription` element type; the parent's
        // `intent_description` carries the description on the v3 wire.
        // SA-2.2 #28: prefer the v4 parent's value, but fall back to a
        // legacy `AgentIntentDescription` child if older code left one
        // behind (during partial migrations).
        let intentDescription = data.intent_description as string | undefined
        if (intentDescription === undefined || intentDescription === "") {
          const descChild = v4.nodes.find(
            (c) =>
              c.parentId === node.id &&
              (c.type as string) === "AgentIntentDescription"
          )
          if (descChild) {
            const childName = (descChild.data as { name?: string }).name
            if (typeof childName === "string" && childName !== "") {
              intentDescription = childName
            }
          }
        }
        for (const phrase of data.training_phrases ?? []) {
          elements[phrase.id] = {
            id: phrase.id,
            name: phrase.name ?? "",
            type: "AgentIntentBody",
            owner: node.id,
            bounds: { x: 0, y: 0, width: 0, height: 0 },
          } as V3UMLElement
        }
        for (const slot of data.entity_slots ?? []) {
          elements[slot.id] = {
            id: slot.id,
            name: slot.name ?? "",
            type: "AgentIntentObjectComponent",
            owner: node.id,
            bounds: { x: 0, y: 0, width: 0, height: 0 },
            ...(slot.entity !== undefined && { entity: slot.entity }),
            ...(slot.slot !== undefined && { slot: slot.slot }),
            ...(slot.value !== undefined && { value: slot.value }),
          } as V3UMLElement
        }
        elements[node.id] = {
          ...baseV3,
          ...(intentDescription !== undefined && {
            intent_description: intentDescription,
          }),
          ...(data.stereotype !== undefined && { stereotype: data.stereotype }),
          ...(data.italic !== undefined && { italic: !!data.italic }),
          ...(data.underline !== undefined && { underline: !!data.underline }),
        } as V3UMLElement
        break
      }
      case "AgentIntentBody": {
        // SA-FIX-INTENT-INLINE: any surviving free-standing
        // `AgentIntentBody` (no parent intent) emits as-is for legacy
        // round-trip. The normaliser folds the owned ones onto the
        // parent's `training_phrases` so this case is rarely hit.
        elements[node.id] = baseV3
        break
      }
      case "AgentIntentDescription":
      case "AgentIntentObjectComponent": {
        // SA-2.2 #28: skip these EXTRA-in-v4 child types on export. v3
        // doesn't recognise `AgentIntentDescription` (it's absent from
        // the v3 `AgentElementType` registry); description content is
        // preserved on the parent intent's `intent_description` (rolled
        // up in the `AgentIntent` case above). SA-FIX-INTENT-INLINE:
        // `AgentIntentObjectComponent` rows are now re-emitted from the
        // parent's `entity_slots` array (rolled up in the `AgentIntent`
        // case above), so any free-standing `AgentIntentObjectComponent`
        // node (no parent intent) is also dropped here. Round-trip
        // parity is maintained because `migrateAgentDiagramV3ToV4` folds
        // the v3 children back onto the parent's inline arrays on
        // import.
        break
      }
      case "AgentRagElement": {
        const data = node.data as Record<string, unknown>
        // Open question #5: emit BOTH `ragDatabaseName` and
        // `dbCustomName` verbatim.
        elements[node.id] = {
          ...baseV3,
          ...(data.ragDatabaseName !== undefined && {
            ragDatabaseName: data.ragDatabaseName,
          }),
          ...(data.dbSelectionType !== undefined && {
            dbSelectionType: data.dbSelectionType,
          }),
          ...(data.dbCustomName !== undefined && {
            dbCustomName: data.dbCustomName,
          }),
          ...(data.dbQueryMode !== undefined && {
            dbQueryMode: data.dbQueryMode,
          }),
          ...(data.dbOperation !== undefined && {
            dbOperation: data.dbOperation,
          }),
          ...(data.dbSqlQuery !== undefined && {
            dbSqlQuery: data.dbSqlQuery,
          }),
          ...(data.ragType !== undefined && { ragType: data.ragType }),
        } as V3UMLElement
        break
      }
      default: {
        elements[node.id] = baseV3
      }
    }
  }

  for (const edge of v4.edges) {
    const data = (edge.data ?? {}) as Record<string, unknown> & AgentTransitionV4
    const points = (data.points as { x: number; y: number }[]) ?? []
    const minX = points.length ? Math.min(...points.map((p) => p.x)) : 0
    const minY = points.length ? Math.min(...points.map((p) => p.y)) : 0

    const baseRel: V3UMLRelationship = {
      id: edge.id,
      name: (data.name as string) ?? (data.label as string) ?? "",
      type: edge.type,
      owner: null,
      bounds: { x: minX, y: minY, width: 0, height: 0 },
      path: points.map((p) => ({ x: p.x - minX, y: p.y - minY })),
      source: {
        element: edge.source,
        direction: invertHandle(edge.sourceHandle),
      },
      target: {
        element: edge.target,
        direction: invertHandle(edge.targetHandle),
      },
    }

    if ((edge.type as string) === "AgentStateTransition") {
      // Emit the canonical wire form (shape #1 / #2 in the spec). The
      // round-trip test should compare via a normalization function
      // because the original v3 fixture's exact shape will not survive.
      const params = data.params ?? {}
      if (data.transitionType === "custom") {
        const ev = data.custom?.event ?? "WildcardEvent"
        const cond = data.custom?.condition ?? []
        relationships[edge.id] = {
          ...baseRel,
          transitionType: "custom",
          predefined: { predefinedType: "" },
          custom: { event: ev, condition: cond },
          ...(Object.keys(params).length > 0 && { params }),
        } as V3UMLRelationship
      } else {
        const pre = data.predefined ?? { predefinedType: "when_intent_matched" }
        relationships[edge.id] = {
          ...baseRel,
          transitionType: "predefined",
          predefined: pre,
          custom: { condition: [] },
          ...(Object.keys(params).length > 0 && { params }),
        } as V3UMLRelationship
      }
    } else {
      relationships[edge.id] = baseRel
    }
  }

  return {
    version: "3.0.0",
    type: v4.type,
    size: { width: 0, height: 0 },
    interactive: v4.interactive
      ? {
          elements: v4.interactive.elements,
          relationships: v4.interactive.relationships,
        }
      : { elements: {}, relationships: {} },
    elements,
    relationships,
    assessments:
      v4.assessments &&
      Object.fromEntries(
        Object.entries(v4.assessments).map(([id, a]) => [id, a as V3Assessment])
      ),
  } as V3UMLModel
}

/**
 * SA-4 inverse migrator: v4 UserDiagram → v3 `UMLModel`. Re-expands
 * the collapsed `UserModelAttribute` / `UserModelIcon` rows back into
 * top-level `elements` keyed by id and pointing at the owner via
 * `owner`.
 */
export function convertV4ToV3User(v4: UMLModel): V3UMLModel {
  const elements: Record<string, V3UMLElement> = {}
  const relationships: Record<string, V3UMLRelationship> = {}

  for (const node of v4.nodes) {
    const nt = node.type as string
    const baseV3: V3UMLElement = {
      id: node.id,
      name: (node.data as { name?: string }).name ?? "",
      type: invertNodeType(nt),
      owner: node.parentId ?? null,
      bounds: {
        x: node.position.x,
        y: node.position.y,
        width: node.width,
        height: node.height,
      },
      ...((node.data as { fillColor?: string }).fillColor && {
        fillColor: (node.data as { fillColor?: string }).fillColor,
      }),
      ...((node.data as { strokeColor?: string }).strokeColor && {
        strokeColor: (node.data as { strokeColor?: string }).strokeColor,
      }),
      ...((node.data as { textColor?: string }).textColor && {
        textColor: (node.data as { textColor?: string }).textColor,
      }),
    }

    if (nt === "UserModelName") {
      const data = node.data as Record<string, unknown> & {
        attributes?: Array<{
          id: string
          name: string
          attributeType?: string
          defaultValue?: unknown
          attributeOperator?: string
          attributeId?: string
          value?: unknown
          fillColor?: string
          textColor?: string
        }>
        classId?: string
        className?: string
        description?: string
        icon?: string
        view?: "icon" | "attributes"
      }
      const attrs = data.attributes ?? []
      elements[node.id] = {
        ...baseV3,
        attributes: attrs.map((a) => a.id),
        ...(data.classId && { classId: data.classId }),
        ...(data.className && { className: data.className }),
        ...(data.description && { description: data.description }),
        // SA-FIX-USER-ICON: preserve per-node view on v3 emit so a
        // v4 → v3 → v4 round-trip preserves the user's explicit choice
        // (the v3 → v4 migrator defaults `view` to `"icon"` when absent,
        // so a missing field on v3 also round-trips cleanly).
        ...(data.view && { view: data.view }),
      } as V3UMLElement & {
        attributes: string[]
        classId?: string
        className?: string
        description?: string
        view?: "icon" | "attributes"
      }

      // Re-expand attribute rows.
      for (const a of attrs) {
        elements[a.id] = {
          id: a.id,
          name: a.name,
          type: "UserModelAttribute",
          owner: node.id,
          bounds: { x: 0, y: 0, width: 0, height: 0 },
          ...(a.attributeType !== undefined && {
            attributeType: a.attributeType,
          }),
          ...(a.defaultValue !== undefined && {
            defaultValue: a.defaultValue,
          }),
          ...(a.attributeOperator !== undefined && {
            attributeOperator: a.attributeOperator,
          }),
          ...(a.attributeId !== undefined && { attributeId: a.attributeId }),
          ...(a.value !== undefined && { value: a.value }),
          ...(a.fillColor && { fillColor: a.fillColor }),
          ...(a.textColor && { textColor: a.textColor }),
        } as V3UMLElement
      }

      // Re-expand icon (rare).
      if (data.icon) {
        const iconId = `${node.id}-icon`
        elements[iconId] = {
          id: iconId,
          name: "",
          type: "UserModelIcon",
          owner: node.id,
          bounds: { x: 0, y: 0, width: 0, height: 0 },
          icon: data.icon,
        } as V3UMLElement & { icon?: string }
      }
    } else if (nt === "UserModelAttribute") {
      const data = node.data as Record<string, unknown>
      elements[node.id] = {
        ...baseV3,
        ...(data.attributeType !== undefined && {
          attributeType: data.attributeType,
        }),
        ...(data.defaultValue !== undefined && {
          defaultValue: data.defaultValue,
        }),
        ...(data.attributeOperator !== undefined && {
          attributeOperator: data.attributeOperator,
        }),
      } as V3UMLElement
    } else if (nt === "UserModelIcon") {
      const data = node.data as Record<string, unknown>
      elements[node.id] = {
        ...baseV3,
        ...(data.icon !== undefined && { icon: data.icon }),
      } as V3UMLElement
    } else {
      elements[node.id] = baseV3
    }
  }

  for (const edge of v4.edges) {
    const data = (edge.data ?? {}) as Record<string, unknown>
    const points = (data.points as { x: number; y: number }[]) ?? []
    const minX = points.length ? Math.min(...points.map((p) => p.x)) : 0
    const minY = points.length ? Math.min(...points.map((p) => p.y)) : 0
    relationships[edge.id] = {
      id: edge.id,
      name: (data.name as string) ?? (data.label as string) ?? "",
      type: edge.type,
      owner: null,
      bounds: { x: minX, y: minY, width: 0, height: 0 },
      path: points.map((p) => ({ x: p.x - minX, y: p.y - minY })),
      source: {
        element: edge.source,
        direction: invertHandle(edge.sourceHandle),
      },
      target: {
        element: edge.target,
        direction: invertHandle(edge.targetHandle),
      },
    } as V3UMLRelationship
  }

  return {
    version: "3.0.0",
    type: v4.type,
    size: { width: 0, height: 0 },
    interactive: v4.interactive
      ? {
          elements: v4.interactive.elements,
          relationships: v4.interactive.relationships,
        }
      : { elements: {}, relationships: {} },
    elements,
    relationships,
    assessments:
      v4.assessments &&
      Object.fromEntries(
        Object.entries(v4.assessments).map(([id, a]) => [id, a as V3Assessment])
      ),
  } as V3UMLModel
}

/* -------------------------------------------------------------------------- */
/* SA-5: NNDiagram migrator                                                    */
/* -------------------------------------------------------------------------- */

/**
 * SA-5 NNDiagram v3 → v4 migrator. Wraps `convertV3ToV4` with a type
 * guard. Big-picture changes vs. v3 (per `uml-v4-shape.md` NNDiagram §):
 *
 *  - Per-attribute UMLElements (e.g. `KernelDimAttributeConv2D`) collapse
 *    onto the parent layer's `data.attributes: Record<string, unknown>`.
 *    Booleans normalise to JS `boolean`; numerics stay strings to match
 *    the inline editor's text widget.
 *  - Layer nodes inside an `NNContainer` get `parentId = container.id`
 *    via the standard owner → parentId mapping in `convertV3ElementToV4Node`.
 *  - `NNReference.referenceTarget` survives as plain data.
 *  - Section helpers (`NNSectionTitle`, `NNSectionSeparator`) are dropped
 *    by the migrator.
 *
 * Open question #2: slugs that collide across layer kinds (`dimension`
 * on Pooling vs BatchNormalization) emit in qualified form
 * (`pooling.dimension` / `batch_normalization.dimension`). SA-6.1's
 * backend processor uses the same convention.
 */
export function migrateNNDiagramV3ToV4(
  data: V3DiagramFormat | V3UMLModel
): UMLModel {
  const v4 = convertV3ToV4(data)
  if (v4.type !== "NNDiagram") {
    throw new Error(
      `migrateNNDiagramV3ToV4: expected NNDiagram, got ${v4.type}`
    )
  }
  return v4
}

/** v4 layer-node kinds that share the flat-`attributes` shape. */
const NN_LAYER_KINDS: ReadonlySet<string> = new Set([
  "Conv1DLayer",
  "Conv2DLayer",
  "Conv3DLayer",
  "PoolingLayer",
  "RNNLayer",
  "LSTMLayer",
  "GRULayer",
  "LinearLayer",
  "FlattenLayer",
  "EmbeddingLayer",
  "DropoutLayer",
  "LayerNormalizationLayer",
  "BatchNormalizationLayer",
  "TensorOp",
  "Configuration",
  "TrainingDataset",
  "TestDataset",
])

/**
 * SA-5 inverse migrator: v4 NNDiagram → v3 `UMLModel`. Re-expands the
 * collapsed `data.attributes` dict back into per-attribute child
 * elements pointing at the layer via `owner`. The reconstructed v3
 * attribute element-type string is recovered from the (layerKind,
 * slug) pair via `v3AttributeTypeFor`. Attributes whose slugs aren't
 * recognised (rare; would only happen if the user added a custom
 * field via direct JSON editing) are dropped on emit — the round-trip
 * test fixtures use only canonical slugs.
 */
export function convertV4ToV3NN(v4: UMLModel): V3UMLModel {
  const elements: Record<string, V3UMLElement> = {}
  const relationships: Record<string, V3UMLRelationship> = {}

  for (const node of v4.nodes) {
    const nt = node.type as string
    const baseV3: V3UMLElement = {
      id: node.id,
      name: (node.data as { name?: string }).name ?? "",
      type: invertNodeType(nt),
      owner: node.parentId ?? null,
      bounds: {
        x: node.position.x,
        y: node.position.y,
        width: node.width,
        height: node.height,
      },
      ...((node.data as { fillColor?: string }).fillColor && {
        fillColor: (node.data as { fillColor?: string }).fillColor,
      }),
      ...((node.data as { strokeColor?: string }).strokeColor && {
        strokeColor: (node.data as { strokeColor?: string }).strokeColor,
      }),
      ...((node.data as { textColor?: string }).textColor && {
        textColor: (node.data as { textColor?: string }).textColor,
      }),
    }

    if (NN_LAYER_KINDS.has(nt)) {
      const data = node.data as Record<string, unknown> & {
        attributes?: Record<string, unknown>
        description?: string
        assessmentNote?: string
      }
      const attrs = data.attributes ?? {}
      // Re-emit one v3 element per (slug, value) pair.
      const ownedAttributeIds: string[] = []
      // Always synthesize the `Name*` attribute element that v3 expected
      // alongside the layer; its value is the layer's `name`.
      const nameType = v3AttributeTypeFor(nt, "name")
      if (nameType) {
        const nameId = `${node.id}-name`
        elements[nameId] = {
          id: nameId,
          name: nameType,
          type: nameType,
          owner: node.id,
          bounds: { x: 0, y: 0, width: 0, height: 0 },
          value: baseV3.name,
        } as V3UMLElement & { value?: unknown }
        ownedAttributeIds.push(nameId)
      }
      for (const [key, value] of Object.entries(attrs)) {
        // Strip the layer-kind prefix off qualified slugs.
        const plainSlug = key.includes(".") ? key.split(".").pop()! : key
        const v3Type = v3AttributeTypeFor(nt, plainSlug)
        if (!v3Type) continue
        const childId = `${node.id}-attr-${plainSlug}`
        const v3Value =
          typeof value === "boolean"
            ? value
              ? "true"
              : "false"
            : value === null || value === undefined
              ? ""
              : String(value)
        elements[childId] = {
          id: childId,
          name: v3Type,
          type: v3Type,
          owner: node.id,
          bounds: { x: 0, y: 0, width: 0, height: 0 },
          value: v3Value,
        } as V3UMLElement & { value?: unknown }
        ownedAttributeIds.push(childId)
      }
      elements[node.id] = {
        ...baseV3,
        ...(data.description && { description: data.description }),
        ...(data.assessmentNote && { assessmentNote: data.assessmentNote }),
        ownedElements: ownedAttributeIds,
      } as V3UMLElement & { ownedElements?: string[]; description?: string }
    } else if (nt === "NNContainer") {
      const data = node.data as Record<string, unknown> & {
        entryLayerId?: string
        description?: string
      }
      elements[node.id] = {
        ...baseV3,
        ...(data.entryLayerId && { entryLayerId: data.entryLayerId }),
        ...(data.description && { description: data.description }),
      } as V3UMLElement & { entryLayerId?: string; description?: string }
    } else if (nt === "NNReference") {
      // SA-FIX-NN-ATTRS: emit both the v4 `referenceTarget` and the v3
      // legacy `referencedNN` field so a round-trip through the v3
      // editor (which still reads `referencedNN`) preserves the
      // reference target.
      const data = node.data as Record<string, unknown> & {
        referenceTarget?: string
      }
      elements[node.id] = {
        ...baseV3,
        ...(data.referenceTarget && {
          referenceTarget: data.referenceTarget,
          referencedNN: data.referenceTarget,
        }),
      } as V3UMLElement & { referenceTarget?: string; referencedNN?: string }
    } else {
      elements[node.id] = baseV3
    }
  }

  for (const edge of v4.edges) {
    const data = (edge.data ?? {}) as Record<string, unknown>
    const points = (data.points as { x: number; y: number }[]) ?? []
    const minX = points.length ? Math.min(...points.map((p) => p.x)) : 0
    const minY = points.length ? Math.min(...points.map((p) => p.y)) : 0
    relationships[edge.id] = {
      id: edge.id,
      name: (data.name as string) ?? (data.label as string) ?? "",
      type: edge.type,
      owner: null,
      bounds: { x: minX, y: minY, width: 0, height: 0 },
      path: points.map((p) => ({ x: p.x - minX, y: p.y - minY })),
      source: {
        element: edge.source,
        direction: invertHandle(edge.sourceHandle),
      },
      target: {
        element: edge.target,
        direction: invertHandle(edge.targetHandle),
      },
    } as V3UMLRelationship
  }

  return {
    version: "3.0.0",
    type: v4.type,
    size: { width: 0, height: 0 },
    interactive: v4.interactive
      ? {
          elements: v4.interactive.elements,
          relationships: v4.interactive.relationships,
        }
      : { elements: {}, relationships: {} },
    elements,
    relationships,
    assessments:
      v4.assessments &&
      Object.fromEntries(
        Object.entries(v4.assessments).map(([id, a]) => [id, a as V3Assessment])
      ),
  } as V3UMLModel
}

/**
 * SA-FIX-CRITICAL-2 #1: normalise a v4 model on load.
 *
 * Per SA-FIX-Agent's inline-body design, `AgentStateBody` /
 * `AgentStateFallbackBody` MUST live on the parent AgentState's
 * `data.bodies` array — they must NEVER appear as separate top-level
 * React-Flow nodes. The v3→v4 migrator already folds them, but legacy
 * v4 fixtures (or future bugs that re-introduce floating bodies) can
 * still ship a model that violates the invariant.
 *
 * This pass walks the v4 nodes once, finds every floating body node
 * (no `parentId`), folds it onto the *nearest* AgentState (by Euclidean
 * distance from its `position`), and drops the floating node. Nodes
 * that already have a `parentId` pointing at a v4 AgentState are still
 * absorbed (they should never have been split children either, given
 * the inline-body shape). Orphans without any AgentState in the
 * diagram are dropped with a warning — there is no parent to attach
 * them to.
 */
export function normalizeAgentBodies(model: UMLModel): UMLModel {
  if (model.type !== "AgentDiagram") return model
  // SA-FIX-Agent removed `AgentStateBody` / `AgentStateFallbackBody`
  // from the canonical `DiagramNodeType` registry, so we compare against
  // the raw string form to detect legacy floating nodes.
  const isBodyType = (t: string): boolean =>
    t === "AgentStateBody" || t === "AgentStateFallbackBody"
  const isFallbackType = (t: string): boolean =>
    t === "AgentStateFallbackBody"
  const isAgentStateType = (t: string): boolean => t === "AgentState"

  const floatingBodies = model.nodes.filter((n) => isBodyType(n.type as string))
  if (floatingBodies.length === 0) return model

  const agentStates = model.nodes.filter((n) =>
    isAgentStateType(n.type as string)
  )
  if (agentStates.length === 0) {
    log.warn(
      `normalizeAgentBodies: dropping ${floatingBodies.length} floating ` +
        `AgentStateBody node(s) — no AgentState parent exists in the diagram.`
    )
    return {
      ...model,
      nodes: model.nodes.filter((n) => !isBodyType(n.type as string)),
    }
  }

  const distSq = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y)
  const findHostState = (body: BesserNode) => {
    if (body.parentId) {
      const p = agentStates.find((s) => s.id === body.parentId)
      if (p) return p
    }
    let best = agentStates[0]
    let bestD = distSq(best.position, body.position)
    for (let i = 1; i < agentStates.length; i++) {
      const d = distSq(agentStates[i].position, body.position)
      if (d < bestD) {
        best = agentStates[i]
        bestD = d
      }
    }
    return best
  }

  // Build per-host buckets of folded body rows, split by section. Replaces
  // the prior single-bucket approach that tagged rows with `kind: 'fallback'`.
  type RowBuckets = {
    bodies: Array<Record<string, unknown>>
    fallbackBodies: Array<Record<string, unknown>>
  }
  const newRowsByHost: Record<string, RowBuckets> = {}
  for (const body of floatingBodies) {
    const host = findHostState(body)
    const d = (body.data ?? {}) as {
      name?: string
      replyType?: string
      ragDatabaseName?: string
      dbSelectionType?: string
      dbCustomName?: string
      dbQueryMode?: string
      dbOperation?: string
      dbSqlQuery?: string
      code?: string
      fillColor?: string
      textColor?: string
    }
    const isFallback = isFallbackType(body.type as string)
    const row: Record<string, unknown> = {
      id: body.id,
      ...(d.name !== undefined && { name: d.name }),
      ...(d.replyType !== undefined && { replyType: d.replyType }),
      ...(d.ragDatabaseName !== undefined && {
        ragDatabaseName: d.ragDatabaseName,
      }),
      ...(d.dbSelectionType !== undefined && {
        dbSelectionType: d.dbSelectionType,
      }),
      ...(d.dbCustomName !== undefined && { dbCustomName: d.dbCustomName }),
      ...(d.dbQueryMode !== undefined && { dbQueryMode: d.dbQueryMode }),
      ...(d.dbOperation !== undefined && { dbOperation: d.dbOperation }),
      ...(d.dbSqlQuery !== undefined && { dbSqlQuery: d.dbSqlQuery }),
      ...(d.code !== undefined && { code: d.code }),
      ...(d.fillColor !== undefined && { fillColor: d.fillColor }),
      ...(d.textColor !== undefined && { textColor: d.textColor }),
    }
    if (!newRowsByHost[host.id])
      newRowsByHost[host.id] = { bodies: [], fallbackBodies: [] }
    if (isFallback) newRowsByHost[host.id].fallbackBodies.push(row)
    else newRowsByHost[host.id].bodies.push(row)
  }

  const nodes = model.nodes
    .filter((n) => !isBodyType(n.type as string))
    .map((n) => {
      if (!isAgentStateType(n.type as string)) return n
      const adds = newRowsByHost[n.id]
      if (!adds || (adds.bodies.length === 0 && adds.fallbackBodies.length === 0))
        return n
      const existingBodies =
        ((n.data as { bodies?: Array<Record<string, unknown>> }).bodies ?? [])
      const existingFallback =
        ((n.data as { fallbackBodies?: Array<Record<string, unknown>> })
          .fallbackBodies ?? [])
      return {
        ...n,
        data: {
          ...n.data,
          bodies: [...existingBodies, ...adds.bodies],
          fallbackBodies: [...existingFallback, ...adds.fallbackBodies],
        },
      } as BesserNode
    })

  log.warn(
    `normalizeAgentBodies: folded ${floatingBodies.length} floating ` +
      `AgentStateBody node(s) onto their parent AgentState's data.bodies.`
  )
  return { ...model, nodes }
}

/**
 * SA-FIX-INTENT-INLINE: fold legacy `AgentIntentBody` /
 * `AgentIntentDescription` / `AgentIntentObjectComponent` child nodes
 * onto their parent `AgentIntent.data.{training_phrases, intent_description,
 * entity_slots}`, then remove the children from the node list.
 *
 * v3 (and SA-4) rendered each row as a separate React-Flow node anchored
 * via `parentId`. The user requested the rows live inline on the parent
 * intent SVG, matching how `Class` renders attribute rows and
 * `AgentState` renders body rows. This normaliser runs on every model
 * load so legacy fixtures, templates, and locally-stored projects
 * surface the new inline shape.
 *
 *  - `AgentIntentBody` children → append `{id, name}` to
 *    `parent.data.training_phrases`.
 *  - `AgentIntentDescription` children → set
 *    `parent.data.intent_description` (only when the parent doesn't
 *    already have a non-empty value, so explicit parent text wins).
 *  - `AgentIntentObjectComponent` children → append
 *    `{id, name, entity, slot, value}` to `parent.data.entity_slots`.
 *  - Orphan intent children (no matching parent) are dropped along with
 *    any edges referencing them.
 *
 * Returns the input model by reference when no transformation was
 * needed.
 */
function normalizeAgentIntentChildren(model: UMLModel): UMLModel {
  if (model.type !== "AgentDiagram") return model
  const isIntentChildType = (t: string): boolean =>
    t === "AgentIntentBody" ||
    t === "AgentIntentDescription" ||
    t === "AgentIntentObjectComponent"
  const isAgentIntentType = (t: string): boolean => t === "AgentIntent"

  const intentIds = new Set(
    model.nodes
      .filter((n) => isAgentIntentType(n.type as string))
      .map((n) => n.id)
  )

  // Collect children to fold, grouped by parent intent.
  type PhraseRow = { id: string; name: string }
  type SlotRow = {
    id: string
    name: string
    entity?: string
    slot?: string
    value?: string
  }
  const phrasesByParent: Record<string, PhraseRow[]> = {}
  const slotsByParent: Record<string, SlotRow[]> = {}
  const descriptionByParent: Record<string, string> = {}
  const droppedIds = new Set<string>()
  const foldedIds = new Set<string>()

  for (const n of model.nodes) {
    if (!isIntentChildType(n.type as string)) continue
    if (!n.parentId || !intentIds.has(n.parentId)) {
      droppedIds.add(n.id)
      continue
    }
    const d = (n.data ?? {}) as Record<string, unknown>
    const name = typeof d.name === "string" ? d.name : ""
    const nodeType = n.type as string
    if (nodeType === "AgentIntentBody") {
      const row: PhraseRow = { id: n.id, name }
      ;(phrasesByParent[n.parentId] ??= []).push(row)
      foldedIds.add(n.id)
    } else if (nodeType === "AgentIntentDescription") {
      // First non-empty wins per parent; the parent's own
      // `intent_description` is preferred over child text downstream.
      if (
        descriptionByParent[n.parentId] === undefined ||
        descriptionByParent[n.parentId] === ""
      ) {
        descriptionByParent[n.parentId] = name
      }
      foldedIds.add(n.id)
    } else if (nodeType === "AgentIntentObjectComponent") {
      const row: SlotRow = {
        id: n.id,
        name,
        ...(typeof d.entity === "string" && { entity: d.entity }),
        ...(typeof d.slot === "string" && { slot: d.slot }),
        ...(typeof d.value === "string" && { value: d.value }),
      }
      ;(slotsByParent[n.parentId] ??= []).push(row)
      foldedIds.add(n.id)
    }
  }

  if (droppedIds.size === 0 && foldedIds.size === 0) return model

  const normalizedNodes: BesserNode[] = []
  for (const n of model.nodes) {
    if (droppedIds.has(n.id) || foldedIds.has(n.id)) continue
    if ((n.type as string) === "AgentIntent") {
      const phraseAdds = phrasesByParent[n.id] ?? []
      const slotAdds = slotsByParent[n.id] ?? []
      const descAdd = descriptionByParent[n.id]
      if (phraseAdds.length === 0 && slotAdds.length === 0 && descAdd === undefined) {
        normalizedNodes.push(n)
        continue
      }
      const existingData = (n.data ?? {}) as Record<string, unknown>
      const existingPhrases =
        (existingData.training_phrases as PhraseRow[] | undefined) ?? []
      const existingSlots =
        (existingData.entity_slots as SlotRow[] | undefined) ?? []
      const existingDescription =
        typeof existingData.intent_description === "string"
          ? existingData.intent_description
          : ""
      const mergedDescription =
        existingDescription !== "" ? existingDescription : descAdd ?? ""
      const nextData: Record<string, unknown> = {
        ...existingData,
        ...(phraseAdds.length > 0 && {
          training_phrases: [...existingPhrases, ...phraseAdds],
        }),
        ...(slotAdds.length > 0 && {
          entity_slots: [...existingSlots, ...slotAdds],
        }),
        ...(mergedDescription !== "" && {
          intent_description: mergedDescription,
        }),
      }
      normalizedNodes.push({ ...n, data: nextData } as BesserNode)
    } else {
      normalizedNodes.push(n)
    }
  }

  let nextEdges = model.edges
  if (droppedIds.size > 0 || foldedIds.size > 0) {
    const removed = new Set<string>([...droppedIds, ...foldedIds])
    nextEdges = model.edges.filter(
      (e) => !removed.has(e.source) && !removed.has(e.target)
    )
  }
  if (droppedIds.size > 0) {
    log.warn(
      `normalizeAgentIntentChildren: dropped ${droppedIds.size} orphan ` +
        `AgentIntent child node(s) — no matching AgentIntent parent.`
    )
  }
  if (foldedIds.size > 0) {
    log.warn(
      `normalizeAgentIntentChildren: folded ${foldedIds.size} legacy ` +
        `AgentIntent child node(s) onto their parent's inline data arrays.`
    )
  }
  return { ...model, nodes: normalizedNodes, edges: nextEdges }
}

/**
 * SA-FIX-AGENT-OCL: normalise OCL constraint node types. Templates
 * (Library_OCL.json, team_player_ocl.json) ship the canvas-level OCL
 * constraint with a lowercase `type: "classoclconstraint"` instead of
 * the canonical `type: "ClassOCLConstraint"` registered in the v4 node
 * registry, which prevents the React-Flow renderer from picking up the
 * right component. Re-keys legacy `constraint` field onto `expression`
 * so v3 wire-form OCL bodies surface in the inspector.
 */
function normalizeOCLConstraintNodes(model: UMLModel): UMLModel {
  const isLegacyOclType = (t: unknown): boolean =>
    typeof t === "string" && t.toLowerCase() === "classoclconstraint"
  const isLegacyOclLinkType = (t: unknown): boolean =>
    typeof t === "string" && t.toLowerCase() === "classocllink"

  let touchedNodes = 0
  const normalizedNodes = model.nodes.map((n) => {
    if (!isLegacyOclType(n.type)) return n
    touchedNodes += 1
    const d = (n.data ?? {}) as Record<string, unknown>
    const nextData: Record<string, unknown> = { ...d }
    if (
      (nextData.expression === undefined || nextData.expression === "") &&
      typeof nextData.constraint === "string"
    ) {
      nextData.expression = nextData.constraint
    }
    delete nextData.constraint
    return {
      ...n,
      type: "ClassOCLConstraint",
      data: nextData,
    } as BesserNode
  })

  let touchedEdges = 0
  const normalizedEdges = model.edges.map((e) => {
    if (!isLegacyOclLinkType(e.type)) return e
    touchedEdges += 1
    return { ...e, type: "ClassOCLLink" } as BesserEdge
  })

  if (touchedNodes === 0 && touchedEdges === 0) return model
  log.warn(
    `normalizeOCLConstraintNodes: normalised ${touchedNodes} OCL node ` +
      `type(s) and ${touchedEdges} OCL edge type(s) to canonical casing.`
  )
  return { ...model, nodes: normalizedNodes, edges: normalizedEdges }
}

/**
 * SA-FIX-AGENT-OCL: unconditional v4 normalization pass.
 *
 * Runs on EVERY model load — including `version: "4.0.0"` templates and
 * locally stored projects that bypass the v3→v4 migrator. Each sub-pass
 * returns the input model by reference when no transformation was
 * needed, so a clean v4 model flows through unchanged
 * (`normalizeV4Model(m) === m`).
 *
 * Pipeline:
 *  1. `normalizeAgentBodies` — fold orphan AgentStateBody /
 *     AgentStateFallbackBody onto their parent's `data.bodies`.
 *  2. `normalizeAgentIntentChildren` — ensure AgentIntent child rows
 *     render inline (extent + draggable) and drop orphans.
 *  3. `normalizeOCLConstraintNodes` — canonicalise the OCL node /
 *     edge type names (lowercase → PascalCase) and re-key legacy
 *     `constraint` field onto `expression`.
 */
export function normalizeV4Model(model: UMLModel): UMLModel {
  let m = model
  m = normalizeAgentBodies(m)
  m = normalizeAgentBodyKindToArrays(m)
  m = normalizeAgentIntentChildren(m)
  m = normalizeOCLConstraintNodes(m)
  return m
}

/**
 * Split legacy AgentState body rows that carry a `kind: "fallback"`
 * discriminator into the new `data.fallbackBodies[]` array. The `kind`
 * field is dropped from every body row regardless of value. Runs on every
 * v4 load so locally-stored projects from before the split surface in the
 * new shape.
 */
function normalizeAgentBodyKindToArrays(model: UMLModel): UMLModel {
  type LegacyRow = { id: string; kind?: string } & Record<string, unknown>
  let touched = 0
  const nodes = model.nodes.map((n) => {
    if (n.type !== "AgentState") return n
    const data = n.data as Record<string, unknown> & {
      bodies?: LegacyRow[]
      fallbackBodies?: LegacyRow[]
    }
    const bodies = data.bodies ?? []
    const hasLegacyKind = bodies.some((r) => r && r.kind !== undefined)
    if (!hasLegacyKind) return n
    const main: LegacyRow[] = []
    const fallback: LegacyRow[] = data.fallbackBodies
      ? data.fallbackBodies.slice()
      : []
    for (const r of bodies) {
      const { kind, ...rest } = r
      if (kind === "fallback") fallback.push(rest as LegacyRow)
      else main.push(rest as LegacyRow)
    }
    touched += 1
    return {
      ...n,
      data: {
        ...data,
        bodies: main,
        ...(fallback.length > 0 && { fallbackBodies: fallback }),
      },
    } as BesserNode
  })
  if (touched === 0) return model
  log.warn(
    `normalizeAgentBodyKindToArrays: migrated ${touched} AgentState node(s) ` +
      `from kind-discriminated bodies[] to split bodies[] / fallbackBodies[].`
  )
  return { ...model, nodes }
}

/**
 * Universal import function that handles v2, v3 and v4 formats
 */
export function importDiagram(data: any | V3UMLModel): UMLModel {
  if (isV4Format(data)) {
    // SA-FIX-CRITICAL-2 #1 / SA-FIX-AGENT-OCL: normalise v4 input on load.
    // Templates that ship `version: "4.0.0"` but the legacy
    // separate-child-nodes shape (orphan AgentStateBody, missing
    // extent/draggable on intent children, lowercase OCL types) are
    // canonicalised before the editor sees them.
    return normalizeV4Model(data)
  }

  if (isV3Format(data)) {
    // SA-FIX-AGENT-OCL: run the v4 normalizer over the migrator's
    // output as well — the v3→v4 fold logic can still leave orphans
    // and the resulting v4 model should be canonicalised before
    // reaching the editor.
    return normalizeV4Model(convertV3ToV4(data))
  }

  if (isV2Format(data)) {
    return normalizeV4Model(convertV2ToV4(data))
  }

  if (data.model) {
    //playground
    return importDiagram(data.model)
  }

  throw new Error(
    "Unsupported diagram format. Only 2.x.x, 3.x.x and 4.x.x formats are supported."
  )
}
