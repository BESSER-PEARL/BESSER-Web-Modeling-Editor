import { ProjectStorageRepository } from '../../services/storage/ProjectStorageRepository';
import { isUMLModel } from '../../types/project';
import { ClassMetadata, AttributeMetadata, isNumericType, isStringType } from './utils/classBindingHelpers';

/**
 * Remove UML visibility characters (+, -, #, ~) from the beginning of a string
 * @param name - The name that may contain visibility prefix
 * @returns The name without visibility prefix
 */
function stripVisibility(name: string): string {
  if (!name) return name;
  // Remove leading visibility characters (+, -, #, ~) followed by optional space
  return name.replace(/^[+\-#~]\s*/, '');
}

function getClassDiagramModel() {
  const project = ProjectStorageRepository.getCurrentProject();
  return project?.diagrams?.ClassDiagram?.model;
}

function getAgentDiagramModel() {
  const project = ProjectStorageRepository.getCurrentProject();
  return project?.diagrams?.AgentDiagram?.model;
}

export function getClassOptions(): { value: string; label: string }[] {
  const classDiagram = getClassDiagramModel();

  if (!isUMLModel(classDiagram) || !classDiagram.elements) {
    console.warn('[diagram-helpers] No UML class diagram data available');
    return [];
  }

  return Object.values(classDiagram.elements)
    .filter((element: any) => element?.type === 'Class')
    .map((element: any) => ({ value: element.id, label: element.name }));
}

export function getAttributeOptionsByClassId(classId: string): { value: string; label: string }[] {
  const classDiagram = getClassDiagramModel();

  if (!isUMLModel(classDiagram) || !classDiagram.elements) {
    return [];
  }

  return Object.values(classDiagram.elements)
    .filter((element: any) => element?.type === 'ClassAttribute' && element?.owner === classId)
    .map((attr: any) => {
      const cleanName = stripVisibility(attr.name);
      // Extract just the attribute name (without type suffix if present in legacy format)
      const justName = cleanName?.split(':')[0]?.trim() || cleanName;
      return { value: attr.id, label: justName };
    });
}

/**
 * Get attribute options filtered by type compatibility
 */
export function getAttributeOptionsByType(classId: string, requireNumeric: boolean = false): { value: string; label: string; type: string }[] {
  const classDiagram = getClassDiagramModel();

  if (!isUMLModel(classDiagram) || !classDiagram.elements) {
    return [];
  }

  const attributes = Object.values(classDiagram.elements)
    .filter((element: any) => element?.type === 'ClassAttribute' && element?.owner === classId)
    .map((attr: any) => {
      const cleanName = stripVisibility(attr.name);
      // Use attributeType property if available (new format), otherwise parse from name (legacy)
      const type = attr.attributeType || cleanName?.split(':')[1]?.trim() || 'str';
      // Extract just the attribute name (without type suffix)
      const justName = cleanName?.split(':')[0]?.trim() || cleanName;
      return {
        value: attr.id,
        label: justName,
        type: type
      };
    });

  if (requireNumeric) {
    return attributes.filter(attr => isNumericType(attr.type));
  }

  return attributes;
}

/**
 * Get full class metadata including attributes with types
 */
export function getClassMetadata(classId: string): ClassMetadata | undefined {
  const classDiagram = getClassDiagramModel();

  if (!isUMLModel(classDiagram) || !classDiagram.elements) {
    return undefined;
  }

  const classElement = Object.values(classDiagram.elements).find(
    (el: any) => el?.type === 'Class' && el?.id === classId
  ) as any;

  if (!classElement) {
    return undefined;
  }

  const attributes: AttributeMetadata[] = Object.values(classDiagram.elements)
    .filter((element: any) => element?.type === 'ClassAttribute' && element?.owner === classId)
    .map((attr: any) => {
      const cleanName = stripVisibility(attr.name);
      // Use attributeType property if available (new format), otherwise parse from name (legacy)
      const type = attr.attributeType || cleanName?.split(':')[1]?.trim() || 'str';
      // Extract just the attribute name (without type suffix)
      const justName = cleanName?.split(':')[0]?.trim() || cleanName;
      return {
        id: attr.id,
        name: justName,
        type: type,
        isNumeric: isNumericType(type),
        isString: isStringType(type)
      };
    });

  return {
    id: classElement.id,
    name: classElement.name,
    attributes
  };
}

export function getEndsByClassId(classId: string): { value: string; label: string }[] {
  const classDiagram = getClassDiagramModel();

  if (!isUMLModel(classDiagram) || !classDiagram.relationships) {
    return [];
  }

  return Object.values(classDiagram.relationships)
    .filter((relationship: any) => relationship?.type !== 'ClassInheritance')
    .map((relationship: any) => {
      if (relationship?.source?.element === classId) {
        return { value: relationship.target.element, label: relationship.target.role };
      }

      if (relationship?.target?.element === classId) {
        return { value: relationship.source.element, label: relationship.source.role };
      }

      return null;
    })
    .filter((end): end is { value: string; label: string } => end !== null);
}

export function getElementNameById(elementId: string): string | null {
  const classDiagram = getClassDiagramModel();

  if (!isUMLModel(classDiagram) || !classDiagram.elements) {
    return null;
  }

  const element = Object.values(classDiagram.elements).find((el: any) => el?.id === elementId);
  return element ? (element as any).name : null;
}

/**
 * Get attributes inherited from parent classes (traverse up the inheritance tree)
 */
export function getInheritedAttributeOptionsByClassId(classId: string): { value: string; label: string }[] {
  const classDiagram = getClassDiagramModel();

  if (!isUMLModel(classDiagram) || !classDiagram.elements || !('relationships' in classDiagram) || !classDiagram.relationships) {
    return [];
  }

  // Helper to recursively collect parent class IDs (where classId is the source, parent is the target)
  function getParentClassIds(currentId: string, visited = new Set<string>()): string[] {
    if (visited.has(currentId)) return [];
    visited.add(currentId);
    const parents = Object.values((classDiagram as any).relationships)
      .filter((rel: any) => rel?.type === 'ClassInheritance' && rel?.source?.element === currentId)
      .map((rel: any) => rel.target.element);
    return parents.reduce((acc: string[], parentId: string) => {
      acc.push(parentId);
      acc.push(...getParentClassIds(parentId, visited));
      return acc;
    }, []);
  }

  const parentIds = getParentClassIds(classId);
  if (parentIds.length === 0) return [];

  // Collect attributes from all parent classes
  const inheritedAttributes = Object.values(classDiagram.elements)
    .filter((element: any) => element?.type === 'ClassAttribute' && parentIds.includes(element.owner))
    .map((attr: any) => {
      const cleanName = stripVisibility(attr.name);
      // Extract just the attribute name (without type suffix if present in legacy format)
      const justName = cleanName?.split(':')[0]?.trim() || cleanName;
      return { value: attr.id, label: justName };
    });

  return inheritedAttributes;
}

/**
 * Get relationships inherited from parent classes (traverse up the inheritance tree)
 */
export function getInheritedEndsByClassId(classId: string): { value: string; label: string }[] {
  const classDiagram = getClassDiagramModel();

  if (!isUMLModel(classDiagram) || !classDiagram.elements || !('relationships' in classDiagram) || !classDiagram.relationships) {
    return [];
  }

  // Helper to recursively collect parent class IDs (where classId is the source, parent is the target)
  function getParentClassIds(currentId: string, visited = new Set<string>()): string[] {
    if (visited.has(currentId)) return [];
    visited.add(currentId);
    const parents = Object.values((classDiagram as any).relationships)
      .filter((rel: any) => rel?.type === 'ClassInheritance' && rel?.source?.element === currentId)
      .map((rel: any) => rel.target.element);
    return parents.reduce((acc: string[], parentId: string) => {
      acc.push(parentId);
      acc.push(...getParentClassIds(parentId, visited));
      return acc;
    }, []);
  }

  const parentIds = getParentClassIds(classId);
  if (parentIds.length === 0) return [];

  // Collect relationships from all parent classes (excluding inheritance relationships)
  const inheritedEnds: { value: string; label: string }[] = [];
  Object.values((classDiagram as any).relationships)
    .filter((rel: any) => rel?.type !== 'ClassInheritance')
    .forEach((rel: any) => {
      if (parentIds.includes(rel?.source?.element)) {
        inheritedEnds.push({ value: rel.target.element, label: rel.target.role });
      } else if (parentIds.includes(rel?.target?.element)) {
        inheritedEnds.push({ value: rel.source.element, label: rel.source.role });
      }
    });

  return inheritedEnds;
}

/**
 * Get agent options from AgentDiagram - returns the entire diagram as an option
 */
export function getAgentOptions(): { value: string; label: string }[] {
  // Get the project to access AgentDiagram
  const project = ProjectStorageRepository.getCurrentProject();
  const agentDiagramData = project?.diagrams?.AgentDiagram;
  
  if (agentDiagramData?.title) {
    // Return the diagram title as the agent identifier (entire diagram, not individual states)
    return [{ value: agentDiagramData.title, label: agentDiagramData.title }];
  }
  
  console.warn('[diagram-helpers] No Agent diagram data available');
  return [];
}
