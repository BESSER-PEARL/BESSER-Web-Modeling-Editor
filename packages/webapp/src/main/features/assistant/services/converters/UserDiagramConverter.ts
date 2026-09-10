/**
 * User Profile Diagram Converter (v4-native)
 *
 * Converts simplified user-profile specs straight into the canonical v4
 * shape ({version: '4.0.0', type: 'UserDiagram', nodes[], edges[]}).
 *
 * A user-profile model is a set of class-instance boxes (`UserModelName`)
 * drawn from the fixed user metamodel. Each attribute row is a matching
 * criterion carrying a comparison operator (rendered like "age >= 18"):
 *   - `UserModelName` is the only node type; criterion rows live inline on
 *     `node.data.attributes` ({id, name, attributeOperator, value,
 *     attributeId?}) — there is no separate UserModelAttribute node,
 *   - the metamodel class icon is a plain `data.icon` SVG string (no
 *     separate UserModelIcon node) and the node renders in icon view,
 *   - links are `UserModelLink` edges (the library's default edge type for
 *     UserDiagram; handled exactly like ObjectLink).
 */

import type { BesserEdge, BesserNode } from '@besser/wme';
import { DiagramConverter, PositionGenerator, generateUniqueId } from './base';
import { createEmptyV4Model, directionToHandle } from '../shared/v4Builders';
import {
  USER_LINK_TYPE,
  USER_NODE_TYPE,
  USER_NODE_WIDTH,
  buildUserAttributeRow,
  userNodeHeight,
} from '../shared/userModelBuilders';

export class UserDiagramConverter implements DiagramConverter {
  private positionGenerator = new PositionGenerator();

  getDiagramType() {
    return 'UserDiagram' as const;
  }

  convertSingleElement(
    spec: any,
    position?: { x: number; y: number },
  ): { nodes: BesserNode[]; edges: BesserEdge[] } {
    const pos = position || this.positionGenerator.getNextPosition();
    const nodeId = generateUniqueId('user');

    const attributes = (Array.isArray(spec?.attributes) ? spec.attributes : []).map((attr: any) =>
      buildUserAttributeRow(attr),
    );
    const profileName = spec?.profileName || spec?.className || 'profile';
    const width = USER_NODE_WIDTH;
    const height = userNodeHeight(attributes.length);

    const data: Record<string, unknown> = {
      name: profileName,
      attributes,
      methods: [],
      // User diagrams render in icon view (the v3 fork's preferred preview).
      view: 'icon',
    };
    if (spec?.className) data.className = spec.className;
    if (spec?.classId) data.classId = spec.classId;
    if (typeof spec?.icon === 'string' && spec.icon.trim() !== '') data.icon = spec.icon;

    return {
      nodes: [
        {
          id: nodeId,
          type: USER_NODE_TYPE as any,
          position: { x: pos.x, y: pos.y },
          width,
          height,
          measured: { width, height },
          data,
        },
      ],
      edges: [],
    };
  }

  convertCompleteSystem(systemSpec: any) {
    this.positionGenerator.reset();
    const model = createEmptyV4Model('UserDiagram', systemSpec?.systemName || '');
    const nodes: BesserNode[] = model.nodes;
    const edges: BesserEdge[] = model.edges;
    const profileIdMap: Record<string, string> = {};

    (systemSpec?.profiles || []).forEach((profileSpec: any) => {
      const position = profileSpec.position || this.positionGenerator.getNextPosition();
      const { nodes: built } = this.convertSingleElement(profileSpec, position);
      const node = built[0];
      // Links may reference a profile by its instance name OR its class name.
      if (profileSpec.profileName) profileIdMap[profileSpec.profileName] = node.id;
      if (profileSpec.className && !profileIdMap[profileSpec.className]) {
        profileIdMap[profileSpec.className] = node.id;
      }
      nodes.push(node);
    });

    (systemSpec?.links || []).forEach((link: any) => {
      const sourceId = profileIdMap[link.source];
      const targetId = profileIdMap[link.target];
      if (!sourceId || !targetId) return;

      const linkName = link.relationshipType || '';
      edges.push({
        id: generateUniqueId('link'),
        source: sourceId,
        target: targetId,
        type: USER_LINK_TYPE as any,
        sourceHandle: directionToHandle(link.sourceDirection, 'Right'),
        targetHandle: directionToHandle(link.targetDirection, 'Left'),
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
    });

    return model;
  }
}
