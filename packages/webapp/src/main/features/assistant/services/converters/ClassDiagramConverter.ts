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
import { CLASS_STEREOTYPE, buildClassNode, classNodeHeight, createEmptyV4Model, directionToHandle } from '../shared/v4Builders';

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
  isExternalId?: boolean;
};
import { applyAssistantRelationshipType } from '../shared/relationshipMapping';

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
    if (spec.isAbstract) stereotype = CLASS_STEREOTYPE.Abstract;
    else if (spec.isEnumeration) stereotype = CLASS_STEREOTYPE.Enumeration;
    else if (spec.isInterface) stereotype = CLASS_STEREOTYPE.Interface;

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
        ...(stereotype === CLASS_STEREOTYPE.Abstract || stereotype === CLASS_STEREOTYPE.Interface ? { italic: true } : {}),
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
    const attachedClasses = new Set<string>();
    // null = plain class; 'abstract' / 'enumeration' / 'interface' otherwise.
    const stereotypeOf = (nodeId: string): string | null => {
      const node = nodes.find((n) => n.id === nodeId);
      const stereotype = (node?.data as { stereotype?: string } | undefined)?.stereotype;
      return stereotype ? stereotype.toLowerCase() : null;
    };

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
      const associationClassId = classIdMap[rel.associationClass];
      if (rel.associationClass != null) {
        // Do not silently downgrade an invalid attributed link to a plain
        // association: that would discard per-link fields in generated apps.
        if ((rel.type || 'Association').toLowerCase() !== 'association'
            || !sourceId || !targetId || !associationClassId
            || stereotypeOf(sourceId) === 'enumeration'
            || stereotypeOf(targetId) === 'enumeration'
            || stereotypeOf(associationClassId) !== null
            || associationClassId === sourceId || associationClassId === targetId
            || attachedClasses.has(associationClassId)) {
          throw new Error(`Invalid association-class attachment: ${rel.associationClass}`);
        }
        attachedClasses.add(associationClassId);
      }

      if (sourceId && targetId) {
        const relId = generateUniqueId('rel');
        const relationshipName = rel.name || '';

        const edge: BesserEdge = {
          id: relId,
          source: sourceId,
          target: targetId,
          type: 'ClassBidirectional' as any,
          sourceHandle: directionToHandle(rel.sourceDirection, 'Left'),
          targetHandle: directionToHandle(rel.targetDirection, 'Right'),
          data: {
            label: relationshipName,
            ...(relationshipName && { name: relationshipName }),
            sourceMultiplicity: rel.sourceMultiplicity || '1',
            targetMultiplicity: rel.targetMultiplicity || '1',
            sourceRole: rel.sourceRole || '',
            targetRole: relationshipName,
            isManuallyLayouted: false,
            points: [
              { x: 100, y: 10 },
              { x: 0, y: 10 },
            ],
          } as any,
        };
        // Type + explicit per-end navigability (data.sourceNavigable /
        // data.targetNavigable); ClassUnidirectional is never produced.
        applyAssistantRelationshipType(edge, rel.type);
        edges.push(edge);

        if (associationClassId) {
          // Association class: the canonical v4 ClassLinkRel anchors its
          // source on the association EDGE id (see the library's
          // `utils/associationClassLink.ts`), its target on the class node.
          edges.push({
            id: generateUniqueId('classlink'),
            source: relId,
            sourceHandle: 'Center',
            target: associationClassId,
            targetHandle: 'Up',
            type: 'ClassLinkRel' as any,
            data: { points: [] } as any,
          });
        }
      }
    });

    this.createConstraints(systemSpec, classIdMap, nodes, edges);

    return model;
  }

  /**
   * Persist the agent's OCL invariants as `ClassOCLConstraint` nodes linked to
   * their context class by a `ClassOCLLink` edge. Without this the agent's
   * `constraints` reach the browser and are dropped, so business rules the
   * user stated in prose ("guests must not exceed room capacity") never reach
   * the generator.
   *
   * Invariants sharing a context are merged into one box (`data.expression`
   * carries every `context ... inv ...` block), matching how the backend
   * parses them and how the editor's own OCL boxes are authored.
   */
  private createConstraints(
    systemSpec: any,
    classIdMap: Record<string, string>,
    nodes: BesserNode[],
    edges: BesserEdge[],
  ) {
    const constraints = systemSpec?.constraints;
    if (!Array.isArray(constraints) || constraints.length === 0) return;

    const byContext = new Map<string, string[]>();
    for (const c of constraints) {
      const context = c?.context;
      const expression = typeof c?.expression === 'string' ? c.expression.trim() : '';
      if (!expression || !classIdMap[context]) continue;
      if (!byContext.has(context)) byContext.set(context, []);
      byContext.get(context)!.push(expression);
    }

    let index = 0;
    for (const [context, expressions] of byContext) {
      const nodeId = generateUniqueId('ocl');
      nodes.push({
        id: nodeId,
        type: 'ClassOCLConstraint' as any,
        position: { x: -700, y: index * 170 },
        width: 640,
        height: 130,
        measured: { width: 640, height: 130 },
        data: {
          name: '',
          expression: expressions.join('\n\n'),
          description: '',
        },
      });

      edges.push({
        id: generateUniqueId('ocllink'),
        source: nodeId,
        target: classIdMap[context],
        type: 'ClassOCLLink' as any,
        sourceHandle: 'right',
        targetHandle: 'left',
        data: { points: [] } as any,
      });
      index++;
    }
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
      // A natural identifier ("identified by its room number"): the agent
      // marks it and the SQLAlchemy generator emits unique=True for it.
      if (attr.isExternalId) row.isExternalId = true;

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
}
