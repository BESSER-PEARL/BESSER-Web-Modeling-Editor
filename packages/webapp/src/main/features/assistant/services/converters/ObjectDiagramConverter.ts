/**
 * Object Diagram Converter (v4-native)
 *
 * Converts simplified object specifications straight into the canonical v4
 * shape ({version: '4.0.0', nodes[], edges[]}). Node/edge shapes are
 * identical to what the editor produces:
 *   - `objectName` is the only node type; attribute rows live inline on
 *     `node.data.attributes` ({id, name, value, attributeType,
 *     attributeId?}) — there is no separate ObjectAttribute node,
 *   - links are `ObjectLink` edges.
 *
 * Display name format: `data.name` is just the instance name (no
 * "instanceName: ClassName" suffix) when `classId` links the object to a
 * class — the inspector resolves the className via the bridge. Without a
 * classId we embed "instance: Class" in `data.name` so the canvas still
 * shows something useful (same convention as ObjectDiagramModifier).
 */

import type { BesserEdge, BesserNode } from '@besser/wme';
import { DiagramConverter, PositionGenerator, generateUniqueId } from './base';
import { createEmptyV4Model, directionToHandle } from '../shared/v4Builders';

type ObjectAttributeRow = {
  id: string;
  name: string;
  value?: unknown;
  attributeType?: string;
  attributeId?: string;
};

export class ObjectDiagramConverter implements DiagramConverter {
  private positionGenerator = new PositionGenerator();

  getDiagramType() {
    return 'ObjectDiagram' as const;
  }

  convertSingleElement(
    spec: any,
    position?: { x: number; y: number },
  ): { nodes: BesserNode[]; edges: BesserEdge[] } {
    const pos = position || this.positionGenerator.getNextPosition();
    const objectId = generateUniqueId('object');

    // Sanitize objectName: strip any ": ClassName" suffix the LLM may have included
    let objectName = spec.objectName || 'object';
    if (objectName.includes(':')) {
      objectName = objectName.split(':')[0].trim();
    }
    if (!objectName || (spec.className && objectName.toLowerCase() === spec.className.toLowerCase())) {
      objectName = `${spec.className.charAt(0).toLowerCase()}${spec.className.slice(1)}1`;
    }

    const attributes = this.createAttributeRows(spec);

    const baseHeight = 80;
    const totalHeight = baseHeight + attributes.length * 30;

    const data: Record<string, unknown> = {
      // When classId is set the inspector resolves " : ClassName" from the
      // class-diagram bridge, so `.name` must hold ONLY the instance name.
      name: spec.classId ? objectName : (spec.className ? `${objectName}: ${spec.className}` : objectName),
      attributes,
    };
    if (spec.classId) data.classId = spec.classId;
    if (spec.className) data.className = spec.className;

    return {
      nodes: [{
        id: objectId,
        type: 'objectName' as any,
        position: { x: pos.x, y: pos.y },
        width: 240,
        height: totalHeight,
        measured: { width: 240, height: totalHeight },
        data,
      }],
      edges: [],
    };
  }

  convertCompleteSystem(systemSpec: any) {
    this.positionGenerator.reset();
    const model = createEmptyV4Model('ObjectDiagram', systemSpec.systemName || '');
    const nodes: BesserNode[] = model.nodes;
    const edges: BesserEdge[] = model.edges;
    const objectIdMap: Record<string, string> = {};

    systemSpec.objects?.forEach((objectSpec: any) => {
      const position = objectSpec.position || this.positionGenerator.getNextPosition();
      const { nodes: objectNodes } = this.convertSingleElement(objectSpec, position);
      const objectNode = objectNodes[0];
      objectIdMap[objectSpec.objectName] = objectNode.id;
      nodes.push(objectNode);
    });

    systemSpec.links?.forEach((link: any) => {
      const sourceId = objectIdMap[link.source];
      const targetId = objectIdMap[link.target];

      if (sourceId && targetId) {
        const linkId = generateUniqueId('link');
        const linkName = link.relationshipType || '';

        edges.push({
          id: linkId,
          source: sourceId,
          target: targetId,
          type: 'ObjectLink' as any,
          sourceHandle: directionToHandle(link.sourceDirection, 'Left'),
          targetHandle: directionToHandle(link.targetDirection, 'Right'),
          data: {
            label: linkName,
            ...(linkName && { name: linkName }),
            isManuallyLayouted: false,
            points: [
              { x: 100, y: 10 },
              { x: 0, y: 10 },
            ],
          },
        });
      }
    });

    return model;
  }

  private createAttributeRows(spec: any): ObjectAttributeRow[] {
    const rows: ObjectAttributeRow[] = [];

    spec.attributes?.forEach((attr: any) => {
      const row: ObjectAttributeRow = {
        id: generateUniqueId('attr'),
        name: attr.name,
        attributeType: attr.type || 'str',
      };
      if (attr.value !== undefined) row.value = attr.value;

      // Add attributeId reference if provided (links to class diagram attribute)
      if (attr.attributeId) {
        row.attributeId = attr.attributeId;
      }

      rows.push(row);
    });

    return rows;
  }
}
