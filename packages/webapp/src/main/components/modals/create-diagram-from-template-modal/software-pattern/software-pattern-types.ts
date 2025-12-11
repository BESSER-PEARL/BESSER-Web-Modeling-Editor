import { Template, TemplateType } from '../template-types';
import { UMLDiagramType, UMLModel } from '@besser/wme';

export enum SoftwarePatternCategory {
  CREATIONAL = 'Creational',
  STRUCTURAL = 'Class Diagram',
  BEHAVIORAL = 'Behavioral',
  AGENT = 'Agent Diagram',
  STATE_MACHINE = 'State Machine Diagram',
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
}

export class SoftwarePatternTemplate extends Template {
  softwarePatternCategory: SoftwarePatternCategory;

  /**
   * Should only be called from TemplateFactory. Do not call this method!
   * @param templateCategory
   * @param templateType
   * @param diagramType
   * @param diagram
   * @param patternCategory
   */
  constructor(
    templateType: TemplateType,
    diagramType: UMLDiagramType,
    diagram: UMLModel,
    patternCategory: SoftwarePatternCategory,
  ) {
    super(templateType, diagramType, diagram);
    this.softwarePatternCategory = patternCategory;
  }
}
