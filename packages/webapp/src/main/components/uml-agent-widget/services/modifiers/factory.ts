/**
 * Modifier Factory
 * Creates and manages diagram-specific modifiers
 */

import { DiagramModifier, DiagramType } from './base';
import { ClassDiagramModifier } from './ClassDiagramModifier';
import { AgentDiagramModifier } from './AgentDiagramModifier';
import { ObjectDiagramModifier } from './ObjectDiagramModifier';
import { StateMachineModifier } from './StateMachineModifier';

export class ModifierFactory {
  private static modifiers: Map<DiagramType, DiagramModifier> = new Map();

  private static initialize() {
    if (this.modifiers.size === 0) {
      this.modifiers.set('ClassDiagram', new ClassDiagramModifier());
      this.modifiers.set('AgentDiagram', new AgentDiagramModifier());
      this.modifiers.set('ObjectDiagram', new ObjectDiagramModifier());
      this.modifiers.set('StateMachineDiagram', new StateMachineModifier());
    }
  }

  /**
   * Get modifier for specific diagram type
   */
  static getModifier(diagramType: DiagramType): DiagramModifier {
    this.initialize();
    const modifier = this.modifiers.get(diagramType);
    if (!modifier) {
      console.warn(`No modifier found for ${diagramType}, using ClassDiagram modifier as fallback`);
      return this.modifiers.get('ClassDiagram')!;
    }
    return modifier;
  }

  /**
   * Get all supported diagram types
   */
  static getSupportedTypes(): DiagramType[] {
    this.initialize();
    return Array.from(this.modifiers.keys());
  }

  /**
   * Check if diagram type is supported
   */
  static isSupported(diagramType: string): diagramType is DiagramType {
    this.initialize();
    return this.modifiers.has(diagramType as DiagramType);
  }

  /**
   * Check if a specific action is supported for a diagram type
   */
  static canHandleAction(diagramType: DiagramType, action: string): boolean {
    const modifier = this.getModifier(diagramType);
    return modifier.canHandle(action);
  }
}
