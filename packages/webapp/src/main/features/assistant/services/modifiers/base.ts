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
  // AgentDiagram add_transition / remove_transition endpoints
  sourceStateName?: string;
  targetStateName?: string;
  transitionId?: string;
  objectId?: string;
  objectName?: string;
  // User-profile (UserDiagram) targets
  profileName?: string;
  sourceProfile?: string;
  targetProfile?: string;
  name?: string;
  // BPMN
  nodeId?: string;
  nodeName?: string;
  flowId?: string;
  // Component / Deployment elements and BPMN pools / lanes
  elementId?: string;
  elementName?: string;
  poolName?: string;
  swimlaneName?: string;
}

export interface ModificationChanges {
  name?: string;
  type?: string;
  visibility?: 'public' | 'private' | 'protected';
  parameters?: Array<{ name: string; type: string }>;
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
  // User-profile: metamodel class icon SVG for add_object (renders a UserModelIcon child)
  icon?: string;
  // User-profile criterion operator ('<' | '<=' | '==' | '>=' | '>')
  operator?: string;
  profileName?: string;
  attributes?: Array<{
    name: string;
    type?: string;
    visibility?: string;
    value?: string;
    attributeId?: string;
    operator?: string;
  }>;
  methods?: Array<{
    name: string;
    returnType?: string;
    visibility?: string;
    parameters?: Array<{ name: string; type: string }>;
  }>;
  // add_state fields
  stateType?: string;
  entryAction?: string;
  exitAction?: string;
  doActivity?: string;
  // BPMN add_task / add_gateway / add_event / modify_node fields
  // (source / target / label / name reused from above for add_flow)
  taskType?: string;
  gatewayType?: string;
  eventKind?: string;
  eventType?: string;
  // Agentic BPMN task / gateway / lane fields
  isAgentic?: boolean;
  reflectionMode?: string;
  // reviewer lane (id or name) for reflectionMode 'cross'
  reflectionReviewerLaneId?: string;
  trustScore?: number;
  agentDiagramRef?: string;
  gatewayRole?: string;
  governanceDsl?: string;
  role?: string;
  multiplicity?: number;
  poolName?: string;
  // Component / Deployment fields (`owner` names the containing Subsystem,
  // Node or, for BPMN nodes, lane)
  stereotype?: string;
  dependencyStereotype?: string;
  owner?: string;
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
    | 'add_ocl_constraint'
    | 'add_task'
    | 'add_gateway'
    | 'add_event'
    | 'add_flow'
    | 'modify_node'
    | 'remove_flow'
    // BPMN pools / lanes
    | 'add_pool'
    | 'add_swimlane'
    | 'modify_swimlane'
    | 'remove_swimlane'
    | 'remove_pool'
    // Component diagram
    | 'add_component'
    | 'add_subsystem'
    | 'add_dependency'
    | 'modify_element'
    | 'remove_dependency'
    // Deployment diagram
    | 'add_node'
    | 'add_artifact';
  target: ModificationTarget;
  changes: ModificationChanges;
  message?: string;

  // Refactoring action fields (used by extract_class, split_class, merge_classes, promote_attribute, add_enum)
  sourceClass?: string;
  newClass?: string;
  attributes?: string[];
  relationshipType?: string;
  newClasses?: Array<{
    name: string;
    attributes: Array<{ name: string; type: string; visibility?: string }>;
    methods?: Array<{ name: string; returnType: string; parameters?: Array<{ name: string; type: string }> }>;
  }>;
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
   * Resolve an element reference that may be an element id or a name, among
   * elements of the given types. Returns null when nothing matches.
   */
  static resolveElementRef(model: BESSERModel, ref: string | undefined, types: string[]): string | null {
    if (!ref) return null;
    if (types.includes(model.elements[ref]?.type)) return ref;
    for (const type of types) {
      const id = ModifierHelpers.findElementByName(model, ref, type);
      if (id) return id;
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
    if (!model.elements[elementId]) return model;

    // Collect the element, its listed children (attributes, methods, bodies,
    // ...) and, recursively, every element it owns (lanes of a pool, tasks of
    // a lane, components of a subsystem, ...).
    const removed = new Set<string>();
    const collect = (id: string) => {
      if (removed.has(id) || !model.elements[id]) return;
      removed.add(id);
      const element = model.elements[id];
      ['attributes', 'methods', 'bodies', 'fallbackBodies'].forEach((childProp) => {
        const children = element[childProp];
        if (Array.isArray(children)) children.forEach(collect);
      });
      for (const [childId, child] of Object.entries(model.elements)) {
        if (child.owner === id) collect(childId);
      }
    };
    collect(elementId);
    removed.forEach((id) => delete model.elements[id]);

    // Remove relationships that touch any removed element
    if (model.relationships) {
      Object.keys(model.relationships).forEach((relId) => {
        const rel = model.relationships[relId];
        if (removed.has(rel.source?.element) || removed.has(rel.target?.element)) {
          delete model.relationships[relId];
        }
      });
    }

    return model;
  }
}

/** What a batch of modifications actually did to the model. */
export interface ModelDiff {
  removedClasses: string[];
  addedClasses: string[];
  removedRelationships: number;
  addedRelationships: number;
}

const CLASS_LIKE = ['Class', 'AbstractClass', 'Interface', 'Enumeration'];

/**
 * Compare two models structurally.
 *
 * The change summary the user sees is written by the agent from what it
 * INTENDED, so a modification that does something else entirely is still
 * reported as a success: "remove book copy" deleted three classes and nine
 * relationships and announced "Applied 4 changes". Diffing the
 * real before/after is the only description that cannot lie.
 */
export function summarizeModelDiff(before: any, after: any): ModelDiff {
  const classNames = (model: any): Map<string, string> => {
    const out = new Map<string, string>();
    for (const [id, el] of Object.entries((model?.elements ?? {}) as Record<string, any>)) {
      if (el && CLASS_LIKE.includes(el.type)) out.set(id, el.name ?? id);
    }
    return out;
  };

  const b = classNames(before);
  const a = classNames(after);

  return {
    removedClasses: [...b.entries()].filter(([id]) => !a.has(id)).map(([, name]) => name),
    addedClasses: [...a.entries()].filter(([id]) => !b.has(id)).map(([, name]) => name),
    removedRelationships: Object.keys(before?.relationships ?? {}).filter(
      (id) => !(id in (after?.relationships ?? {})),
    ).length,
    addedRelationships: Object.keys(after?.relationships ?? {}).filter(
      (id) => !(id in (before?.relationships ?? {})),
    ).length,
  };
}

/**
 * Class names a batch of modifications explicitly asked to remove.
 *
 * Anything deleted beyond this set is collateral, and the caller should say so
 * rather than let it pass as an intended change.
 */
export function classesNamedForRemoval(modifications: any[]): Set<string> {
  const named = new Set<string>();
  for (const mod of modifications ?? []) {
    if (mod?.action !== 'remove_element') continue;
    const target = mod.target ?? {};
    // A relationship removal names endpoints, never a class to delete.
    if (target.sourceClass || target.targetClass) continue;
    if (target.attributeName || target.attributeId) continue;
    if (target.methodName || target.methodId) continue;
    if (typeof target.className === 'string' && target.className.trim()) {
      named.add(target.className.trim());
    }
  }
  return named;
}
