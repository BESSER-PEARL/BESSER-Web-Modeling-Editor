/* eslint-disable */
import { UMLModel, ApollonNode, ApollonEdge, Assessment } from "../typings"
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

      // Determine stereotype
      let stereotype: ClassType | undefined
      if (element.type === "AbstractClass") {
        stereotype = ClassType.Abstract
      } else if (element.type === "Interface") {
        stereotype = ClassType.Interface
      } else if (element.type === "Enumeration") {
        stereotype = ClassType.Enumeration
      }

      const classData: ClassNodeProps = {
        ...baseData,
        methods,
        attributes,
        ...(stereotype && { stereotype }),
        ...(oclConstraints.length > 0 && { oclConstraints }),
      }
      return classData
    }

    case "ObjectName": {
      const attributes: ObjectNodeAttribute[] = []
      const methods: ClassNodeElement[] = []

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
            methods.push(extractClassifierMember(childElement))
          }
        }
      })

      const objectData: ObjectNodeProps = {
        ...baseData,
        methods,
        attributes,
        ...((element as { classId?: string }).classId && {
          classId: (element as { classId?: string }).classId,
        }),
        ...((element as { className?: string }).className && {
          className: (element as { className?: string }).className,
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
      const e = element as {
        stereotype?: string | null
        italic?: boolean
        underline?: boolean
        replyType?: string
      }
      return {
        ...baseData,
        replyType: e.replyType ?? "text",
        ...(e.stereotype !== undefined && { stereotype: e.stereotype }),
        ...(e.italic !== undefined && { italic: !!e.italic }),
        ...(e.underline !== undefined && { underline: !!e.underline }),
      }
    }

    case "AgentStateBody":
    case "AgentStateFallbackBody": {
      // v3 `AgentStateMember` carries the optional reply-type-driven
      // extras alongside the basic name. Preserve them all so the v4 →
      // v3 → v4 cycle is lossless.
      const e = element as {
        replyType?: string
        ragDatabaseName?: string
        dbSelectionType?: string
        dbCustomName?: string
        dbQueryMode?: string
        dbOperation?: string
        dbSqlQuery?: string
        code?: string
        kind?: string
      }
      return {
        ...baseData,
        ...(e.replyType !== undefined && { replyType: e.replyType }),
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
        ...(e.code !== undefined && { code: e.code }),
        ...(e.kind !== undefined && { kind: e.kind }),
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
      const e = element as {
        referenceTarget?: string
        target?: string
        referencedId?: string
      }
      const referenceTarget = e.referenceTarget ?? e.target ?? e.referencedId
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
): ApollonNode {
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

  const baseNode: ApollonNode = {
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
): ApollonEdge {
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

  const edge: ApollonEdge = {
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

  const nodes: ApollonNode[] = Object.values(model.elements)
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

  const edges: ApollonEdge[] = Object.values(model.relationships).map(
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
 *  - Keeps `AgentStateBody` / `AgentStateFallbackBody` /
 *    `AgentIntentBody` / `AgentIntentDescription` as separate React-Flow
 *    children with `parentId` (mirrors SA-3's body/fallback-body
 *    decision — brief wins over spec).
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
  return v4
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
      const v3Element: V3UMLElement = {
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
        methods: data.methods.map((m) => m.id),
        ...(data.fillColor && { fillColor: data.fillColor }),
        ...(data.strokeColor && { strokeColor: data.strokeColor }),
        ...(data.textColor && { textColor: data.textColor }),
        ...(data.classId && { classId: data.classId }),
        ...(data.className && { className: data.className }),
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
      for (const m of data.methods) {
        elements[m.id] = childRowToV3(m, node.id, "ObjectMethod")
      }
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
  return out
}

const invertNodeType = (v4Type: string): string => {
  const map: Record<string, string> = {
    class: "Class",
    package: "Package",
    objectName: "ObjectName",
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
        const data = node.data as Record<string, unknown>
        elements[node.id] = {
          ...baseV3,
          ...(data.replyType !== undefined && {
            replyType: data.replyType,
          }),
          ...(data.stereotype !== undefined && { stereotype: data.stereotype }),
          ...(data.italic !== undefined && { italic: !!data.italic }),
          ...(data.underline !== undefined && { underline: !!data.underline }),
        } as V3UMLElement
        break
      }
      case "AgentStateBody":
      case "AgentStateFallbackBody": {
        const data = node.data as Record<string, unknown>
        elements[node.id] = {
          ...baseV3,
          ...(data.replyType !== undefined && { replyType: data.replyType }),
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
          ...(data.code !== undefined && { code: data.code }),
          ...(data.kind !== undefined && { kind: data.kind }),
        } as V3UMLElement
        break
      }
      case "AgentIntent": {
        const data = node.data as Record<string, unknown>
        // SA-2.2 #28: roll up the v4-only `AgentIntentDescription` child node
        // into the v3 parent's `intent_description` field. v3 has no
        // `AgentIntentDescription` element type (see
        // `packages/editor/.../agent-state-diagram/index.ts:AgentElementType`),
        // so emitting the child as a separate v3 element silently drops it
        // when v3 deserialises. Prefer the v4 parent's
        // `intent_description` if set; otherwise fall back to the
        // description child's `name`.
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
        elements[node.id] = baseV3
        break
      }
      case "AgentIntentDescription":
      case "AgentIntentObjectComponent": {
        // SA-2.2 #28: skip these EXTRA-in-v4 child types on export. v3
        // doesn't recognise `AgentIntentDescription` /
        // `AgentIntentObjectComponent` as element types (they're absent
        // from the v3 `AgentElementType` registry). Description content
        // is preserved on the parent intent's `intent_description`
        // (rolled up in the `AgentIntent` case above). Object-component
        // entity/slot/value data is currently unmapped on the v3 wire —
        // skipping prevents v3 deserialisers from emitting "unknown
        // element type" warnings or silently constructing an invalid
        // node. Round-trip parity is maintained because
        // `migrateAgentDiagramV3ToV4` re-creates these children from
        // the parent's `intent_description` text on import.
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
      }
      const attrs = data.attributes ?? []
      elements[node.id] = {
        ...baseV3,
        attributes: attrs.map((a) => a.id),
        ...(data.classId && { classId: data.classId }),
        ...(data.className && { className: data.className }),
        ...(data.description && { description: data.description }),
      } as V3UMLElement & {
        attributes: string[]
        classId?: string
        className?: string
        description?: string
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
      const data = node.data as Record<string, unknown> & {
        referenceTarget?: string
      }
      elements[node.id] = {
        ...baseV3,
        ...(data.referenceTarget && {
          referenceTarget: data.referenceTarget,
        }),
      } as V3UMLElement & { referenceTarget?: string }
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
 * Universal import function that handles v2, v3 and v4 formats
 */
export function importDiagram(data: any | V3UMLModel): UMLModel {
  if (isV4Format(data)) {
    return data
  }

  if (isV3Format(data)) {
    return convertV3ToV4(data)
  }

  if (isV2Format(data)) {
    return convertV2ToV4(data)
  }

  if (data.model) {
    //playground
    return importDiagram(data.model)
  }

  throw new Error(
    "Unsupported diagram format. Only 2.x.x, 3.x.x and 4.x.x formats are supported."
  )
}
