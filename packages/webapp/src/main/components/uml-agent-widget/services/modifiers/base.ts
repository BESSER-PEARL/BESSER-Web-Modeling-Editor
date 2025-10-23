/**
 * Base Modifier Interface
 * Defines the contract for all diagram-specific modification handlers
 */

import { BESSERModel } from '../UMLModelingService';

export type DiagramType = 'ClassDiagram' | 'ObjectDiagram' | 'StateMachineDiagram' | 'AgentDiagram';

export interface ModificationTarget {
  classId?: string;
  className?: string;
  attributeId?: string;
  attributeName?: string;
  methodId?: string;
  methodName?: string;
  relationshipId?: string;
  relationshipName?: string;
  sourceClass?: string;
  targetClass?: string;
  stateId?: string;
  stateName?: string;
  intentId?: string;
  intentName?: string;
  transitionId?: string;
  objectId?: string;
  objectName?: string;
}

export interface ModificationChanges {
  name?: string;
  type?: string;
  visibility?: 'public' | 'private' | 'protected';
  parameters?: Array<{ name: string; type: string; }>;
  returnType?: string;
  relationshipType?: string;
  sourceClass?: string;
  targetClass?: string;
  sourceMultiplicity?: string;
  targetMultiplicity?: string;
  roleName?: string;
  previousName?: string;
  text?: string;
  condition?: string;
  replyType?: string;
  source?: string;
  target?: string;
  label?: string;
}

export interface ModelModification {
  action: 
    | 'modify_class' 
    | 'modify_attribute' 
    | 'modify_method' 
    | 'add_relationship' 
    | 'remove_element'
    | 'modify_state'
    | 'modify_intent'
    | 'add_transition'
    | 'remove_transition'
    | 'add_state_body'
    | 'modify_object'
    | 'add_link';
  target: ModificationTarget;
  changes: ModificationChanges;
  message?: string;
}

/**
 * Base interface that all diagram modifiers must implement
 */
export interface DiagramModifier {
  /**
   * Get the diagram type this modifier handles
   */
  getDiagramType(): DiagramType;

  /**
   * Check if this modifier can handle the given modification action
   */
  canHandle(action: string): boolean;

  /**
   * Apply modification to the model
   */
  applyModification(model: BESSERModel, modification: ModelModification): BESSERModel;
}

/**
 * Helper functions shared across modifiers
 */
export class ModifierHelpers {
  /**
   * Generate unique ID
   */
  static generateUniqueId(prefix: string = 'id'): string {
    return `${prefix}_${Math.random().toString(36).substr(2, 9)}_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 3)}`;
  }

  /**
   * Deep clone model
   */
  static cloneModel(model: BESSERModel): BESSERModel {
    return JSON.parse(JSON.stringify(model));
  }

  /**
   * Find element by name and type
   */
  static findElementByName(model: BESSERModel, name: string, type: string): string | null {
    for (const [id, element] of Object.entries(model.elements)) {
      if (element.type === type && element.name === name) {
        return id;
      }
    }
    return null;
  }

  /**
   * Find elements by type
   */
  static findElementsByType(model: BESSERModel, type: string): Array<{ id: string; element: any }> {
    const results: Array<{ id: string; element: any }> = [];
    for (const [id, element] of Object.entries(model.elements)) {
      if (element.type === type) {
        results.push({ id, element });
      }
    }
    return results;
  }

  /**
   * Remove element and its children
   */
  static removeElementWithChildren(model: BESSERModel, elementId: string): BESSERModel {
    const element = model.elements[elementId];
    if (!element) return model;

    // Remove child elements (attributes, methods, bodies, etc.)
    ['attributes', 'methods', 'bodies', 'fallbackBodies'].forEach(childProp => {
      const children = element[childProp];
      if (Array.isArray(children)) {
        children.forEach((childId: string) => {
          delete model.elements[childId];
        });
      }
    });

    // Remove the element itself
    delete model.elements[elementId];

    // Remove related relationships
    if (model.relationships) {
      Object.keys(model.relationships).forEach(relId => {
        const rel = model.relationships[relId];
        if (rel.source?.element === elementId || rel.target?.element === elementId) {
          delete model.relationships[relId];
        }
      });
    }

    return model;
  }
}
