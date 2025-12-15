import { Template, TemplateType, TemplateDiagramType } from '../template-types';
import { UMLModel } from '@besser/wme';

export enum SoftwarePatternCategory {
  CREATIONAL = 'Creational',
  STRUCTURAL = 'Class Diagram',
  BEHAVIORAL = 'Behavioral',
  AGENT = 'Agent Diagram',
  STATE_MACHINE = 'State Machine Diagram',
  QUANTUM = 'Quantum Circuit',
}

export enum SoftwarePatternType {
  // Structural patterns
  LIBRARY = 'Library',
  TEAMOCL = 'Team Player with OCL',
  DPP = 'Digital Product Passport ',
  AISANDBOX = 'AI Sandbox',
  // Behavioral pattern
  COMMAND = 'Command',
  OBSERVER = 'Observer',
  // Creational patterns
  FACTORY = 'Factory',
  // Agent patterns
  GREET_AGENT = 'Greeting Agent',
  // State Machine patterns
  TRAFIC_LIGHT = 'Traffic Light',
  // Quantum patterns
  GROVER_BV = 'Grover-BV Algorithm',
}

export class SoftwarePatternTemplate extends Template {
  softwarePatternCategory: SoftwarePatternCategory;

  /**
   * Should only be called from TemplateFactory. Do not call this method!
   * @param templateType
   * @param diagramType
   * @param diagram
   * @param patternCategory
   * @param isUMLDiagram - Whether this is a UML diagram (default true)
   */
  constructor(
    templateType: TemplateType,
    diagramType: TemplateDiagramType,
    diagram: UMLModel | object,
    patternCategory: SoftwarePatternCategory,
    isUMLDiagram: boolean = true,
  ) {
    super(templateType, diagramType, diagram, isUMLDiagram);
    this.softwarePatternCategory = patternCategory;
  }
}
