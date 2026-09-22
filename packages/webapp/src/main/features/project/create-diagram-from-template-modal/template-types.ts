import { UMLDiagramType, UMLModel } from '@besser/wme';
import { SoftwarePatternType } from './software-pattern/software-pattern-types';
import { SupportedDiagramType } from '../../../shared/types/project';

export enum TemplateCategory {
  SOFTWARE_PATTERN = 'Software Pattern',
}

export type TemplateType = SoftwarePatternType;

// DiagramType can be either a UML diagram type, a non-UML type like
// QuantumCircuitDiagram, or the ``'FullProject'`` sentinel used for
// multi-diagram project templates.
export type TemplateDiagramType = UMLDiagramType | SupportedDiagramType | 'FullProject';

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
