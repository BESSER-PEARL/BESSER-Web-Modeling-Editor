/**
 * Deployment Diagram Converter (v4-native)
 * Converts a simplified DeploymentDiagram spec emitted by the modeling agent
 * into a v4 DeploymentDiagram model.
 *
 * Nodes: `deploymentNode` (container), `deploymentArtifact` (inside nodes,
 *        positioned relative to them), `deploymentComponent` (logical, below
 *        the nodes).
 * Edges: `DeploymentDependency`.
 */

import type { BesserEdge, BesserNode } from '@besser/wme';
import { DiagramConverter, centerNodesOnOrigin, generateUniqueId } from './base';
import { buildV4Edge, buildV4Node, createEmptyV4Model } from '../shared/v4Builders';

const NODE_W = 280;
const NODE_PADDING = 30;
const ARTIFACT_W = 160;
const ARTIFACT_H = 60;
const ARTIFACT_GAP = 15;
const NODE_TOP = 50;
const NODE_GAP_X = 60;
const NODE_GAP_Y = 120;
const COMP_W = 160;
const COMP_H = 60;

export class DeploymentDiagramConverter implements DiagramConverter {
  getDiagramType() {
    return 'DeploymentDiagram' as const;
  }

  convertSingleElement(spec: any): { nodes: BesserNode[]; edges: BesserEdge[] } {
    const name = spec?.name || 'Node';
    const { nodes, edges } = this.convertCompleteSystem({
      systemName: name,
      nodes: [{ id: 'node1', name, stereotype: 'node' }],
      artifacts: [],
      deployComponents: [],
      dependencies: [],
    });
    return { nodes, edges };
  }

  convertCompleteSystem(systemSpec: any) {
    const specNodes: any[] = Array.isArray(systemSpec?.nodes) ? systemSpec.nodes : [];
    const artifacts: any[] = Array.isArray(systemSpec?.artifacts) ? systemSpec.artifacts : [];
    const deployComponents: any[] = Array.isArray(systemSpec?.deployComponents) ? systemSpec.deployComponents : [];
    const deps: any[] = Array.isArray(systemSpec?.dependencies) ? systemSpec.dependencies : [];

    const model = createEmptyV4Model('DeploymentDiagram', systemSpec?.systemName || '');
    const nodes: BesserNode[] = model.nodes;
    const edges: BesserEdge[] = model.edges;
    const idMap: Record<string, string> = {};

    // 1. Count artifacts per node (for node height).
    const artCount: Record<string, number> = {};
    specNodes.forEach((n) => {
      artCount[n.id] = 0;
    });
    artifacts.forEach((a) => {
      if (a.owner && artCount[a.owner] !== undefined) artCount[a.owner] += 1;
    });

    // 2. Nodes left-to-right (top row).
    let nodeX = 0;
    let maxNodeH = 0;
    specNodes.forEach((n) => {
      const height = Math.max(160, NODE_TOP + (artCount[n.id] || 0) * (ARTIFACT_H + ARTIFACT_GAP) + NODE_PADDING);
      const id = generateUniqueId('dnode');
      idMap[n.id] = id;
      maxNodeH = Math.max(maxNodeH, height);
      nodes.push(
        buildV4Node(
          id,
          'deploymentNode',
          { x: nodeX, y: 0 },
          { width: NODE_W, height },
          {
            name: typeof n.name === 'string' ? n.name : '',
            stereotype: n.stereotype || 'node',
            isComponentHeaderShown: true,
          },
        ),
      );
      nodeX += NODE_W + NODE_GAP_X;
    });

    // 3. Artifacts stacked inside their node.
    const nodeArtCursor: Record<string, number> = {};
    artifacts.forEach((art) => {
      const id = generateUniqueId('dart');
      idMap[art.id] = id;
      const parentId = art.owner ? idMap[art.owner] : undefined;
      let position = { x: 0, y: 0 };
      if (parentId) {
        const idx = nodeArtCursor[art.owner] || 0;
        position = { x: NODE_PADDING, y: NODE_TOP + idx * (ARTIFACT_H + ARTIFACT_GAP) };
        nodeArtCursor[art.owner] = idx + 1;
      }
      nodes.push(
        buildV4Node(
          id,
          'deploymentArtifact',
          position,
          { width: ARTIFACT_W, height: ARTIFACT_H },
          { name: typeof art.name === 'string' ? art.name : '', manifests: [] },
          parentId,
        ),
      );
    });

    // 4. Logical DeploymentComponents in a row below the nodes.
    const compRowY = maxNodeH + NODE_GAP_Y;
    let compX = NODE_PADDING;
    deployComponents.forEach((dc) => {
      const id = generateUniqueId('dcomp');
      idMap[dc.id] = id;
      nodes.push(
        buildV4Node(
          id,
          'deploymentComponent',
          { x: compX, y: compRowY },
          { width: COMP_W, height: COMP_H },
          {
            name: typeof dc.name === 'string' ? dc.name : '',
            stereotype: dc.stereotype || 'solution',
            isComponentHeaderShown: true,
          },
        ),
      );
      // The artifact that manifests this component.
      if (dc.manifestedBy && idMap[dc.manifestedBy]) {
        edges.push(
          buildV4Edge(
            generateUniqueId('dman'),
            'DeploymentDependency',
            idMap[dc.manifestedBy],
            id,
            { source: 'bottom', target: 'top' },
            { name: '', label: '' },
          ),
        );
      }
      compX += COMP_W + ARTIFACT_GAP;
    });

    // 5. Additional dependencies.
    deps.forEach((dep) => {
      const source = idMap[String(dep.source)];
      const target = idMap[String(dep.target)];
      if (!source || !target) return;
      const name = dep.name || '';
      edges.push(
        buildV4Edge(
          generateUniqueId('ddep'),
          'DeploymentDependency',
          source,
          target,
          { source: 'right', target: 'left' },
          { name, label: name },
        ),
      );
    });

    centerNodesOnOrigin(model);
    return model;
  }
}
