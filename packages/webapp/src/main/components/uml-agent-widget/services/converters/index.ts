/**
 * Converter Factory
 * Creates appropriate converter based on diagram type
 */

import { DiagramConverter, DiagramType } from './base';
import { ClassDiagramConverter } from './ClassDiagramConverter';
import { ObjectDiagramConverter } from './ObjectDiagramConverter';
import { StateMachineConverter } from './StateMachineConverter';
import { AgentDiagramConverter } from './AgentDiagramConverter';

export class ConverterFactory {
  private static converters: Map<string, DiagramConverter> = new Map();

  private static initialize() {
    if (this.converters.size === 0) {
      this.converters.set('ClassDiagram', new ClassDiagramConverter());
      this.converters.set('ObjectDiagram', new ObjectDiagramConverter());
      this.converters.set('StateMachineDiagram', new StateMachineConverter());
      this.converters.set('AgentDiagram', new AgentDiagramConverter());
    }
  }

  static getConverter(diagramType: DiagramType): DiagramConverter {
    this.initialize();
    const converter = this.converters.get(diagramType);
    if (!converter) {
      console.warn(`No converter found for ${diagramType}, using ClassDiagram converter`);
      return this.converters.get('ClassDiagram')!;
    }
    return converter;
  }

  static getSupportedTypes(): DiagramType[] {
    this.initialize();
    return Array.from(this.converters.keys()) as DiagramType[];
  }

  static isSupported(diagramType: string): diagramType is DiagramType {
    return this.converters.has(diagramType as DiagramType);
  }
}

export * from './base';
export { ClassDiagramConverter } from './ClassDiagramConverter';
export { ObjectDiagramConverter } from './ObjectDiagramConverter';
export { StateMachineConverter } from './StateMachineConverter';
export { AgentDiagramConverter } from './AgentDiagramConverter';
