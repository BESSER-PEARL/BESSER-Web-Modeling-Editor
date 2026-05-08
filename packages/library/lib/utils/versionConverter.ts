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
} from "../types/nodes/NodeProps"
import { MessageData } from "@/edges/EdgeProps"
import { parseLegacyNameFormat } from "./classifierMemberDisplay"

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

  const edge: ApollonEdge = {
    id: relationship.id,
    source: relationship.source.element,
    target: relationship.target.element,
    type: edgeType as any,
    sourceHandle: convertV3HandleToV4(relationship.source.direction || ""),
    targetHandle: convertV3HandleToV4(relationship.target.direction || ""),
    data: {
      label: relationship.name || "",
      sourceMultiplicity: relationship.source.multiplicity || "",
      targetMultiplicity: relationship.target.multiplicity || "",
      sourceRole: relationship.source.role || "",
      targetRole: relationship.target.role || "",
      isManuallyLayouted: relationship.isManuallyLayouted || false,
      messages: convertV3MessagesToV4(relationship.messages),
      // Preserve flowType for BPMN edges
      ...(relationship.flowType && { flowType: relationship.flowType }),
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
  }
  return map[v4Type] ?? v4Type
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
