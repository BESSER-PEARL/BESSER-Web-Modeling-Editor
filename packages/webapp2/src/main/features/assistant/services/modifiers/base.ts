/**
 * Base Modifier Interface
 * Defines the contract for all diagram-specific modification handlers
 */

import { BESSERModel } from '../UMLModelingService';
import { DiagramType, generateUniqueId } from '../shared-types';

export type { DiagramType };

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
  name?: string;
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
  value?: string;
  // add_class fields
  className?: string;
  attributes?: Array<{ name: string; type?: string; visibility?: string; value?: string }>;
  methods?: Array<{ name: string; returnType?: string; visibility?: string; parameters?: Array<{ name: string; type: string }> }>;
  // add_state fields
  stateType?: string;
  entryAction?: string;
  exitAction?: string;
  doActivity?: string;
  // add_state (agent) / add_intent fields
  replies?: Array<{ text: string; replyType?: string; ragDatabaseName?: string }>;
  trainingPhrases?: string[];
  intentName?: string;
  objectName?: string;
  ragDatabaseName?: string;
  implementationType?: string;
  code?: string;
  language?: string;
}

export interface ModelModification {
  action:
    | 'add_class'
    | 'modify_class'
    | 'add_attribute'
    | 'modify_attribute'
    | 'add_method'
    | 'modify_method'
    | 'add_relationship'
    | 'modify_relationship'
    | 'remove_element'
    | 'modify_state'
    | 'modify_intent'
    | 'add_transition'
    | 'remove_transition'
    | 'add_state_body'
    | 'modify_object'
    | 'modify_attribute_value'
    | 'add_link'
    | 'add_state'
    | 'add_object'
    | 'add_intent'
    | 'add_intent_training_phrase'
    | 'extract_class'
    | 'split_class'
    | 'merge_classes'
    | 'promote_attribute'
    | 'add_enum'
    | 'add_code_block'
    | 'add_rag_element';
  target: ModificationTarget;
  changes: ModificationChanges;
  message?: string;

  // Refactoring action fields (used by extract_class, split_class, merge_classes, promote_attribute, add_enum)
  sourceClass?: string;
  newClass?: string;
  attributes?: string[];
  relationshipType?: string;
  newClasses?: Array<{ name: string; attributes: Array<{ name: string; type: string; visibility?: string }>; methods?: Array<{ name: string; returnType: string; parameters?: Array<{ name: string; type: string }> }> }>;
  inheritFrom?: string;
  classes?: string[];
  targetName?: string;
  attribute?: string;
  newAttributes?: Array<{ name: string; type: string; visibility?: string }>;
  enumName?: string;
  values?: string[];
  usedBy?: Array<{ className: string; attributeName: string }>;
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
    return generateUniqueId(prefix);
  }

  /**
   * Deep clone model
   */
  static cloneModel(model: BESSERModel): BESSERModel {
    return structuredClone(model);
  }

  /**
   * Find element by name and type
   */
  static findElementByName(model: BESSERModel, name: string, type: string): string | null {
    const normalizedName = (name || '').trim().toLowerCase();
    // First pass: exact match
    for (const [id, element] of Object.entries(model.elements)) {
      if (element.type === type && element.name === name) {
        return id;
      }
    }
    // Second pass: case-insensitive match
    for (const [id, element] of Object.entries(model.elements)) {
      if (element.type === type && (element.name || '').trim().toLowerCase() === normalizedName) {
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
