import { Template, TemplateType, TemplateDiagramType } from '../template-types';
import { UMLModel } from '@besser/wme';

export enum SoftwarePatternCategory {
  CREATIONAL = 'Creational',
  STRUCTURAL = 'Class Diagram',
  BEHAVIORAL = 'Behavioral',
  AGENT = 'Agent Diagram',
  STATE_MACHINE = 'State Machine Diagram',
  QUANTUM_CIRCUIT = 'Quantum Circuit',
  NN = 'Neural Network',
}

export enum SoftwarePatternType {
  // Structural patterns
  LIBRARY = 'Library',
  TEAMOCL = 'Team Player with OCL',
  DPP = 'Digital Product Passport ',
  AISANDBOX = 'AI Sandbox',
  NEXACRM = 'NexaCRM',
  // Agent patterns
  GREET_AGENT = 'Greeting Agent',
  DB_AGENT = 'Database Agent',
  GYM_AGENT = 'Gym Agent',
  FAQ_RAG_AGENT = 'FAQ RAG Agent',
  LIBRARY_AGENT = 'Library Agent',
  // State Machine patterns
  TRAFIC_LIGHT = 'Traffic Light',
  // Neural Network patterns
  NN_TUTORIAL_EXAMPLE = 'CIFAR-10 CNN',
  NN_ALEXNET = 'AlexNet',
  NN_LSTM = 'LSTM',
  NN_CIFAR_WITH_TRAINING = 'CIFAR-10 CNN with Training',
  // Quantum Circuit patterns
  QUANTUM_EMPTY = 'Empty Circuit',
  QUANTUM_SINGLE_GATES = 'Single Qubit Gates',
  QUANTUM_SUPERPOSITION = 'Superposition',
  QUANTUM_BELL_STATE = 'Bell State',
  QUANTUM_GHZ_STATE = 'GHZ State',
  QUANTUM_TELEPORTATION = 'Quantum Teleportation',
  QUANTUM_GROVER = 'Grover Search',
  QUANTUM_QFT = 'Quantum Fourier Transform',
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
