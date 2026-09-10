/**
 * User Profile Diagram Modifier (v4-native)
 *
 * Handles modification operations for User Profile (UserDiagram) models by
 * walking v4 `model.nodes[]` / `model.edges[]` directly.
 *
 * Mirrors ObjectDiagramModifier but operates on `UserModelName` nodes and
 * `UserModelLink` edges. Attribute rows are matching criteria carrying a
 * comparison operator (rendered "age >= 18"): each row keeps its bare
 * `name` plus a structured `attributeOperator` / `value` pair. The
 * metamodel class icon is a plain `data.icon` SVG string on the node (User
 * diagrams render in icon view; without it the box shows as a bare box).
 *
 * Reuses the ObjectDiagram action vocabulary so no new ModelModification
 * action strings are required.
 */

import type { BesserEdge, BesserNode } from '@besser/wme';
import { DiagramModifier, ModelModification, ModifierHelpers } from './base';
import { BESSERModel } from '../UMLModelingService';
import {
  USER_LINK_TYPE,
  USER_NODE_TYPE,
  USER_NODE_WIDTH,
  UserAttributeRow,
  buildUserAttributeRow,
  normalizeUserModelOperator,
  userNodeHeight,
} from '../shared/userModelBuilders';

/** Bare attribute name of a criterion row (legacy rows may embed "name op value"). */
const rowAttributeName = (row: UserAttributeRow): string => (row.name || '').split(/[<>=]/)[0].trim();

export class UserDiagramModifier implements DiagramModifier {
  getDiagramType() {
    return 'UserDiagram' as const;
  }

  canHandle(action: string): boolean {
    return [
      'add_object',
      'modify_object',
      'modify_attribute_value',
      'add_link',
      'remove_element',
    ].includes(action);
  }

  applyModification(model: BESSERModel, modification: ModelModification): BESSERModel {
    const updatedModel = ModifierHelpers.cloneModel(model);

    switch (modification.action) {
      case 'add_object':
        return this.addProfile(updatedModel, modification);
      case 'modify_object':
        return this.modifyProfile(updatedModel, modification);
      case 'modify_attribute_value':
        return this.modifyAttributeValue(updatedModel, modification);
      case 'add_link':
        return this.addLink(updatedModel, modification);
      case 'remove_element':
        return this.removeElement(updatedModel, modification);
      default:
        throw new Error(`Unsupported action for UserDiagram: ${modification.action}`);
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  /**
   * Resolve a `UserModelName` node by profile name (its `data.name`) or by
   * the linked class name (`data.className`) — the backend references
   * singleton profiles by their metamodel class. A node id is accepted too.
   */
  private findProfile(model: BESSERModel, ...candidates: Array<string | undefined>): BesserNode | undefined {
    const raw = candidates.filter((c): c is string => typeof c === 'string' && c.trim() !== '').map((c) => c.trim());
    if (raw.length === 0) return undefined;

    const profiles = ModifierHelpers.nodes(model).filter((n) => n.type === USER_NODE_TYPE);
    for (const cand of raw) {
      const byId = profiles.find((n) => n.id === cand);
      if (byId) return byId;
    }

    const names = raw.map((c) => c.toLowerCase());
    for (const n of profiles) {
      const data = (n.data as any) || {};
      const nm = (typeof data.name === 'string' ? data.name : '').trim().toLowerCase();
      const cls = (typeof data.className === 'string' ? data.className : '').trim().toLowerCase();
      if ((nm && names.includes(nm)) || (cls && names.includes(cls))) return n;
    }
    return undefined;
  }

  /** Compute the next vertical slot below all existing nodes. */
  private nextPosition(model: BESSERModel): { x: number; y: number } {
    let maxY = 0;
    for (const n of ModifierHelpers.nodes(model)) {
      const bottom = (n.position?.y ?? 0) + (n.height ?? 0);
      if (bottom > maxY) maxY = bottom;
    }
    return { x: 100, y: maxY + 40 };
  }

  private resizeProfile(node: BesserNode): void {
    const rows = (node.data as any)?.attributes;
    const height = userNodeHeight(Array.isArray(rows) ? rows.length : 0);
    node.height = height;
    node.measured = { width: node.width ?? USER_NODE_WIDTH, height };
  }

  // ─── Action handlers ────────────────────────────────────────────────────

  private addProfile(model: BESSERModel, modification: ModelModification): BESSERModel {
    const changes = modification.changes || {};
    const target = modification.target || {};
    const className = changes.className || '';
    const profileName = changes.profileName || target.profileName || className || 'profile';

    const pos = this.nextPosition(model);
    const nodeId = ModifierHelpers.generateUniqueId('user');
    const attributes = (changes.attributes ?? []).map((attr) => buildUserAttributeRow(attr));
    const width = USER_NODE_WIDTH;
    const height = userNodeHeight(attributes.length);

    const data: Record<string, unknown> = {
      name: profileName,
      attributes,
      methods: [],
      view: 'icon',
    };
    if (className) data.className = className;
    if (changes.classId) data.classId = changes.classId;
    // Metamodel class icon (User diagrams always render in icon view;
    // without it the box shows as a bare, empty box). Mirrors UserDiagramConverter.
    if (typeof changes.icon === 'string' && changes.icon.trim() !== '') data.icon = changes.icon;

    const node: BesserNode = {
      id: nodeId,
      type: USER_NODE_TYPE as any,
      position: { x: pos.x, y: pos.y },
      width,
      height,
      measured: { width, height },
      data,
    };
    ModifierHelpers.addNode(model, node);
    return model;
  }

  private modifyProfile(model: BESSERModel, modification: ModelModification): BESSERModel {
    const target = modification.target || {};
    const node = this.findProfile(model, target.objectId, target.profileName, target.className, target.name);
    if (node) {
      const newName = modification.changes?.profileName || modification.changes?.name;
      if (newName) (node.data as any).name = newName;
    }
    return model;
  }

  private modifyAttributeValue(model: BESSERModel, modification: ModelModification): BESSERModel {
    const target = modification.target || {};
    const attributeName = target.attributeName;
    const newValue = modification.changes?.value;
    const newOperator = modification.changes?.operator;

    if (!attributeName || (newValue === undefined && newOperator === undefined)) {
      throw new Error(
        'modify_attribute_value requires target.attributeName and changes.value and/or changes.operator',
      );
    }

    const node = this.findProfile(model, target.objectId, target.profileName, target.className, target.objectName);
    if (!node) {
      throw new Error(`Profile '${target.profileName || target.className || target.objectName}' not found in the model.`);
    }

    const data = node.data as any;
    const rows: UserAttributeRow[] = Array.isArray(data.attributes) ? data.attributes : [];
    const wanted = attributeName.trim().toLowerCase();
    const row = rows.find((r) => rowAttributeName(r).toLowerCase() === wanted);
    if (!row) {
      throw new Error(`Attribute '${attributeName}' not found on the target profile.`);
    }

    // Normalise legacy fused names ("age >= 18") to the structured shape.
    row.name = rowAttributeName(row) || attributeName;
    row.attributeOperator = normalizeUserModelOperator(newOperator ?? row.attributeOperator);
    if (newValue !== undefined) row.value = newValue;
    return model;
  }

  private addLink(model: BESSERModel, modification: ModelModification): BESSERModel {
    const changes = modification.changes || {};
    const target = modification.target || {};
    const sourceNode = this.findProfile(model, changes.source, target.sourceProfile, target.objectId, target.profileName);
    const targetNode = this.findProfile(model, changes.target, target.targetProfile);

    if (!sourceNode || !targetNode) {
      throw new Error('Could not locate source or target profile for link.');
    }

    const linkName = changes.relationshipType || changes.name || '';
    const edge: BesserEdge = {
      id: ModifierHelpers.generateUniqueId('link'),
      type: USER_LINK_TYPE as any,
      source: sourceNode.id,
      target: targetNode.id,
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        label: linkName,
        name: linkName,
        points: [
          { x: 100, y: 10 },
          { x: 0, y: 10 },
        ],
        isManuallyLayouted: false,
      },
    };
    ModifierHelpers.addEdge(model, edge);
    return model;
  }

  private removeElement(model: BESSERModel, modification: ModelModification): BESSERModel {
    const target = modification.target || {};
    const candidates: string[] = [];
    for (const key of ['objectId', 'profileName', 'name', 'className', 'objectName', 'targetName', 'elementName']) {
      const v = (target as any)[key];
      if (typeof v === 'string' && v.trim()) candidates.push(v.trim());
    }
    if (modification.changes) {
      for (const v of Object.values(modification.changes)) {
        if (typeof v === 'string' && v.trim()) candidates.push(v.trim());
      }
    }

    const node = this.findProfile(model, ...candidates);
    if (node) {
      return ModifierHelpers.removeNodeWithChildren(model, node.id);
    }

    // Idempotent no-op when already removed.
    console.warn(
      `[UserDiagramModifier] removeElement: no profile matching ${JSON.stringify(candidates)} — ` +
        'treating as already removed (no-op).',
    );
    return model;
  }
}
