import { UMLElementType } from '../../packages/uml-element-type';
import { UMLRelationshipType } from '../../packages/uml-relationship-type';

/*
Updated inside model-state.ts
*/

/**
 * Interface for class diagram data structure
 */
export interface IClassDiagramData {
  elements: Record<string, any>;
  relationships: Record<string, any>;
}

/**
 * Interface for class information extracted from diagram data
 */
export interface IClassInfo {
  id: string;
  name: string;
  icon: string;
  attributes: IAttributeInfo[];
}

/**
 * Interface for attribute information
 */
export interface IAttributeInfo {
  id: string;
  name: string;
}

/**
 * Interface for association information
 */
export interface IAssociationInfo {
  id: string;
  name?: string;
  source: {
    element: string;
    role?: string;
    multiplicity?: string;
  };
  target: {
    element: string;
    role?: string;
    multiplicity?: string;
  };
}

/**
 * Service interface for bridging diagram data between different diagram types
 */
export interface IDiagramBridgeService {
  /**
   * Get the currently stored class diagram data
   */
  getClassDiagramData(): IClassDiagramData | null;

  /**
   * Set class diagram data for other diagrams to consume
   */
  setClassDiagramData(data: IClassDiagramData): void;

  /**
   * Get available classes from the stored class diagram
   */
  getAvailableClasses(): IClassInfo[];

  /**
   * Get available associations between two specific classes
   */
  getAvailableAssociations(sourceClassId: string, targetClassId: string): IAssociationInfo[];

  /**
   * Clear all stored diagram data
   */
  clearDiagramData(): void;

  /**
   * Check if class diagram data is available
   */
  hasClassDiagramData(): boolean;
  /**
   * Get all classes that are related to the given class (excluding inheritance)
   */
  getRelatedClasses(classId: string): IClassInfo[];
}

/**
 * Implementation of the diagram bridge service
 * This service acts as a bridge between different diagram types,
 * allowing object diagrams to access class diagram data
 */
export class DiagramBridgeService implements IDiagramBridgeService {
  /**
   * Get all classes that are related to the given class (excluding inheritance)
   */
  getRelatedClasses(classId: string): IClassInfo[] {
    const data = this.getClassDiagramData();
    if (!data) {
      return [];
    }

    // Only consider relationships that are not inheritance
    const relatedClassIds = new Set<string>();
    Object.values(data.relationships || {}).forEach((rel: any) => {
      if (
        rel.type !== 'ClassInheritance' &&
        rel.source?.element &&
        rel.target?.element
      ) {
        if (rel.source.element === classId) {
          relatedClassIds.add(rel.target.element);
        }
        if (rel.target.element === classId) {
          relatedClassIds.add(rel.source.element);
        }
      }
    });
    // For each related class, check for inheritance relationships where the related class is the parent (target)
    const additionalRelatedClassIds = new Set<string>();
    relatedClassIds.forEach(relatedId => {
      Object.values(data.relationships || {}).forEach((rel: any) => {
        if (
          rel.type === 'ClassInheritance' &&
          rel.target?.element === relatedId &&
          rel.source?.element
        ) {
          additionalRelatedClassIds.add(rel.source.element);
        }
      });
    });
    additionalRelatedClassIds.forEach(id => relatedClassIds.add(id));

    // Check for inheritance relationships where classId is the source (child)
    Object.values(data.relationships || {}).forEach((rel: any) => {
      if (rel.type === 'ClassInheritance' && rel.source?.element === classId && rel.target?.element) {
      const inheritedRelated = this.getRelatedClasses(rel.target.element);
      inheritedRelated.forEach(cls => relatedClassIds.add(cls.id));
      }
    });

    // Map related class IDs to IClassInfo objects
    const allClasses = this.getAvailableClasses();
    return allClasses.filter(cls => relatedClassIds.has(cls.id));
  }
  private classDiagramData: IClassDiagramData | null = null;
  private readonly STORAGE_KEY = 'besser-class-diagram-bridge-data';

  /**
   * Clean attribute name by removing visibility modifiers (+, -, #)
   */
  private cleanAttributeName(attributeName: string): string {
    if (!attributeName) return '';
    // Remove leading visibility modifiers and trim
    return attributeName.replace(/^[+\-#]\s*/, '').trim();
  }

  /**
   * Set class diagram data and persist it
   */
  setClassDiagramData(data: IClassDiagramData): void {
    this.classDiagramData = data;
    // Persist to localStorage as backup
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to persist class diagram data to localStorage:', error);
    }
  }

  /**
   * Get class diagram data with fallback to localStorage
   */
  getClassDiagramData(): IClassDiagramData | null {
    // Try memory first
    if (this.classDiagramData) {
      return this.classDiagramData;
    }

    // Fallback to localStorage
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.classDiagramData = JSON.parse(stored);
        return this.classDiagramData;
      }
    } catch (error) {
      console.warn('Failed to load class diagram data from localStorage:', error);
    }

    return null;
  }
  /**
   * Extract available classes from the class diagram data
   */
  getAvailableClasses(): IClassInfo[] {
    const data = this.getClassDiagramData();
    if (!data) {
      return [];
    }

    try {
      return Object.values(data.elements || {})
        .filter((element: any) => element.type === 'Class' || element.type === 'AbstractClass')
        .map((element: any) => {
          // Get all attributes including inherited ones
          const allAttributes = this.getAllAttributesWithInheritance(element.id, data);

          return {
            id: element.id,
            name: element.name,
            icon: element.icon,
            attributes: allAttributes
          };
        });
    } catch (error) {
      console.error('Error extracting classes from diagram data:', error);
      return [];
    }
  }

  /**
   * Get all attributes for a class including inherited attributes
   */
  private getAllAttributesWithInheritance(classId: string, data: IClassDiagramData): IAttributeInfo[] {
    const attributes: IAttributeInfo[] = [];
    const visited = new Set<string>();

    const collectAttributes = (currentClassId: string, isInherited: boolean = false) => {
      if (visited.has(currentClassId)) {
        return; // Prevent infinite loops in case of circular inheritance
      }
      visited.add(currentClassId);

      const currentClass = data.elements[currentClassId];
      if (!currentClass || (currentClass.type !== 'Class' && currentClass.type !== 'AbstractClass')) {
        return;
      }

      // Add direct attributes of this class
      const classAttributes = (currentClass.attributes || [])
        .map((attrId: string) => {
          const attribute = data.elements[attrId];
          if (attribute) {
            return {
              id: attrId,
              name: this.cleanAttributeName(attribute.name),
              sourceClass: currentClass.name,
              isInherited: isInherited
            };
          }
          return null;
        })
        .filter((attr: any) => attr !== null) as (IAttributeInfo & { sourceClass: string; isInherited: boolean })[];

      // Add to beginning for proper inheritance order (parent first)
      attributes.unshift(...classAttributes);
      // Find parent classes through inheritance relationships
      // In inheritance: source = child class, target = parent class
      // So when we're looking for parents of currentClassId, we need to find relationships
      // where currentClassId is the SOURCE (child) and get the TARGET (parent)
      const inheritanceRelationships = Object.values(data.relationships || {})
        .filter((rel: any) =>
          rel.type === 'ClassInheritance' &&
          rel.source?.element === currentClassId
        );

      // Recursively collect from parent classes (targets of inheritance relationships)
      inheritanceRelationships.forEach((rel: any) => {
        if (rel.target?.element) {
          collectAttributes(rel.target.element, true);
        }
      });
    };

    collectAttributes(classId);

    // Remove duplicates and return clean attribute info
    const uniqueAttributes = new Map<string, IAttributeInfo>();
    attributes.forEach(attr => {
      if (!uniqueAttributes.has(attr.id)) {
        uniqueAttributes.set(attr.id, {
          id: attr.id,
          name: attr.name
        });
      }
    });

    return Array.from(uniqueAttributes.values());
  }
  /**
   * Get associations between two specific classes, including inherited associations
   */
  getAvailableAssociations(sourceClassId: string, targetClassId: string): IAssociationInfo[] {
    const data = this.getClassDiagramData();
    if (!data?.relationships) {
      return [];
    }

    try {
      // Get all possible class IDs including inheritance hierarchy
      const sourceClassIds = this.getAllClassesInHierarchy(sourceClassId);
      const targetClassIds = this.getAllClassesInHierarchy(targetClassId);

      const associations: IAssociationInfo[] = [];
      const seenAssociationIds = new Set<string>();

      // Check all combinations of source and target classes (including their hierarchies)
      sourceClassIds.forEach(srcId => {
        targetClassIds.forEach(tgtId => {
          Object.values(data.relationships)
            .filter((relationship: any) => {
              // Only include association-type relationships (not inheritance)
              const isAssociationType = relationship.type !== 'ClassInheritance' &&
                relationship.type !== 'ClassRealization';

              if (!isAssociationType) return false;

              // Check if relationship connects the classes (in either direction)
              return (
                (relationship.source?.element === srcId && relationship.target?.element === tgtId) ||
                (relationship.source?.element === tgtId && relationship.target?.element === srcId)
              );
            })
            .forEach((relationship: any) => {
              // Avoid duplicate associations
              if (!seenAssociationIds.has(relationship.id)) {
                seenAssociationIds.add(relationship.id);
                associations.push({
                  id: relationship.id,
                  name: relationship.name,
                  source: {
                    element: relationship.source?.element || '',
                    role: relationship.source?.role,
                    multiplicity: relationship.source?.multiplicity
                  },
                  target: {
                    element: relationship.target?.element || '',
                    role: relationship.target?.role,
                    multiplicity: relationship.target?.multiplicity
                  }
                });
              }
            });
        });
      });

      return associations;
    } catch (error) {
      console.error('Error extracting associations from diagram data:', error);
      return [];
    }
  }

  /**
   * Get all classes in the inheritance hierarchy for a given class (including the class itself)
   */
  private getAllClassesInHierarchy(classId: string): string[] {
    const data = this.getClassDiagramData();
    if (!data) {
      return [classId];
    }

    const allClasses = new Set<string>();
    const visited = new Set<string>();

    const collectHierarchy = (currentClassId: string) => {
      if (visited.has(currentClassId)) {
        return; // Prevent infinite loops
      }
      visited.add(currentClassId);

      const currentClass = data.elements[currentClassId];
      if (!currentClass || (currentClass.type !== 'Class' && currentClass.type !== 'AbstractClass')) {
        return;
      }

      allClasses.add(currentClassId);

      // Find parent classes through inheritance relationships
      // In inheritance: source = child class, target = parent class
      const inheritanceRelationships = Object.values(data.relationships || {})
        .filter((rel: any) =>
          rel.type === 'ClassInheritance' &&
          rel.source?.element === currentClassId
        );

      inheritanceRelationships.forEach((rel: any) => {
        if (rel.target?.element) {
          collectHierarchy(rel.target.element);
        }
      });

      // Also find child classes (classes that inherit from this one)
      const childInheritanceRelationships = Object.values(data.relationships || {})
        .filter((rel: any) =>
          rel.type === 'ClassInheritance' &&
          rel.target?.element === currentClassId
        );

      childInheritanceRelationships.forEach((rel: any) => {
        if (rel.source?.element) {
          collectHierarchy(rel.source.element);
        }
      });
    };

    collectHierarchy(classId);
    return Array.from(allClasses);
  }

  /**
   * Clear all stored diagram data
   */
  clearDiagramData(): void {
    this.classDiagramData = null;
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear class diagram data from localStorage:', error);
    }
  }

  /**
   * Check if class diagram data is available
   */
  hasClassDiagramData(): boolean {
    return this.getClassDiagramData() !== null;
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
      return relationship.name;
    }

    // Create a name from the association role names
    const sourceRole = relationship.source?.role;
    const targetRole = relationship.target?.role;
    const sourceMultiplicity = relationship.source?.multiplicity;
    const targetMultiplicity = relationship.target?.multiplicity;

    // If we have role names and they're not empty, use them
    if (sourceRole && targetRole && sourceRole.trim() && targetRole.trim()) {
      return `${sourceRole}-${targetRole}`;
    }

    // If we have multiplicities, use them as a fallback
    if (sourceMultiplicity && targetMultiplicity) {
      return `${sourceMultiplicity}-${targetMultiplicity}`;
    }

    // Fallback to object names if available
    if (sourceObjectName && targetObjectName) {
      return `${sourceObjectName}-${targetObjectName}`;
    }

    // Final fallback
    return `Association-${relationship.id.substring(0, 8)}`;
  }
  /**
   * Get class by ID for verification purposes
   */
  getClassById(classId: string): IClassInfo | null {
    const availableClasses = this.getAvailableClasses();
    return availableClasses.find(cls => cls.id === classId) || null;
  }

  /**
   * Get inheritance hierarchy for a class (for debugging/display purposes)
   */
  getClassHierarchy(classId: string): string[] {
    const data = this.getClassDiagramData();
    if (!data) {
      return [];
    }

    const hierarchy: string[] = [];
    const visited = new Set<string>();

    const collectHierarchy = (currentClassId: string) => {
      if (visited.has(currentClassId)) {
        return;
      }
      visited.add(currentClassId);

      const currentClass = data.elements[currentClassId];
      if (!currentClass || (currentClass.type !== 'Class' && currentClass.type !== 'AbstractClass')) {
        return;
      } hierarchy.push(currentClass.name);

      // Find parent classes through inheritance relationships
      // In inheritance: source = child class, target = parent class
      // So when we're looking for parents of currentClassId, we need to find relationships
      // where currentClassId is the SOURCE (child) and get the TARGET (parent)
      const inheritanceRelationships = Object.values(data.relationships || {})
        .filter((rel: any) =>
          rel.type === 'ClassInheritance' &&
          rel.source?.element === currentClassId
        );

      inheritanceRelationships.forEach((rel: any) => {
        if (rel.target?.element) {
          collectHierarchy(rel.target.element);
        }
      });
    };

    collectHierarchy(classId);
    return hierarchy;
  }
}

/**
 * Singleton instance of the diagram bridge service
 * This ensures all parts of the application use the same instance
 */
export const diagramBridge = new DiagramBridgeService();
