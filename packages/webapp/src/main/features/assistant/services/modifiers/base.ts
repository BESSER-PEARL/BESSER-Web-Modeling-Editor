/**
 * Base Modifier Interface
 * Defines the contract for all diagram-specific modification handlers.
 *
 * SA-7b.1: webapp internals are v4-native. Modifiers walk `model.nodes[]` /
 * `model.edges[]` directly — no v3 elements/relationships records anywhere.
 */

import type { BesserEdge, BesserNode } from '@besser/wme';
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
  // add_class / add_object fields
  className?: string;
  classId?: string;
  attributes?: Array<{ name: string; type?: string; visibility?: string; value?: string; attributeId?: string }>;
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
  // add_ocl_constraint fields
  constraint?: string;
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
    | 'add_rag_element'
    | 'add_ocl_constraint';
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
 * Helper functions shared across modifiers (v4-native).
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

  /** Read-only convenience accessor for `model.nodes`. */
  static nodes(model: BESSERModel): BesserNode[] {
    return ((model as any).nodes ?? []) as BesserNode[];
  }

  /** Read-only convenience accessor for `model.edges`. */
  static edges(model: BESSERModel): BesserEdge[] {
    return ((model as any).edges ?? []) as BesserEdge[];
  }

  /** Find a node by id. */
  static findNodeById(model: BESSERModel, id: string): BesserNode | undefined {
    return ModifierHelpers.nodes(model).find((n) => n.id === id);
  }

  /** Find an edge by id. */
  static findEdgeById(model: BESSERModel, id: string): BesserEdge | undefined {
    return ModifierHelpers.edges(model).find((e) => e.id === id);
  }

  /**
   * Push a new node onto the model.
   */
  static addNode(model: BESSERModel, node: BesserNode): void {
    const m = model as any;
    if (!Array.isArray(m.nodes)) m.nodes = [];
    m.nodes.push(node);
  }

  /**
   * Push a new edge onto the model.
   */
  static addEdge(model: BESSERModel, edge: BesserEdge): void {
    const m = model as any;
    if (!Array.isArray(m.edges)) m.edges = [];
    m.edges.push(edge);
  }

  /** Remove a node by id (and any of its children by parentId), plus incident edges. */
  static removeNodeWithChildren(model: BESSERModel, nodeId: string): BESSERModel {
    const m = model as any;
    const target = ModifierHelpers.findNodeById(model, nodeId);
    if (!target) return model;

    // Collect ids of nodes to remove: the target plus any descendants via parentId.
    const toRemove = new Set<string>([nodeId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const n of ModifierHelpers.nodes(model)) {
        if (n.parentId && toRemove.has(n.parentId) && !toRemove.has(n.id)) {
          toRemove.add(n.id);
          changed = true;
        }
      }
    }

    m.nodes = (m.nodes ?? []).filter((n: BesserNode) => !toRemove.has(n.id));
    m.edges = (m.edges ?? []).filter((e: BesserEdge) => !toRemove.has(e.source) && !toRemove.has(e.target));
    return model;
  }

  /**
   * Find a node by `data.name` matching the given name; optionally filtered by `node.type`.
   * In v4, attributes/methods/bodies are inline rows on the parent node and are NOT
   * separate nodes — so this only matches top-level UML element node types.
   */
  static findNodeByName(
    model: BESSERModel,
    name: string,
    type?: string,
  ): BesserNode | undefined {
    const normalizedName = (name || '').trim().toLowerCase();
    const candidates = ModifierHelpers.nodes(model).filter((n) =>
      type ? n.type === type : true,
    );
    // Exact match first
    for (const n of candidates) {
      const data: any = n.data || {};
      if (data.name === name) return n;
    }
    // Case-insensitive fallback
    for (const n of candidates) {
      const data: any = n.data || {};
      if (typeof data.name === 'string' && data.name.trim().toLowerCase() === normalizedName) return n;
    }
    return undefined;
  }

  /** Find all nodes whose `type` matches. */
  static findNodesByType(model: BESSERModel, type: string): BesserNode[] {
    return ModifierHelpers.nodes(model).filter((n) => n.type === type);
  }
}
