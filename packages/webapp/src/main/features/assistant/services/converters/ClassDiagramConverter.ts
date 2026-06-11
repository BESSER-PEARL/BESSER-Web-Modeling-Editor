/**
 * Class Diagram Converter (v4-native)
 *
 * Converts simplified class specifications straight into the canonical v4
 * shape ({version: '4.0.0', nodes[], edges[]}) — no v3 detour. Node/edge
 * shapes are identical to what the editor produces:
 *   - all classifiers are `node.type === 'class'` with `data.stereotype`
 *     discriminating Class / AbstractClass / Interface / Enumeration,
 *   - attributes / methods are inline ClassifierMember rows on
 *     `node.data.attributes` / `node.data.methods`,
 *   - relationships are edges with role / multiplicity on `edge.data`.
 */

import type { BesserEdge, BesserNode } from '@besser/wme';
import { DiagramConverter, PositionGenerator, generateUniqueId } from './base';
import { normalizeType } from '../shared/typeNormalization';
import { buildClassNode, classNodeHeight, createEmptyV4Model, directionToHandle } from '../shared/v4Builders';

type ClassifierMemberRow = {
  id: string;
  name: string;
  attributeType?: string;
  visibility?: string;
  isDerived?: boolean;
  defaultValue?: unknown;
  isOptional?: boolean;
  code?: string;
  implementationType?: string;
};

export class ClassDiagramConverter implements DiagramConverter {
  private positionGenerator = new PositionGenerator();

  getDiagramType() {
    return 'ClassDiagram' as const;
  }

  convertSingleElement(
    spec: any,
    position?: { x: number; y: number },
    classNames?: Set<string>,
  ): { nodes: BesserNode[]; edges: BesserEdge[] } {
    const pos = position || this.positionGenerator.getNextPosition();
    const classId = generateUniqueId('class');

    let stereotype: string | null = null;
    if (spec.isAbstract) stereotype = 'abstract';
    else if (spec.isEnumeration) stereotype = 'enumeration';
    else if (spec.isInterface) stereotype = 'interface';

    const attributes = this.createAttributeRows(spec, classNames);
    const methods = this.createMethodRows(spec);

    const node = buildClassNode({
      id: classId,
      name: spec.className,
      stereotype,
      x: pos.x,
      y: pos.y,
      width: 220,
      height: classNodeHeight(attributes.length, methods.length),
      extraData: {
        attributes,
        methods,
        // Italic is a render-time hint for abstract classes / interfaces.
        ...(stereotype === 'abstract' || stereotype === 'interface' ? { italic: true } : {}),
      },
    });

    return { nodes: [node], edges: [] };
  }

  convertCompleteSystem(systemSpec: any) {
    this.positionGenerator.reset();
    const model = createEmptyV4Model('ClassDiagram', systemSpec.systemName || '');
    const nodes: BesserNode[] = model.nodes;
    const edges: BesserEdge[] = model.edges;
    const classIdMap: Record<string, string> = {};

    // Collect all class/enum names so attribute types can reference them
    const allClassNames = new Set<string>();
    systemSpec.classes?.forEach((c: any) => { if (c.className) allClassNames.add(c.className); });

    systemSpec.classes?.forEach((classSpec: any) => {
      const position = classSpec.position || this.positionGenerator.getNextPosition();
      const { nodes: classNodes } = this.convertSingleElement(classSpec, position, allClassNames);
      const classNode = classNodes[0];
      classIdMap[classSpec.className] = classNode.id;
      nodes.push(classNode);
    });

    systemSpec.relationships?.forEach((rel: any) => {
      const sourceId = classIdMap[rel.sourceClass || rel.source];
      const targetId = classIdMap[rel.targetClass || rel.target];

      if (sourceId && targetId) {
        const relId = generateUniqueId('rel');
        const relationshipType = this.getRelationshipType(rel.type);
        const relationshipName = rel.name || '';

        edges.push({
          id: relId,
          source: sourceId,
          target: targetId,
          type: relationshipType as any,
          sourceHandle: directionToHandle(rel.sourceDirection, 'Left'),
          targetHandle: directionToHandle(rel.targetDirection, 'Right'),
          data: {
            label: relationshipName,
            ...(relationshipName && { name: relationshipName }),
            sourceMultiplicity: rel.sourceMultiplicity || '1',
            targetMultiplicity: rel.targetMultiplicity || '1',
            sourceRole: '',
            targetRole: relationshipName,
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

  private createAttributeRows(spec: any, classNames?: Set<string>): ClassifierMemberRow[] {
    const rows: ClassifierMemberRow[] = [];

    spec.attributes?.forEach((attr: any) => {
      const row: ClassifierMemberRow = {
        id: generateUniqueId('attr'),
        name: attr.name,
        attributeType: normalizeType(attr.type, classNames),
        visibility: attr.visibility || 'public',
      };

      if (attr.isDerived) row.isDerived = true;
      if (attr.defaultValue !== undefined && attr.defaultValue !== null) {
        row.defaultValue = attr.defaultValue;
      }
      if (attr.isOptional) row.isOptional = true;

      rows.push(row);
    });

    return rows;
  }

  private createMethodRows(spec: any): ClassifierMemberRow[] {
    const rows: ClassifierMemberRow[] = [];

    spec.methods?.forEach((method: any) => {
      const paramStr = method.parameters?.map((p: any) => p.type ? `${p.name}: ${normalizeType(p.type)}` : p.name).join(', ') || '';
      const rawReturn = (method.returnType || 'void').replace(/^:+/, '');  // Strip leading colons
      const normalizedReturnType = normalizeType(rawReturn);
      // Strip any signature artifacts from the method name (LLM sometimes embeds params/return in name)
      const cleanMethodName = (method.name || 'method').replace(/\(.*\).*$/, '').trim();

      const row: ClassifierMemberRow = {
        id: generateUniqueId('method'),
        name: `${cleanMethodName}(${paramStr})`,
        attributeType: normalizedReturnType,
        visibility: method.visibility || 'public',
      };

      if (method.code) {
        row.code = method.code;
        if (!method.implementationType) {
          row.implementationType = 'code';
        }
      }

      if (method.implementationType) {
        row.implementationType = method.implementationType;
      }

      rows.push(row);
    });

    return rows;
  }

  private getRelationshipType(type: string): string {
    switch (type?.toLowerCase()) {
      case 'inheritance':
      case 'generalization':
        return 'ClassInheritance';
      case 'composition':
        return 'ClassComposition';
      case 'aggregation':
        return 'ClassAggregation';
      default:
        return 'ClassBidirectional';
    }
  }
}
