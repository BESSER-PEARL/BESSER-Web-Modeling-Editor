/**
 * Component Diagram Converter (v4-native)
 * Converts a simplified ComponentDiagram spec emitted by the modeling agent
 * into a v4 ComponentDiagram model.
 *
 * Nodes: `componentSubsystem` (container), `component`.
 * Edges: `ComponentDependency` with `data.stereotype`.
 * Layout: subsystems are placed left-to-right; components inside a subsystem
 *         are stacked below its header (positions relative to the subsystem).
 */

import type { BesserEdge, BesserNode } from '@besser/wme';
import { DiagramConverter, centerNodesOnOrigin, generateUniqueId } from './base';
import { buildV4Edge, buildV4Node, createEmptyV4Model } from '../shared/v4Builders';

const SUBSYSTEM_W = 300;
const SUBSYSTEM_H_MIN = 160;
const COMPONENT_W = 160;
const COMPONENT_H = 80;
const COMPONENT_GAP = 20;
const SUBSYSTEM_GAP_X = 60;
const SUBSYSTEM_PADDING = 30;
const TOP_PADDING = 40;

export class ComponentDiagramConverter implements DiagramConverter {
  getDiagramType() {
    return 'ComponentDiagram' as const;
  }

  convertSingleElement(spec: any): { nodes: BesserNode[]; edges: BesserEdge[] } {
    const name = spec?.name || spec?.elementName || 'Component';
    const { nodes, edges } = this.convertCompleteSystem({
      systemName: name,
      subsystems: [],
      components: [{ id: 'comp1', name, owner: null, stereotype: spec?.stereotype || 'solution' }],
      dependencies: [],
    });
    return { nodes, edges };
  }

  convertCompleteSystem(systemSpec: any) {
    const subsystems: any[] = Array.isArray(systemSpec?.subsystems) ? systemSpec.subsystems : [];
    const components: any[] = Array.isArray(systemSpec?.components) ? systemSpec.components : [];
    const deps: any[] = Array.isArray(systemSpec?.dependencies) ? systemSpec.dependencies : [];

    const model = createEmptyV4Model('ComponentDiagram', systemSpec?.systemName || '');
    const nodes: BesserNode[] = model.nodes;
    const edges: BesserEdge[] = model.edges;
    // spec id -> node id
    const idMap: Record<string, string> = {};
    // subsystem node id -> absolute position, to nest subsystems relative to their owner
    const absPos: Record<string, { x: number; y: number }> = {};

    // 1. Subsystems left-to-right, tall enough for their components.
    const compCount: Record<string, number> = {};
    subsystems.forEach((s) => {
      compCount[s.id] = 0;
    });
    components.forEach((c) => {
      if (c.owner && compCount[c.owner] !== undefined) compCount[c.owner] += 1;
    });

    let curX = 0;
    subsystems.forEach((sub) => {
      const height = Math.max(
        SUBSYSTEM_H_MIN,
        TOP_PADDING + (compCount[sub.id] || 0) * (COMPONENT_H + COMPONENT_GAP) + SUBSYSTEM_PADDING,
      );
      const id = generateUniqueId('sub');
      const parentId = sub.owner ? idMap[sub.owner] : undefined;
      const parentPos = (parentId && absPos[parentId]) || { x: 0, y: 0 };
      idMap[sub.id] = id;
      absPos[id] = { x: curX, y: 0 };
      nodes.push(
        buildV4Node(
          id,
          'componentSubsystem',
          { x: curX - parentPos.x, y: -parentPos.y },
          { width: SUBSYSTEM_W, height },
          {
            name: typeof sub.name === 'string' ? sub.name : '',
            stereotype: 'subsystem',
            isComponentSubsystemHeaderShown: true,
          },
          parentId,
        ),
      );
      curX += SUBSYSTEM_W + SUBSYSTEM_GAP_X;
    });

    // 2. Components: stacked inside their owner, else to the right of the subsystems.
    const ownerCursor: Record<string, number> = {};
    let floatingX = curX;
    components.forEach((comp) => {
      const id = generateUniqueId('comp');
      idMap[comp.id] = id;
      const parentId = comp.owner ? idMap[comp.owner] : undefined;
      let position: { x: number; y: number };
      if (parentId) {
        const idx = ownerCursor[comp.owner] || 0;
        position = { x: SUBSYSTEM_PADDING, y: TOP_PADDING + idx * (COMPONENT_H + COMPONENT_GAP) };
        ownerCursor[comp.owner] = idx + 1;
      } else {
        position = { x: floatingX, y: 0 };
        floatingX += COMPONENT_W + COMPONENT_GAP;
      }
      nodes.push(
        buildV4Node(
          id,
          'component',
          position,
          { width: COMPONENT_W, height: COMPONENT_H },
          {
            name: typeof comp.name === 'string' ? comp.name : '',
            stereotype: comp.stereotype || 'solution',
            isComponentHeaderShown: true,
            realizes: [],
            processModelRefs: [],
          },
          parentId,
        ),
      );
    });

    // 3. Dependencies.
    deps.forEach((dep) => {
      const source = idMap[String(dep.source)];
      const target = idMap[String(dep.target)];
      if (!source || !target) return;
      edges.push(
        buildV4Edge(
          generateUniqueId('cdep'),
          'ComponentDependency',
          source,
          target,
          { source: 'right', target: 'left' },
          { name: '', label: '', stereotype: dep.stereotype || 'uses' },
        ),
      );
    });

    centerNodesOnOrigin(model);
    return model;
  }
}
