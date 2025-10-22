import { UMLDiagramType, UMLModel } from '@besser/wme';
import { SoftwarePatternType } from './software-pattern/software-pattern-types';

export enum TemplateCategory {
  SOFTWARE_PATTERN = 'Software Pattern',
}

export type TemplateType = SoftwarePatternType;

export class Template {
  type: TemplateType;
  diagramType: UMLDiagramType;
  diagram: UMLModel;

  protected constructor(templateType: TemplateType, diagramType: UMLDiagramType, diagram: UMLModel) {
    this.type = templateType;
    this.diagramType = diagramType;
    this.diagram = diagram;
  }
}
