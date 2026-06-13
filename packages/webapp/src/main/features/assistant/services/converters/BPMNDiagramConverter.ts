/**
 * BPMN Diagram Converter
 * Converts a simplified base-BPMN process spec (nodes + sequence flows)
 * emitted by the modeling agent into the Apollon BPMNDiagram model.
 *
 * Base BPMN only — no agentic fields (isAgentic, role, gatewayRole,
 * collaborationMode, mergingStrategy, trustScore, governanceDsl, …) and no
 * pools / lanes (flat process).  Output shape matches the verified base-BPMN
 * template shape (see .claude/bpmn/11-bpmn-load-template-examples-guide.md):
 * model.type === "BPMNDiagram"; sequence-flow paths are left for the editor's
 * layouter to recompute on load (isManuallyLayouted: false), so only element
 * bounds need to be correct here.
 *
 * NOTE on naming: the converter is registered under the STORAGE-BUCKET token
 * "BPMN" (what SupportedDiagramType / the store use), but it emits the Apollon
 * model.type "BPMNDiagram".  See guide 17 §0c for why.
 */

import { DiagramConverter, generateUniqueId } from './base';

interface SpecNode {
  id?: string;
  name?: string;
  type?: string; // startEvent | endEvent | intermediateEvent | task | gateway
  taskType?: string;
  gatewayType?: string;
  eventType?: string;
}

interface SpecFlow {
  source?: string; // node id
  target?: string; // node id
  name?: string; // optional edge label (branch condition)
}

const COL_GAP = 220; // horizontal distance between layers
const ROW_GAP = 120; // vertical distance between sibling nodes within a layer
const EVENT_SIZE = 40;
const TASK_W = 140;
const TASK_H = 60;

const TASK_TYPES = new Set(['default', 'user', 'service', 'send', 'receive', 'manual', 'business-rule', 'script']);
const GATEWAY_TYPES = new Set(['exclusive', 'parallel', 'inclusive', 'event-based', 'complex']);

export class BPMNDiagramConverter implements DiagramConverter {
  getDiagramType() {
    return 'BPMN' as const;
  }

  convertSingleElement(spec: any) {
    // Single-element generation funnels into a one-node process so the
    // DiagramConverter contract still holds (the agent funnels these the
    // same way — see the agent guide's generate_single_element).
    return this.convertCompleteSystem({ nodes: [spec], flows: [] });
  }

  convertCompleteSystem(systemSpec: any) {
    const rawNodes: SpecNode[] = Array.isArray(systemSpec?.nodes) ? systemSpec.nodes : [];
    const flows: SpecFlow[] = Array.isArray(systemSpec?.flows) ? systemSpec.flows : [];

    // Give every node a stable spec-id (referenced by flows).
    const nodes = rawNodes.map((n, i) => ({
      ...n,
      id: typeof n.id === 'string' && n.id.trim() ? n.id.trim() : `n${i}`,
    }));

    const elements: Record<string, any> = {};
    const relationships: Record<string, any> = {};
    const idMap: Record<string, string> = {}; // spec id -> apollon id

    // --- Layered left-to-right layout (longest-path layering) ---
    const layerOf = this.computeLayers(nodes, flows);
    const byLayer: Record<number, string[]> = {};
    nodes.forEach((n) => {
      const L = layerOf[n.id] ?? 0;
      (byLayer[L] ||= []).push(n.id);
    });

    // --- Emit elements with bounds ---
    nodes.forEach((n) => {
      const apollonType = this.normalizeType(n.type);
      const isTask = apollonType === 'BPMNTask';
      const w = isTask ? TASK_W : EVENT_SIZE;
      const h = isTask ? TASK_H : EVENT_SIZE;
      const layer = layerOf[n.id] ?? 0;
      const row = byLayer[layer].indexOf(n.id);
      const x = layer * COL_GAP;
      const y = row * ROW_GAP;
      const apollonId = generateUniqueId('bpmn');
      idMap[n.id] = apollonId;

      const base = {
        id: apollonId,
        name: typeof n.name === 'string' ? n.name : '',
        type: apollonType,
        owner: null,
        bounds: { x, y, width: w, height: h },
      };

      if (apollonType === 'BPMNTask') {
        const taskType = TASK_TYPES.has(String(n.taskType)) ? n.taskType : 'default';
        elements[apollonId] = { ...base, taskType, marker: 'none' };
      } else if (apollonType === 'BPMNGateway') {
        const gatewayType = GATEWAY_TYPES.has(String(n.gatewayType)) ? n.gatewayType : 'exclusive';
        elements[apollonId] = { ...base, gatewayType };
      } else {
        // BPMNStartEvent / BPMNEndEvent / BPMNIntermediateEvent
        const eventType = typeof n.eventType === 'string' && n.eventType ? n.eventType : 'default';
        elements[apollonId] = { ...base, eventType };
      }
    });

    // --- Emit sequence-flow relationships. Geometry is placeholder; the
    //     editor's layouter recomputes the path on load (isManuallyLayouted
    //     false), exactly like StateMachineConverter's transitions. ---
    flows.forEach((f) => {
      const sourceId = idMap[String(f.source)];
      const targetId = idMap[String(f.target)];
      if (!sourceId || !targetId) return; // skip dangling refs

      const relId = generateUniqueId('flow');
      const { sourceDir, targetDir } = this.edgeDirections(String(f.source), String(f.target), layerOf, byLayer);

      relationships[relId] = {
        id: relId,
        name: typeof f.name === 'string' ? f.name : '',
        type: 'BPMNFlow',
        owner: null,
        bounds: { x: 0, y: 0, width: 100, height: 1 },
        path: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
        source: { direction: sourceDir, element: sourceId },
        target: { direction: targetDir, element: targetId },
        isManuallyLayouted: false,
        flowType: 'sequence',
        isDefault: false,
      };
    });

    // --- Center the content on the origin (0,0) ---
    // The canvas draws elements inside <svg x="50%" y="50%">, so model
    // coordinate (0,0) is the VISUAL CENTER of the canvas, not the top-left.
    // Content pinned to x>=0 / y>=0 lands entirely in the bottom-right quadrant
    // (the "shifted to the right" symptom).  Every built-in converter avoids
    // this by starting at negative coordinates (LAYOUT_START_X/Y); here we
    // instead measure the content bounding box and shift it so its center sits
    // on the origin.  Flow geometry is placeholder (the layouter recomputes it
    // on load), so only element bounds need shifting.
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

    // --- Diagram-size envelope ---
    const layerKeys = Object.keys(byLayer).map(Number);
    const maxLayer = layerKeys.length ? Math.max(...layerKeys) : 0;
    const maxRows = Object.values(byLayer).reduce((m, a) => Math.max(m, a.length), 1);

    return {
      version: '3.0.0',
      type: 'BPMNDiagram',
      size: {
        width: Math.max(600, (maxLayer + 1) * COL_GAP),
        height: Math.max(320, maxRows * ROW_GAP),
      },
      interactive: { elements: {}, relationships: {} },
      elements,
      relationships,
      assessments: {},
    };
  }

  // ------------------------------------------------------------------

  private normalizeType(rawType?: string): string {
    const t = (rawType || '').toLowerCase().replace(/[\s_-]/g, '');
    if (t === 'startevent' || t === 'start' || t === 'startnode') return 'BPMNStartEvent';
    if (t === 'endevent' || t === 'end' || t === 'endnode') return 'BPMNEndEvent';
    if (t === 'intermediateevent' || t === 'intermediate') return 'BPMNIntermediateEvent';
    if (t === 'gateway' || t === 'gate') return 'BPMNGateway';
    return 'BPMNTask'; // default: any unrecognized node is a task
  }

  /** Longest-path layer assignment over the sequence-flow graph (cycle-safe). */
  private computeLayers(nodes: { id: string }[], flows: SpecFlow[]): Record<string, number> {
    const ids = new Set(nodes.map((n) => n.id));
    const succ: Record<string, string[]> = {};
    const indeg: Record<string, number> = {};
    nodes.forEach((n) => {
      succ[n.id] = [];
      indeg[n.id] = 0;
    });
    flows.forEach((f) => {
      const s = String(f.source);
      const t = String(f.target);
      if (ids.has(s) && ids.has(t) && s !== t) {
        succ[s].push(t);
        indeg[t] += 1;
      }
    });

    const layer: Record<string, number> = {};
    const remaining = { ...indeg };
    const queue: string[] = [];
    nodes.forEach((n) => {
      if (indeg[n.id] === 0) {
        layer[n.id] = 0;
        queue.push(n.id);
      }
    });
    // Pure cycle with no source: seed the first node at layer 0.
    if (queue.length === 0 && nodes.length) {
      layer[nodes[0].id] = 0;
      queue.push(nodes[0].id);
    }

    const visited = new Set<string>();
    while (queue.length) {
      const u = queue.shift() as string;
      if (visited.has(u)) continue;
      visited.add(u);
      const lu = layer[u] ?? 0;
      succ[u].forEach((v) => {
        layer[v] = Math.max(layer[v] ?? 0, lu + 1);
        remaining[v] -= 1;
        if (remaining[v] <= 0 && !visited.has(v)) queue.push(v);
      });
    }
    // Any node never reached (cycle remnant) gets a best-effort layer 0.
    nodes.forEach((n) => {
      if (!(n.id in layer)) layer[n.id] = 0;
    });
    return layer;
  }

  /** Cheap geometry-based edge direction for a nicer first paint (the
   *  layouter re-routes anyway, but good initial directions reduce flicker). */
  private edgeDirections(
    sourceId: string,
    targetId: string,
    layerOf: Record<string, number>,
    byLayer: Record<number, string[]>,
  ): { sourceDir: string; targetDir: string } {
    const sLayer = layerOf[sourceId] ?? 0;
    const tLayer = layerOf[targetId] ?? 0;
    const sRow = (byLayer[sLayer] || []).indexOf(sourceId);
    const tRow = (byLayer[tLayer] || []).indexOf(targetId);
    const dx = tLayer - sLayer;
    const dy = tRow - sRow;
    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx >= 0 ? { sourceDir: 'Right', targetDir: 'Left' } : { sourceDir: 'Left', targetDir: 'Right' };
    }
    return dy >= 0 ? { sourceDir: 'Down', targetDir: 'Up' } : { sourceDir: 'Up', targetDir: 'Down' };
  }
}
