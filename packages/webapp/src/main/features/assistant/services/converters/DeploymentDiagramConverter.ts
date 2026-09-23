/**
 * Deployment Diagram Converter
 * Converts a simplified DeploymentDiagram spec emitted by the modeling agent
 * into the Apollon DeploymentDiagram model.
 *
 * Elements: DeploymentNode (container), DeploymentArtifact (inside nodes),
 *           DeploymentComponent (logical, outside nodes).
 * Relationships: DeploymentDependency.
 */

import { DiagramConverter, generateUniqueId } from './base';

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

  convertSingleElement(spec: any) {
    const name = spec?.name || 'Node';
    return this.convertCompleteSystem({
      systemName: name,
      nodes: [{ id: 'node1', name, stereotype: 'node' }],
      artifacts: [],
      deployComponents: [],
      dependencies: [],
    });
  }

  convertCompleteSystem(systemSpec: any) {
    const nodes: any[] = Array.isArray(systemSpec?.nodes) ? systemSpec.nodes : [];
    const artifacts: any[] = Array.isArray(systemSpec?.artifacts) ? systemSpec.artifacts : [];
    const deployComponents: any[] = Array.isArray(systemSpec?.deployComponents) ? systemSpec.deployComponents : [];
    const deps: any[] = Array.isArray(systemSpec?.dependencies) ? systemSpec.dependencies : [];

    const elements: Record<string, any> = {};
    const relationships: Record<string, any> = {};
    const idMap: Record<string, string> = {};

    // ── 1. Group artifacts by node ─────────────────────────────────────
    const nodeArtifacts: Record<string, any[]> = {};
    nodes.forEach((n) => { nodeArtifacts[n.id] = []; });
    artifacts.forEach((a) => {
      if (a.owner && nodeArtifacts[a.owner] !== undefined) {
        nodeArtifacts[a.owner].push(a);
      }
    });

    // ── 2. Place nodes left-to-right (top row) ─────────────────────────
    let nodeX = 0;
    const nodeBounds: Record<string, { x: number; y: number; width: number; height: number }> = {};

    nodes.forEach((node) => {
      const artCount = nodeArtifacts[node.id]?.length || 0;
      const nodeH = Math.max(
        160,
        NODE_TOP + artCount * (ARTIFACT_H + ARTIFACT_GAP) + NODE_PADDING,
      );
      const nodeW = NODE_W;
      const apollonId = generateUniqueId('dnode');
      idMap[node.id] = apollonId;
      nodeBounds[node.id] = { x: nodeX, y: 0, width: nodeW, height: nodeH };
      elements[apollonId] = {
        id: apollonId,
        name: typeof node.name === 'string' ? node.name : '',
        type: 'DeploymentNode',
        owner: null,
        bounds: { x: nodeX, y: 0, width: nodeW, height: nodeH },
        stereotype: node.stereotype || 'node',
        displayStereotype: true,
      };
      nodeX += nodeW + NODE_GAP_X;
    });

    // ── 3. Place artifacts inside nodes ────────────────────────────────
    const nodeArtCursor: Record<string, number> = {};
    artifacts.forEach((art) => {
      const apollonId = generateUniqueId('dart');
      idMap[art.id] = apollonId;
      let x = 0, y = 0, owner: string | null = null;
      if (art.owner && idMap[art.owner]) {
        owner = idMap[art.owner];
        const nb = nodeBounds[art.owner];
        const idx = nodeArtCursor[art.owner] || 0;
        x = (nb?.x || 0) + NODE_PADDING;
        y = (nb?.y || 0) + NODE_TOP + idx * (ARTIFACT_H + ARTIFACT_GAP);
        nodeArtCursor[art.owner] = idx + 1;
      }
      elements[apollonId] = {
        id: apollonId,
        name: typeof art.name === 'string' ? art.name : '',
        type: 'DeploymentArtifact',
        owner,
        bounds: { x, y, width: ARTIFACT_W, height: ARTIFACT_H },
        manifests: [],
      };
    });

    // ── 4. Place DeploymentComponents (logical) below nodes ────────────
    const maxNodeH = nodes.length
      ? Math.max(...nodes.map((n) => (nodeBounds[n.id]?.height || 0)))
      : 0;
    const compRowY = maxNodeH + NODE_GAP_Y;
    let compX = NODE_PADDING;

    deployComponents.forEach((dc) => {
      const apollonId = generateUniqueId('dcomp');
      idMap[dc.id] = apollonId;
      elements[apollonId] = {
        id: apollonId,
        name: typeof dc.name === 'string' ? dc.name : '',
        type: 'DeploymentComponent',
        owner: null,
        bounds: { x: compX, y: compRowY, width: COMP_W, height: COMP_H },
        stereotype: dc.stereotype || 'solution',
        displayStereotype: true,
      };
      // Create manifest relationship if manifestedBy is set
      if (dc.manifestedBy && idMap[dc.manifestedBy]) {
        const manifestId = generateUniqueId('dman');
        relationships[manifestId] = {
          id: manifestId,
          name: '',
          type: 'DeploymentDependency',
          owner: null,
          bounds: { x: 0, y: 0, width: 1, height: 80 },
          path: [{ x: 0, y: 0 }, { x: 0, y: 80 }],
          source: { element: idMap[dc.manifestedBy], direction: 'Down' },
          target: { element: apollonId, direction: 'Up' },
          isManuallyLayouted: false,
        };
      }
      compX += COMP_W + ARTIFACT_GAP;
    });

    // ── 5. Additional dependencies ─────────────────────────────────────
    deps.forEach((dep) => {
      const srcId = idMap[String(dep.source)];
      const tgtId = idMap[String(dep.target)];
      if (!srcId || !tgtId) return;
      const relId = generateUniqueId('ddep');
      relationships[relId] = {
        id: relId,
        name: dep.name || '',
        type: 'DeploymentDependency',
        owner: null,
        bounds: { x: 0, y: 0, width: 100, height: 1 },
        path: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        source: { element: srcId, direction: 'Right' },
        target: { element: tgtId, direction: 'Left' },
        isManuallyLayouted: false,
      };
    });

    // ── 6. Centre on origin ────────────────────────────────────────────
    const placed = Object.values(elements);
    if (placed.length) {
      const minX = Math.min(...placed.map((e) => e.bounds.x));
      const minY = Math.min(...placed.map((e) => e.bounds.y));
      const maxX = Math.max(...placed.map((e) => e.bounds.x + e.bounds.width));
      const maxY = Math.max(...placed.map((e) => e.bounds.y + e.bounds.height));
      const offsetX = -(minX + maxX) / 2;
      const offsetY = -(minY + maxY) / 2;
      placed.forEach((e) => {
        e.bounds.x += offsetX;
        e.bounds.y += offsetY;
      });
    }

    const allBounds = Object.values(elements).map((e) => e.bounds);
    const totalW = allBounds.length
      ? Math.max(...allBounds.map((b) => b.x + b.width)) - Math.min(...allBounds.map((b) => b.x))
      : 600;
    const totalH = allBounds.length
      ? Math.max(...allBounds.map((b) => b.y + b.height)) - Math.min(...allBounds.map((b) => b.y))
      : 400;

    return {
      version: '3.0.0',
      type: 'DeploymentDiagram',
      size: { width: Math.max(600, totalW + 80), height: Math.max(300, totalH + 80) },
      interactive: { elements: {}, relationships: {} },
      elements,
      relationships,
      assessments: {},
    };
  }
}
