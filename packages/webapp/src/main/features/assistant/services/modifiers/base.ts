/**
 * Base Modifier Interface
 * Defines the contract for all diagram-specific modification handlers.
 *
 * Webapp internals are v4-native. Modifiers walk `model.nodes[]` /
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
  // add_transition (agent): the backend's AgentModificationTarget emits these
  // instead of the generic sourceClass/targetClass/stateName above.
  sourceStateName?: string;
  targetStateName?: string;
  // StateMachineDiagram add/modify/remove transition endpoints.
  sourceState?: string;
  targetState?: string;
  intentId?: string;
  intentName?: string;
  // AgentDiagram remove_transition by id
  transitionId?: string;
  objectId?: string;
  objectName?: string;
  // ObjectDiagram add_link endpoints.
  sourceObject?: string;
  targetObject?: string;
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
  // StateMachineDiagram transition fields
  trigger?: string;
  guard?: string;
  effect?: string;
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
  // add_intent_training_phrase: a single phrase to append (vs. the array above).
  trainingPhrase?: string;
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
    | 'modify_transition'
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
    | 'add_data_object'
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
    methods?: Array<{
      name: string;
      returnType: string;
      visibility?: string;
      parameters?: Array<{ name: string; type: string }>;
    }>;
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

  /**
   * Resolve a node reference that may be a node id or a display name, among
   * nodes of the given types. An id hit wins over a name match.
   */
  static resolveNodeRef(model: BESSERModel, ref: string | undefined, types: string[]): BesserNode | undefined {
    if (!ref) return undefined;
    const byId = ModifierHelpers.findNodeById(model, ref);
    if (byId && types.includes(byId.type)) return byId;
    for (const type of types) {
      const hit = ModifierHelpers.findNodeByName(model, ref, type);
      if (hit) return hit;
    }
    return undefined;
  }

  /** Grow a child's parent node so the child, plus `padding`, stays inside it. */
  static growParentToFit(model: BESSERModel, child: BesserNode, padding: number): void {
    const parent = child.parentId ? ModifierHelpers.findNodeById(model, child.parentId) : undefined;
    if (!parent) return;
    parent.width = Math.max(parent.width || 0, child.position.x + (child.width || 0) + padding);
    parent.height = Math.max(parent.height || 0, child.position.y + (child.height || 0) + padding);
    parent.measured = { width: parent.width, height: parent.height };
  }

  /** Find all nodes whose `type` matches. */
  static findNodesByType(model: BESSERModel, type: string): BesserNode[] {
    return ModifierHelpers.nodes(model).filter((n) => n.type === type);
  }
}

/** What a batch of modifications actually did to the model. */
export interface ModelDiff {
  removedClasses: string[];
  addedClasses: string[];
  removedRelationships: number;
  addedRelationships: number;
}

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
  // Every classifier is a `class` node, relationships are edges. A v3 model
  // never gets here: the assistant refuses to modify an unmigrated diagram.
  const classNames = (model: any): Map<string, string> => {
    const out = new Map<string, string>();
    for (const node of Array.isArray(model?.nodes) ? model.nodes : []) {
      if (node?.type === 'class') out.set(node.id, node.data?.name ?? node.id);
    }
    return out;
  };
  const relationshipIds = (model: any): Set<string> =>
    new Set((Array.isArray(model?.edges) ? model.edges : []).map((e: any) => e?.id).filter(Boolean));

  const b = classNames(before);
  const a = classNames(after);
  const br = relationshipIds(before);
  const ar = relationshipIds(after);

  return {
    removedClasses: [...b.entries()].filter(([id]) => !a.has(id)).map(([, name]) => name),
    addedClasses: [...a.entries()].filter(([id]) => !b.has(id)).map(([, name]) => name),
    removedRelationships: [...br].filter((id) => !ar.has(id)).length,
    addedRelationships: [...ar].filter((id) => !br.has(id)).length,
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
