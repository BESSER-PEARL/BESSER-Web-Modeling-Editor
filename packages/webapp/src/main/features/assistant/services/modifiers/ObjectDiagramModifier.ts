/**
 * Object Diagram Modifier (v4-native)
 *
 * Walks v4 `model.nodes[]` / `model.edges[]` directly — no v3↔v4
 * conversion seam.
 *
 * v4 ObjectDiagram shape (per docs/source/migrations/uml-v4-shape.md):
 *   - `ObjectName` is the only node `type`. Attributes / methods / icon
 *     collapse into rows on `node.data.attributes` / `data.methods` / a
 *     plain `data.icon` string. There is no separate ObjectAttribute or
 *     ObjectIcon node.
 *   - `ObjectLink` is the only edge `type`. Endpoints are `edge.source` /
 *     `edge.target` (object node ids).
 *
 * Display name format: `data.name` is just the instance name (no
 * "instanceName: ClassName" suffix); the render layer appends the
 * className via the bridge using `data.classId`. If no `classId` is
 * supplied we fall back to embedding "instance: Class" in `data.name`
 * since the render layer has nothing to look up.
 */
import type { BesserEdge, BesserNode } from '@besser/wme';
import { DiagramModifier, ModelModification, ModifierHelpers } from './base';
import { BESSERModel } from '../UMLModelingService';

type ObjectAttributeRow = {
  id: string;
  name: string;
  attributeId?: string;
  attributeType?: string;
  defaultValue?: unknown;
  value?: unknown;
};

const OBJECT_NODE_TYPE = 'objectName';

export class ObjectDiagramModifier implements DiagramModifier {
  getDiagramType() {
    return 'ObjectDiagram' as const;
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
        return this.addObject(updatedModel, modification);
      case 'modify_object':
        return this.modifyObject(updatedModel, modification);
      case 'modify_attribute_value':
        return this.modifyAttributeValue(updatedModel, modification);
      case 'add_link':
        return this.addLink(updatedModel, modification);
      case 'remove_element':
        return this.removeElement(updatedModel, modification);
      default:
        throw new Error(`Unsupported action for ObjectDiagram: ${modification.action}`);
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  /**
   * Find an object node by its instance name. Tries:
   *  1) exact `data.name` match,
   *  2) before-the-colon prefix match (handles legacy "name: Class"
   *     strings the LLM may emit),
   *  3) case-insensitive variant of the above.
   */
  private findObjectNodeByName(model: BESSERModel, name: string): BesserNode | undefined {
    if (!name) return undefined;
    const normalized = name.trim().toLowerCase();
    const candidates = ModifierHelpers.nodes(model).filter((n) => n.type === OBJECT_NODE_TYPE);
    for (const n of candidates) {
      const data = (n.data as any) || {};
      if (data.name === name) return n;
    }
    for (const n of candidates) {
      const data = (n.data as any) || {};
      const nodeName = typeof data.name === 'string' ? data.name : '';
      const nodeNameLower = nodeName.trim().toLowerCase();
      if (nodeNameLower === normalized) return n;
      const beforeColon = nodeNameLower.split(':')[0].trim();
      if (beforeColon === normalized) return n;
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

  // ─── Action handlers ────────────────────────────────────────────────────

  private addObject(model: BESSERModel, modification: ModelModification): BESSERModel {
    const changes = modification.changes;
    const target = modification.target;

    let objectName = (changes as any).objectName || target.objectName || changes.name || 'object';
    const className = (changes as any).className || '';

    // Strip a "name: ClassName" suffix the LLM may have added.
    if (typeof objectName === 'string' && objectName.includes(':')) {
      objectName = objectName.split(':')[0].trim();
    }

    // Generate a sensible instance name when LLM omitted it (or echoed the
    // class name back). Counts existing objects whose `data.classId`
    // matches the requested class so re-runs auto-increment.
    const requestedClassId = (changes as any).classId as string | undefined;
    if (!objectName || (className && objectName.toLowerCase() === className.toLowerCase())) {
      let count = 1;
      for (const n of ModifierHelpers.nodes(model)) {
        if (n.type !== OBJECT_NODE_TYPE) continue;
        const data = (n.data as any) || {};
        if (
          (requestedClassId && data.classId === requestedClassId) ||
          (typeof data.name === 'string' && data.name.includes(`: ${className}`))
        ) {
          count++;
        }
      }
      objectName = `${className.charAt(0).toLowerCase()}${className.slice(1)}${count}`;
    }

    const pos = this.nextPosition(model);
    const objectId = ModifierHelpers.generateUniqueId('object');

    // Build attribute rows directly on `data.attributes`.
    const attrSpecs = (changes.attributes ?? []) as Array<{
      name: string;
      type?: string;
      value?: string;
      attributeId?: string;
    }>;
    const attributeRows: ObjectAttributeRow[] = attrSpecs.map((attr) => {
      const row: ObjectAttributeRow = {
        id: ModifierHelpers.generateUniqueId('attr'),
        name: attr.value !== undefined && attr.value !== null && String(attr.value).length > 0
          ? `${attr.name} = ${attr.value}`
          : attr.name,
        attributeType: attr.type || 'str',
      };
      if (attr.attributeId) row.attributeId = attr.attributeId;
      if (attr.value !== undefined) row.value = attr.value;
      return row;
    });

    // Display name: when classId is set, `data.name` holds just the
    // instance name (the render layer appends `: ClassName` via the
    // bridge). Without classId, embed "instance: Class" so the canvas
    // still shows something useful.
    const displayName = requestedClassId ? objectName : (className ? `${objectName}: ${className}` : objectName);

    const baseHeight = 80;
    const totalHeight = baseHeight + attributeRows.length * 30;
    const width = 240;

    const nodeData: Record<string, unknown> = {
      name: displayName,
      attributes: attributeRows,
      methods: [],
    };
    if (requestedClassId) nodeData.classId = requestedClassId;
    if (className) nodeData.className = className;

    const node: BesserNode = {
      id: objectId,
      type: OBJECT_NODE_TYPE as any,
      position: { x: pos.x, y: pos.y },
      width,
      height: totalHeight,
      measured: { width, height: totalHeight },
      data: nodeData,
    };

    ModifierHelpers.addNode(model, node);
    return model;
  }

  private modifyObject(model: BESSERModel, modification: ModelModification): BESSERModel {
    const { objectId, objectName } = modification.target;
    const node = (objectId ? ModifierHelpers.findNodeById(model, objectId) : undefined) ||
      (objectName ? this.findObjectNodeByName(model, objectName) : undefined);
    if (node && modification.changes.name) {
      (node.data as any).name = modification.changes.name;
    }
    return model;
  }

  /**
   * Modify an attribute value on an existing object. v4: rows live on
   * `data.attributes` directly, no need to walk owner pointers.
   */
  private modifyAttributeValue(model: BESSERModel, modification: ModelModification): BESSERModel {
    const { objectName, attributeName } = modification.target;
    const newValue = modification.changes.value;

    if (!objectName || !attributeName || newValue === undefined) {
      throw new Error('modify_attribute_value requires target.objectName, target.attributeName, and changes.value');
    }

    const node = this.findObjectNodeByName(model, objectName);
    if (!node) {
      throw new Error(`Object '${objectName}' not found in the model.`);
    }

    const data = node.data as any;
    const rows: ObjectAttributeRow[] = Array.isArray(data.attributes) ? data.attributes : [];
    const targetLower = attributeName.toLowerCase();

    let found = false;
    for (const row of rows) {
      const rowName = (row.name || '').split('=')[0].trim();
      if (rowName === attributeName || rowName.toLowerCase() === targetLower) {
        row.name = `${attributeName} = ${newValue}`;
        row.value = newValue as any;
        found = true;
        break;
      }
    }

    if (!found) {
      throw new Error(`Attribute '${attributeName}' not found on object '${objectName}'.`);
    }

    return model;
  }

  private addLink(model: BESSERModel, modification: ModelModification): BESSERModel {
    const sourceName = (modification.changes as any).source as string | undefined;
    const targetName = (modification.changes as any).target as string | undefined;

    let sourceNode: BesserNode | undefined;
    if (modification.target.objectId) {
      sourceNode = ModifierHelpers.findNodeById(model, modification.target.objectId);
    }
    if (!sourceNode && sourceName) sourceNode = this.findObjectNodeByName(model, sourceName);
    const targetNode = targetName ? this.findObjectNodeByName(model, targetName) : undefined;

    if (!sourceNode || !targetNode) {
      throw new Error('Could not locate source or target object for link.');
    }

    const linkId = ModifierHelpers.generateUniqueId('link');
    const edge: BesserEdge = {
      id: linkId,
      type: 'ObjectLink' as any,
      source: sourceNode.id,
      target: targetNode.id,
      sourceHandle: 'Right',
      targetHandle: 'Left',
      data: {
        name: modification.changes.name || '',
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
    const { objectId } = target;

    // Collect every plausible name/identifier the LLM may have sent. Users
    // phrase "remove the class book1" / "remove book1" in many ways and
    // the LLM places the value in className / name / objectName variously.
    const candidates: string[] = [];
    for (const key of ['objectName', 'name', 'className', 'targetName', 'elementName']) {
      const v = (target as any)[key];
      if (typeof v === 'string' && v.trim()) candidates.push(v.trim());
    }
    if (modification.changes) {
      for (const v of Object.values(modification.changes)) {
        if (typeof v === 'string' && v.trim()) candidates.push(v.trim());
      }
    }

    let targetNode: BesserNode | undefined;
    if (objectId) targetNode = ModifierHelpers.findNodeById(model, objectId);
    if (!targetNode) {
      for (const cand of candidates) {
        targetNode = this.findObjectNodeByName(model, cand);
        if (targetNode) break;
      }
    }

    if (targetNode) {
      return ModifierHelpers.removeNodeWithChildren(model, targetNode.id);
    }

    // Idempotent: already removed in an earlier batch — no-op.
    console.warn(
      `[ObjectDiagramModifier] removeElement: no object matching ${JSON.stringify(candidates)} — ` +
      `treating as already removed (no-op).`
    );
    return model;
  }
}
