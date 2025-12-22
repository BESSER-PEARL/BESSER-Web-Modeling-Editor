import { UMLDiagramType, UMLModel } from '@besser/wme';
import { SoftwarePatternType } from './software-pattern/software-pattern-types';
import { SupportedDiagramType } from '../../../types/project';

export enum TemplateCategory {
  SOFTWARE_PATTERN = 'Software Pattern',
}

export type TemplateType = SoftwarePatternType;

// DiagramType can be either a UML diagram type or a non-UML type like QuantumCircuitDiagram
export type TemplateDiagramType = UMLDiagramType | SupportedDiagramType;

export class Template {
  type: TemplateType;
  diagramType: TemplateDiagramType;
  diagram: UMLModel | object; // UMLModel for UML diagrams, generic object for others like quantum
  isUMLDiagram: boolean;

  protected constructor(
    templateType: TemplateType,
    diagramType: TemplateDiagramType,
    diagram: UMLModel | object,
    isUMLDiagram: boolean = true
  ) {
    this.type = templateType;
    this.diagramType = diagramType;
    this.diagram = diagram;
    this.isUMLDiagram = isUMLDiagram;
  }
}
