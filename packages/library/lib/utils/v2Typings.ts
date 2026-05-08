/* eslint-disable */
import { UMLDiagramType } from "../types/DiagramType"
import { IPoint } from "../edges/Connection"

/**
 * V2 Selection structure - uses arrays instead of objects
 */
export type V2Selection = {
  elements: string[]
  relationships: string[]
}

/**
 * V2 Assessment structure
 */
export type V2Assessment = {
  modelElementId: string
  elementType: string
  score: number
  feedback?: string
  dropInfo?: any
  label?: string
  labelColor?: string
  correctionStatus?: {
    description?: string
    status: "CORRECT" | "INCORRECT" | "NOT_VALIDATED"
  }
}

/**
 * Base V2 Model Element structure
 */
export type V2UMLModelElement = {
  id: string
  name: string
  type: string
  owner: string | null
  bounds: { x: number; y: number; width: number; height: number }
  highlight?: string
  fillColor?: string
  strokeColor?: string
  textColor?: string
  assessmentNote?: string
}

/**
 * V2 Element with additional properties based on element type
 */
export type V2UMLElement = V2UMLModelElement & {
  // Class-specific properties
  attributes?: string[]
  methods?: string[]
  // PetriNet-specific
  amountOfTokens?: number
  capacity?: number | string
  // Component/Deployment specific
  stereotype?: string
  displayStereotype?: boolean
  // BPMN specific
  taskType?: string
  marker?: string
  gatewayType?: string
  eventType?: string
  // Reachability Graph
  isInitialMarking?: boolean
}

/**
 * V2 Relationship structure
 */
export type V2UMLRelationship = V2UMLModelElement & {
  path: IPoint[]
  source: {
    element: string
    direction: string
    multiplicity?: string
    role?: string
  }
  target: {
    element: string
    direction: string
    multiplicity?: string
    role?: string
  }
  isManuallyLayouted?: boolean
  // BPMN specific
  flowType?: string
}

/**
 * V2 Communication Link - messages as array instead of object
 */
export type V2UMLCommunicationLink = V2UMLRelationship & {
  messages: Array<{
    id: string
    name: string
    direction: "source" | "target"
  }>
}

/**
 * Union type for V2 relationships
 */
export type V2UMLRelationshipCompat = V2UMLRelationship | V2UMLCommunicationLink

/**
 * V2 Model structure - uses arrays instead of objects with ID keys
 */
export type V2UMLModel = {
  version: `2.${number}.${number}`
  type: UMLDiagramType
  size: {
    width: number
    height: number
  }
  elements: V2UMLElement[] // Array instead of object
  interactive: V2Selection
  relationships: V2UMLRelationshipCompat[] // Array instead of object
  assessments: V2Assessment[] // Array instead of object
}

/**
 * V2 Diagram Format wrapper
 */
export type V2DiagramFormat = {
  id: string
  title: string
  model: V2UMLModel
  lastUpdate?: string
}

/**
 * Type guard to check if a relationship is a communication link in V2
 */
export function isV2CommunicationLink(
  rel: V2UMLRelationshipCompat
): rel is V2UMLCommunicationLink {
  return (
    rel.type === "CommunicationLink" &&
    "messages" in rel &&
    Array.isArray(rel.messages)
  )
}

/**
 * Type guard to check if data is in V2 format
 */
export function isV2Format(data: any): data is V2DiagramFormat {
  return (
    data &&
    data.model &&
    data.model.version &&
    data.model.version.startsWith("2.") &&
    Array.isArray(data.model.elements) &&
    Array.isArray(data.model.relationships) &&
    Array.isArray(data.model.assessments)
  )
}
