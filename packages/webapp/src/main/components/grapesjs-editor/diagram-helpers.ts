import { ProjectStorageRepository } from '../../services/storage/ProjectStorageRepository';
import { isUMLModel } from '../../types/project';

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
