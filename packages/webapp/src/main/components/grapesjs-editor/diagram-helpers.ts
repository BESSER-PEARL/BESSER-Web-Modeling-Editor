import { ProjectStorageRepository } from '../../services/storage/ProjectStorageRepository';
import { isUMLModel } from '../../types/project';
import { ClassMetadata, AttributeMetadata, isNumericType, isStringType } from './utils/classBindingHelpers';

function getClassDiagramModel() {
  const project = ProjectStorageRepository.getCurrentProject();
  return project?.diagrams?.ClassDiagram?.model;
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
    .map((attr: any) => ({ value: attr.id, label: attr.name }));
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
    .map((attr: any) => ({
      value: attr.id,
      label: attr.name,
      type: attr.name?.split(':')[1]?.trim() || 'str'
    }));

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
      const type = attr.name?.split(':')[1]?.trim() || 'str';
      return {
        id: attr.id,
        name: attr.name?.split(':')[0]?.trim() || attr.name,
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
