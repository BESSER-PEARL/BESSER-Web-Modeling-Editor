/**
 * v4 diagram-bridge: same singleton + listener API as the v3 version,
 * rewritten to walk `{nodes, edges}` arrays instead of `{elements,
 * relationships}` dicts.
 *
 * Ported from `packages/editor/src/main/services/diagram-bridge/diagram-bridge-service.ts`.
 * Singleton + readers (`getAvailableClasses`, `getRelatedClasses`,
 * `getAvailableAssociations`, `getClassHierarchy`) preserved verbatim in
 * shape — internals walk the v4 arrays.
 */
// Route non-fatal warnings through the editor's
// pub/sub so consumers attached via `subscribeToBesserErrors` see them.
// The console.warn/error fall-backs below stay for dev-tools visibility.
import { emitBesserError } from "@/services/errors"

/**
 * Interface for class diagram data structure (v4 wire shape).
 * `nodes`/`edges` are the React-Flow arrays from `UMLModel`.
 */
export interface IClassDiagramData {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  nodes: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  edges: any[]
}

/**
 * Interface for class information extracted from diagram data
 */
export interface IClassInfo {
  id: string
  name: string
  icon: string
  attributes: IAttributeInfo[]
}

/**
 * Interface for attribute information
 */
export interface IAttributeInfo {
  id: string
  name: string
  type: string
  visibility: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  defaultValue?: any
}

/**
 * Interface for association information
 */
export interface IAssociationInfo {
  id: string
  name?: string
  source: {
    element: string
    role?: string
    multiplicity?: string
  }
  target: {
    element: string
    role?: string
    multiplicity?: string
  }
}

/**
 * Interface for diagram references (state machines, quantum circuits, etc.)
 * Used to reference diagrams from method implementations
 */
export interface IDiagramReference {
  id: string
  name: string
}

/**
 * Service interface for bridging diagram data between different diagram types
 */
export interface IDiagramBridgeService {
  getClassDiagramData(): IClassDiagramData | null
  setClassDiagramData(data: IClassDiagramData): void
  getAvailableClasses(): IClassInfo[]
  getAvailableAssociations(sourceClassId: string, targetClassId: string): IAssociationInfo[]
  clearDiagramData(): void
  hasClassDiagramData(): boolean
  getRelatedClasses(classId: string): IClassInfo[]
  getStateMachineDiagrams(): IDiagramReference[]
  setStateMachineDiagrams(diagrams: IDiagramReference[]): void
  getQuantumCircuitDiagrams(): IDiagramReference[]
  setQuantumCircuitDiagrams(diagrams: IDiagramReference[]): void
}

const STEREOTYPE_INHERITANCE = "ClassInheritance"
const STEREOTYPE_REALIZATION = "ClassRealization"

const isClassNode = (node: { type?: string; data?: { stereotype?: string | null } }): boolean => {
  if (!node || typeof node !== "object") return false
  if (node.type === "class") return true
  // tolerate v3 stereotypes that may have leaked through (Class, AbstractClass, Interface, Enumeration)
  if (node.type === "Class" || node.type === "AbstractClass" || node.type === "Interface" || node.type === "Enumeration") {
    return true
  }
  return false
}

/**
 * Implementation of the diagram bridge service.
 *
 * Same listener / singleton API as the v3 version. The cached payload is
 * `{nodes, edges}` instead of `{elements, relationships}`, and all the
 * readers walk the v4 arrays.
 */
export class DiagramBridgeService implements IDiagramBridgeService {
  private classDiagramData: IClassDiagramData | null = null
  private readonly STORAGE_KEY = "besser-class-diagram-bridge-data"
  private stateMachineDiagrams: IDiagramReference[] = []
  private quantumCircuitDiagrams: IDiagramReference[] = []

  /**
   * Set class diagram data and persist it
   */
  setClassDiagramData(data: IClassDiagramData): void {
    this.classDiagramData = data
    // Persist to localStorage as backup
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data))
    } catch (error) {
      console.warn("Failed to persist class diagram data to localStorage:", error)
    }
  }

  /**
   * Get class diagram data with fallback to localStorage
   */
  getClassDiagramData(): IClassDiagramData | null {
    // Try memory first
    if (this.classDiagramData) {
      return this.classDiagramData
    }

    // Fallback to localStorage
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        // Tolerate legacy v3 cache shapes
        if (parsed && (parsed.nodes || parsed.elements)) {
          this.classDiagramData = {
            nodes: Array.isArray(parsed.nodes) ? parsed.nodes : Object.values(parsed.elements ?? {}),
            edges: Array.isArray(parsed.edges) ? parsed.edges : Object.values(parsed.relationships ?? {}),
          }
          return this.classDiagramData
        }
      }
    } catch (error) {
      console.warn("Failed to load class diagram data from localStorage:", error)
    }

    return null
  }

  /**
   * Get all classes that are related to the given class (excluding inheritance)
   */
  getRelatedClasses(classId: string): IClassInfo[] {
    const data = this.getClassDiagramData()
    if (!data) {
      return []
    }

    // Only consider relationships that are not inheritance
    const relatedClassIds = new Set<string>()
    for (const rel of data.edges || []) {
      if (rel?.type !== STEREOTYPE_INHERITANCE && rel?.source && rel?.target) {
        if (rel.source === classId) {
          relatedClassIds.add(rel.target)
        }
        if (rel.target === classId) {
          relatedClassIds.add(rel.source)
        }
      }
    }

    // For each related class, check for inheritance relationships where the related class is the parent (target)
    const additionalRelatedClassIds = new Set<string>()
    relatedClassIds.forEach((relatedId) => {
      for (const rel of data.edges || []) {
        if (rel?.type === STEREOTYPE_INHERITANCE && rel.target === relatedId && rel.source) {
          additionalRelatedClassIds.add(rel.source)
        }
      }
    })
    additionalRelatedClassIds.forEach((id) => relatedClassIds.add(id))

    // Check for inheritance relationships where classId is the source (child)
    for (const rel of data.edges || []) {
      if (rel?.type === STEREOTYPE_INHERITANCE && rel.source === classId && rel.target) {
        const inheritedRelated = this.getRelatedClasses(rel.target)
        inheritedRelated.forEach((cls) => relatedClassIds.add(cls.id))
      }
    }

    // Map related class IDs to IClassInfo objects
    const allClasses = this.getAvailableClasses()
    return allClasses.filter((cls) => relatedClassIds.has(cls.id))
  }

  /**
   * Extract available classes from the class diagram data
   */
  getAvailableClasses(): IClassInfo[] {
    const data = this.getClassDiagramData()
    if (!data) {
      return []
    }

    try {
      return (data.nodes || [])
        .filter((node) => isClassNode(node))
        .map((node) => {
          const allAttributes = this.getAllAttributesWithInheritance(node.id, data)
          const nodeData = (node.data ?? {}) as { name?: string; icon?: string }
          return {
            id: node.id as string,
            name: nodeData.name ?? "",
            icon: nodeData.icon ?? "",
            attributes: allAttributes,
          }
        })
    } catch (error) {
      console.error("Error extracting classes from diagram data:", error)
      emitBesserError({
        kind: "diagramBridge.extractClasses",
        message: "Malformed class-diagram payload — failed to extract classes",
        cause: error,
      })
      return []
    }
  }

  /**
   * Get all attributes for a class including inherited attributes
   */
  private getAllAttributesWithInheritance(classId: string, data: IClassDiagramData): IAttributeInfo[] {
    const attributes: IAttributeInfo[] = []
    const visited = new Set<string>()

    const findNode = (id: string) => (data.nodes || []).find((n) => n?.id === id)

    const collectAttributes = (currentClassId: string, isInherited: boolean = false) => {
      if (visited.has(currentClassId)) {
        return // Prevent infinite loops in case of circular inheritance
      }
      visited.add(currentClassId)

      const currentClass = findNode(currentClassId)
      if (!currentClass || !isClassNode(currentClass)) {
        return
      }

      // v4: attributes is an array of {id, name, attributeType, visibility, defaultValue}
      const memberRows = (currentClass.data?.attributes ?? []) as Array<{
        id: string
        name: string
        attributeType?: string
        visibility?: string
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        defaultValue?: any
      }>
      const classAttributes = memberRows.map((attr) => ({
        id: attr.id,
        name: attr.name,
        type: attr.attributeType || "str",
        visibility: attr.visibility || "public",
        defaultValue: attr.defaultValue,
        sourceClass: currentClass.data?.name ?? "",
        isInherited,
      }))

      // Add to beginning for proper inheritance order (parent first)
      attributes.unshift(...classAttributes)

      // Find parent classes through inheritance relationships
      // In inheritance: source = child class, target = parent class
      const inheritanceRelationships = (data.edges || []).filter(
        (rel) => rel?.type === STEREOTYPE_INHERITANCE && rel.source === currentClassId
      )

      inheritanceRelationships.forEach((rel) => {
        if (rel?.target) {
          collectAttributes(rel.target, true)
        }
      })
    }

    collectAttributes(classId)

    // Remove duplicates and return clean attribute info
    const uniqueAttributes = new Map<string, IAttributeInfo>()
    attributes.forEach((attr) => {
      if (!uniqueAttributes.has(attr.id)) {
        uniqueAttributes.set(attr.id, {
          id: attr.id,
          name: attr.name,
          type: attr.type,
          visibility: attr.visibility,
          defaultValue: attr.defaultValue,
        })
      }
    })

    return Array.from(uniqueAttributes.values())
  }

  /**
   * Get associations between two specific classes, including inherited associations
   */
  getAvailableAssociations(sourceClassId: string, targetClassId: string): IAssociationInfo[] {
    const data = this.getClassDiagramData()
    if (!data?.edges) {
      return []
    }

    try {
      const sourceClassIds = this.getAllClassesInHierarchy(sourceClassId)
      const targetClassIds = this.getAllClassesInHierarchy(targetClassId)

      const associations: IAssociationInfo[] = []
      const seenAssociationIds = new Set<string>()

      sourceClassIds.forEach((srcId) => {
        targetClassIds.forEach((tgtId) => {
          for (const edge of data.edges) {
            const isAssociationType =
              edge?.type !== STEREOTYPE_INHERITANCE && edge?.type !== STEREOTYPE_REALIZATION
            if (!isAssociationType) continue

            const matches =
              (edge.source === srcId && edge.target === tgtId) ||
              (edge.source === tgtId && edge.target === srcId)
            if (!matches) continue

            if (!seenAssociationIds.has(edge.id)) {
              seenAssociationIds.add(edge.id)
              const ed = (edge.data ?? {}) as {
                name?: string
                sourceRole?: string
                sourceMultiplicity?: string
                targetRole?: string
                targetMultiplicity?: string
              }
              associations.push({
                id: edge.id,
                name: ed.name,
                source: {
                  element: edge.source ?? "",
                  role: ed.sourceRole,
                  multiplicity: ed.sourceMultiplicity,
                },
                target: {
                  element: edge.target ?? "",
                  role: ed.targetRole,
                  multiplicity: ed.targetMultiplicity,
                },
              })
            }
          }
        })
      })

      return associations
    } catch (error) {
      console.error("Error extracting associations from diagram data:", error)
      emitBesserError({
        kind: "diagramBridge.extractAssociations",
        message: "Malformed class-diagram payload — failed to extract associations",
        cause: error,
      })
      return []
    }
  }

  /**
   * Get all classes in the inheritance hierarchy for a given class (including the class itself)
   */
  private getAllClassesInHierarchy(classId: string): string[] {
    const data = this.getClassDiagramData()
    if (!data) {
      return [classId]
    }

    const allClasses = new Set<string>()
    const visited = new Set<string>()

    const findNode = (id: string) => (data.nodes || []).find((n) => n?.id === id)

    const collectHierarchy = (currentClassId: string) => {
      if (visited.has(currentClassId)) {
        return
      }
      visited.add(currentClassId)

      const currentClass = findNode(currentClassId)
      if (!currentClass || !isClassNode(currentClass)) {
        return
      }

      allClasses.add(currentClassId)

      // Parents
      const parents = (data.edges || []).filter(
        (rel) => rel?.type === STEREOTYPE_INHERITANCE && rel.source === currentClassId
      )
      parents.forEach((rel) => {
        if (rel?.target) collectHierarchy(rel.target)
      })

      // Children
      const children = (data.edges || []).filter(
        (rel) => rel?.type === STEREOTYPE_INHERITANCE && rel.target === currentClassId
      )
      children.forEach((rel) => {
        if (rel?.source) collectHierarchy(rel.source)
      })
    }

    collectHierarchy(classId)
    return Array.from(allClasses)
  }

  /**
   * Clear all stored diagram data
   */
  clearDiagramData(): void {
    this.classDiagramData = null
    try {
      localStorage.removeItem(this.STORAGE_KEY)
    } catch (error) {
      console.warn("Failed to clear class diagram data from localStorage:", error)
    }
  }

  /**
   * Check if class diagram data is available
   */
  hasClassDiagramData(): boolean {
    return this.getClassDiagramData() !== null
  }

  /**
   * Generate a display name for a relationship
   * Used when the relationship doesn't have an explicit name
   */
  getRelationshipDisplayName(
    relationship: IAssociationInfo,
    sourceObjectName?: string,
    targetObjectName?: string
  ): string {
    // If the relationship has a name, use it
    if (relationship.name && relationship.name.trim()) {
      return relationship.name
    }

    // Create a name from the association role names
    const sourceRole = relationship.source?.role
    const targetRole = relationship.target?.role
    const sourceMultiplicity = relationship.source?.multiplicity
    const targetMultiplicity = relationship.target?.multiplicity

    // If we have role names and they're not empty, use them
    if (sourceRole && targetRole && sourceRole.trim() && targetRole.trim()) {
      return `${sourceRole}-${targetRole}`
    }

    // If we have multiplicities, use them as a fallback
    if (sourceMultiplicity && targetMultiplicity) {
      return `${sourceMultiplicity}-${targetMultiplicity}`
    }

    // Fallback to object names if available
    if (sourceObjectName && targetObjectName) {
      return `${sourceObjectName}-${targetObjectName}`
    }

    // Final fallback
    return `Association-${relationship.id.substring(0, 8)}`
  }

  /**
   * Get class by ID for verification purposes
   */
  getClassById(classId: string): IClassInfo | null {
    const availableClasses = this.getAvailableClasses()
    return availableClasses.find((cls) => cls.id === classId) || null
  }

  /**
   * Get inheritance hierarchy for a class (for debugging/display purposes)
   */
  getClassHierarchy(classId: string): string[] {
    const data = this.getClassDiagramData()
    if (!data) {
      return []
    }

    const hierarchy: string[] = []
    const visited = new Set<string>()

    const findNode = (id: string) => (data.nodes || []).find((n) => n?.id === id)

    const collectHierarchy = (currentClassId: string) => {
      if (visited.has(currentClassId)) {
        return
      }
      visited.add(currentClassId)

      const currentClass = findNode(currentClassId)
      if (!currentClass || !isClassNode(currentClass)) {
        return
      }
      hierarchy.push((currentClass.data?.name as string) ?? "")

      const inheritanceRelationships = (data.edges || []).filter(
        (rel) => rel?.type === STEREOTYPE_INHERITANCE && rel.source === currentClassId
      )

      inheritanceRelationships.forEach((rel) => {
        if (rel?.target) collectHierarchy(rel.target)
      })
    }

    collectHierarchy(classId)
    return hierarchy
  }

  /**
   * Get available state machine diagram references
   */
  getStateMachineDiagrams(): IDiagramReference[] {
    return this.stateMachineDiagrams
  }

  /**
   * Set available state machine diagram references
   */
  setStateMachineDiagrams(diagrams: IDiagramReference[]): void {
    this.stateMachineDiagrams = diagrams
  }

  /**
   * Get available quantum circuit diagram references
   */
  getQuantumCircuitDiagrams(): IDiagramReference[] {
    return this.quantumCircuitDiagrams
  }

  /**
   * Set available quantum circuit diagram references
   */
  setQuantumCircuitDiagrams(diagrams: IDiagramReference[]): void {
    this.quantumCircuitDiagrams = diagrams
  }
}

/**
 * Singleton instance of the diagram bridge service
 */
export const diagramBridge = new DiagramBridgeService()
