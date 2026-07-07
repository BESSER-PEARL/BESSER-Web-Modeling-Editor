/**
 * BPMN Diagram Converter
 * Converts a simplified BPMN process spec (nodes + flows, optionally grouped
 * into pools/lanes) emitted by the modeling agent into the Apollon
 * BPMNDiagram model.
 *
 * No other agentic fields (isAgentic, role, gatewayRole, collaborationMode,
 * mergingStrategy, trustScore, governanceDsl, …). Output shape matches the
 * verified BPMN template shape (see .claude/bpmn/11-bpmn-load-template-examples-guide.md):
 * model.type === "BPMNDiagram"; sequence-flow paths are left for the editor's
 * layouter to recompute on load (isManuallyLayouted: false), so only element
 * bounds need to be correct here.
 *
 * Pools/lanes: confirmed against the hand-authored reference templates
 * (car_wash.json, pizza_store.json) that ALL bounds — including nodes drawn
 * inside a pool/lane — are ABSOLUTE canvas coordinates. Only BPMNSwimlane
 * elements set owner (to their pool's Apollon id); pools and every node/flow
 * keep owner: null and are placed purely by geometric overlap with the
 * pool/lane rectangle. flowType ('sequence' vs 'message') is derived here
 * from pool membership, never emitted by the agent.
 *
 * NOTE on naming: the converter is registered under the STORAGE-BUCKET token
 * "BPMN" (what SupportedDiagramType / the store use), but it emits the Apollon
 * model.type "BPMNDiagram".
 */

import { DiagramConverter, generateUniqueId } from './base';

interface SpecNode {
  id?: string;
  name?: string;
  type?: string;
  taskType?: string;
  gatewayType?: string;
  eventType?: string;
  poolId?: string; // optional: id of the pool (participant) this node belongs to
  laneId?: string; // optional: id of the lane (role) within poolId
}

interface SpecFlow {
  source?: string;
  target?: string;
  name?: string;
  flowType?: string;
}

interface SpecLane {
  id?: string;
  name?: string;
}

interface SpecPool {
  id?: string;
  name?: string;
  lanes?: SpecLane[];
}

type StableNode = SpecNode & { id: string };
type Pool = { id: string; name: string; lanes: { id: string; name: string }[] };

const COL_GAP = 220; // horizontal distance between layers
const ROW_GAP = 120; // vertical distance between sibling nodes within a layer/band
const EVENT_SIZE = 40;
const TASK_W = 140;
const TASK_H = 60;
const POOL_HEADER_WIDTH = 40;
const POOL_MIN_HEIGHT = 80;
const POOL_VERTICAL_GAP = 80;
const POOL_NODE_X = 120;
const POOL_TOP_PADDING = 30;
const LANE_HEIGHT = 140;
const LANE_STACK_GAP = 80;
const LANE_HEADER_WIDTH = 30;

type NormalizedSpecNode = SpecNode & { id: string };
type NormalizedSpecLane = { id: string; name: string; poolId: string };
type NormalizedSpecPool = { id: string; name: string; lanes: NormalizedSpecLane[] };
type NodePlacement = { poolId: string | null; laneId: string | null };

// Pool/lane geometry constants matching the editor's own BPMNPool/BPMNSwimlane
// classes (packages/editor/.../bpmn-pool/bpmn-pool.ts) and the reference
// templates, so first-paint geometry looks like a hand-laid-out diagram.
const POOL_HEADER_WIDTH = 40; // matches BPMNPool.HEADER_WIDTH
const POOL_GAP = 40; // vertical gap between sibling pools
const BAND_V_PADDING = 20; // top/bottom padding inside a lane/pool band
const BAND_MIN_HEIGHT = 130; // matches the reference templates' single-row lane height

const TASK_TYPES = new Set(['default', 'user', 'service', 'send', 'receive', 'manual', 'business-rule', 'script']);
const GATEWAY_TYPES = new Set(['exclusive', 'parallel', 'inclusive', 'event-based', 'complex']);

export class BPMNDiagramConverter implements DiagramConverter {
  getDiagramType() {
    return 'BPMN' as const;
  }

  convertSingleElement(spec: any) {
    return this.convertCompleteSystem({ nodes: [spec], flows: [] });
  }

  convertCompleteSystem(systemSpec: any) {
    const rawNodes: SpecNode[] = Array.isArray(systemSpec?.nodes) ? systemSpec.nodes : [];
    const flows: SpecFlow[] = Array.isArray(systemSpec?.flows) ? systemSpec.flows : [];
    const rawPools: SpecPool[] = Array.isArray(systemSpec?.pools) ? systemSpec.pools : [];

    // Give every node a stable spec-id (referenced by flows).
    const nodes: StableNode[] = rawNodes.map((n, i) => ({
      ...n,
      id: typeof n.id === 'string' && n.id.trim() ? n.id.trim() : `n${i}`,
    }));

    const pools: Pool[] = rawPools
      .filter((p): p is SpecPool & { id: string } => typeof p.id === 'string' && p.id.trim().length > 0)
      .map((p) => ({
        id: p.id.trim(),
        name: typeof p.name === 'string' ? p.name : '',
        lanes: (Array.isArray(p.lanes) ? p.lanes : [])
          .filter((l): l is SpecLane & { id: string } => typeof l.id === 'string' && l.id.trim().length > 0)
          .map((l) => ({ id: l.id.trim(), name: typeof l.name === 'string' ? l.name : '' })),
      }));

    // --- Layered left-to-right layout (longest-path layering). Computed over
    // the FULL flow graph (including cross-pool message flows) so columns
    // line up visually across pools/lanes, matching the reference templates. ---
    const layerOf = this.computeLayers(nodes, flows);

    if (pools.length === 0) {
      return this.layoutFlat(nodes, flows, layerOf);
    }
    return this.layoutWithPools(nodes, flows, pools, layerOf);
  }

  // ------------------------------------------------------------------
  // Flat process (no pools) — original algorithm, unchanged.
  // ------------------------------------------------------------------

  private layoutFlat(nodes: StableNode[], flows: SpecFlow[], layerOf: Record<string, number>) {
    const elements: Record<string, any> = {};
    const relationships: Record<string, any> = {};
    const idMap: Record<string, string> = {}; // spec id -> apollon id
    const laneIdMap: Record<string, string> = {}; // spec pool::lane -> apollon swimlane id

    const byLayer: Record<number, string[]> = {};

    nodes.forEach((node) => {
      const layer = layerOf[node.id] ?? 0;
      (byLayer[layer] ||= []).push(node.id);
    });

    nodes.forEach((n) => {
      const layer = layerOf[n.id] ?? 0;
      const row = byLayer[layer].indexOf(n.id);
      const x = layer * COL_GAP;
      const y = row * ROW_GAP;
      this.emitNodeElement(n, x, y, elements, idMap);
    });

    flows.forEach((f) => this.emitFlow(f, idMap, layerOf, byLayer, relationships));

  private finalizeModel(
    elements: Record<string, any>,
    relationships: Record<string, any>,
    byLayer: Record<number, string[]> = {},
  ) {
    this.centerContent(elements);

    const placed = Object.values(elements) as Array<{
      bounds: { x: number; y: number; width: number; height: number };
    }>;
    const maxRight = placed.reduce((max, element) => Math.max(max, element.bounds.x + element.bounds.width), 0);
    const maxBottom = placed.reduce((max, element) => Math.max(max, element.bounds.y + element.bounds.height), 0);
    const minLeft = placed.reduce((min, element) => Math.min(min, element.bounds.x), 0);
    const minTop = placed.reduce((min, element) => Math.min(min, element.bounds.y), 0);
    const maxLayer = Object.keys(byLayer).length ? Math.max(...Object.keys(byLayer).map(Number)) : 0;
    const maxRows = Object.values(byLayer).reduce((max, rows) => Math.max(max, rows.length), 1);

    return {
      version: '3.0.0',
      type: 'BPMNDiagram',
      size: {
        width: Math.max(600, Math.max((maxLayer + 1) * COL_GAP, maxRight - minLeft + 200)),
        height: Math.max(320, Math.max(maxRows * ROW_GAP, maxBottom - minTop + 160)),
      },
      interactive: { elements: {}, relationships: {} },
      elements,
      relationships,
      assessments: {},
    };
  }

  // ------------------------------------------------------------------
  // Collaboration diagram (pools/lanes present).
  // ------------------------------------------------------------------

  private layoutWithPools(nodes: StableNode[], flows: SpecFlow[], pools: Pool[], layerOf: Record<string, number>) {
    const elements: Record<string, any> = {};
    const relationships: Record<string, any> = {};
    const idMap: Record<string, string> = {}; // spec id -> apollon id
    const laneIdMap: Record<string, string> = {}; // spec pool::lane -> apollon swimlane id

    // --- Band model: one band per lane, or one band per pool when it has no
    // lanes. Nodes with an unrecognized/missing poolId land in a trailing
    // flat band so a partially-specified spec never loses a node. ---
    type Band = { key: string; nodeIds: string[] };
    const poolIndexOf: Record<string, number> = {}; // spec node id -> pool stacking order (for message-flow detection)
    const bandKeyOf: Record<string, string> = {};
    const bandsByPool: Record<string, Band[]> = {};

    pools.forEach((pool, pIdx) => {
      const laneBands: Band[] = pool.lanes.length
        ? pool.lanes.map((lane) => ({ key: `${pool.id}::${lane.id}`, nodeIds: [] }))
        : [{ key: `${pool.id}::__self`, nodeIds: [] }];
      bandsByPool[pool.id] = laneBands;

      nodes.forEach((n) => {
        if (n.poolId !== pool.id) return;
        poolIndexOf[n.id] = pIdx;
        const lane = pool.lanes.find((l) => l.id === n.laneId);
        const band = (lane && laneBands.find((b) => b.key === `${pool.id}::${lane.id}`)) || laneBands[0];
        band.nodeIds.push(n.id);
        bandKeyOf[n.id] = band.key;
      });
    });

    const orphanBand: Band = { key: '__none', nodeIds: [] };
    nodes.forEach((n) => {
      if (!(n.id in bandKeyOf)) {
        orphanBand.nodeIds.push(n.id);
        bandKeyOf[n.id] = orphanBand.key;
      }
    });

    // --- Row assignment within each band (nodes sharing a layer stack vertically) ---
    const rowOf: Record<string, number> = {};
    const maxRowsOf: Record<string, number> = {};
    const allBands: Band[] = [
      ...pools.flatMap((p) => bandsByPool[p.id]),
      ...(orphanBand.nodeIds.length ? [orphanBand] : []),
    ];
    allBands.forEach((band) => {
      const byLayerInBand: Record<number, string[]> = {};
      band.nodeIds.forEach((id) => {
        const L = layerOf[id] ?? 0;
        (byLayerInBand[L] ||= []).push(id);
      });
      let maxRows = 1;
      Object.values(byLayerInBand).forEach((ids) => {
        ids.forEach((id, i) => {
          rowOf[id] = i;
        });
        maxRows = Math.max(maxRows, ids.length);
      });
      maxRowsOf[band.key] = band.nodeIds.length ? maxRows : 0;
    });

    // --- Column width shared by every pool so they visually align ---
    const layerValues = Object.values(layerOf);
    const maxLayer = layerValues.length ? Math.max(...layerValues) : 0;
    const contentWidth = (maxLayer + 1) * COL_GAP;
    const poolWidth = Math.max(400, POOL_HEADER_WIDTH + contentWidth + COL_GAP / 2);

    // --- Stack pools top-to-bottom; lanes stack top-to-bottom within a pool ---
    let cursorY = 0;
    const bandOriginY: Record<string, number> = {};

    pools.forEach((pool) => {
      const bands = bandsByPool[pool.id];
      const poolY = cursorY;
      let laneCursorY = poolY;
      bands.forEach((band) => {
        const rows = maxRowsOf[band.key] || 1;
        const bandHeight = Math.max(BAND_MIN_HEIGHT, rows * ROW_GAP + BAND_V_PADDING * 2);
        bandOriginY[band.key] = laneCursorY;
        laneCursorY += bandHeight;
      });
      const poolHeight = laneCursorY - poolY;

      const poolApollonId = generateUniqueId('bpmn');
      elements[poolApollonId] = {
        id: poolApollonId,
        name: pool.name,
        type: 'BPMNPool',
        owner: null,
        bounds: { x: 0, y: poolY, width: poolWidth, height: poolHeight },
      };

      pool.lanes.forEach((lane, i) => {
        const band = bands[i];
        const laneApollonId = generateUniqueId('bpmn');
        laneIdMap[`${pool.id}::${lane.id}`] = laneApollonId;
        elements[laneApollonId] = {
          id: laneApollonId,
          name: lane.name,
          type: 'BPMNSwimlane',
          owner: poolApollonId,
          bounds: {
            x: POOL_HEADER_WIDTH,
            y: bandOriginY[band.key],
            width: poolWidth - POOL_HEADER_WIDTH,
            height: Math.max(BAND_MIN_HEIGHT, (maxRowsOf[band.key] || 1) * ROW_GAP + BAND_V_PADDING * 2),
          },
        };
      });

      cursorY = poolY + poolHeight + POOL_GAP;
    });

    // --- Trailing flat band for nodes with no recognized pool (fallback) ---
    if (orphanBand.nodeIds.length) {
      bandOriginY[orphanBand.key] = cursorY;
    }

    // --- Emit node elements ---
    nodes.forEach((n) => {
      const layer = layerOf[n.id] ?? 0;
      const bandY = bandOriginY[bandKeyOf[n.id]] ?? 0;
      const row = rowOf[n.id] ?? 0;
      const x = POOL_HEADER_WIDTH + layer * COL_GAP;
      const y = bandY + BAND_V_PADDING + row * ROW_GAP;
      const owner = n.poolId && n.laneId ? laneIdMap[`${n.poolId}::${n.laneId}`] ?? null : null;
      this.emitNodeElement(n, x, y, elements, idMap, owner);
    });

    // --- Emit flows: cross-pool flows become message flows with a vertical
    // direction override (matches the reference templates); everything else
    // uses the generic geometry-based heuristic. ---
    const byLayer: Record<number, string[]> = {};
    nodes.forEach((n) => {
      const L = layerOf[n.id] ?? 0;
      (byLayer[L] ||= []).push(n.id);
    });
    flows.forEach((f) => this.emitFlow(f, idMap, layerOf, byLayer, relationships, poolIndexOf));

    return this.finalizeModel(elements, relationships);
  }

  // ------------------------------------------------------------------
  // Shared element/flow emission
  // ------------------------------------------------------------------

  private emitNodeElement(
    n: StableNode,
    x: number,
    y: number,
    elements: Record<string, any>,
    idMap: Record<string, string>,
    owner: string | null = null,
  ): void {
    const apollonType = this.normalizeType(n.type);
    const isTask = apollonType === 'BPMNTask';
    const w = isTask ? TASK_W : EVENT_SIZE;
    const h = isTask ? TASK_H : EVENT_SIZE;
    const apollonId = generateUniqueId('bpmn');
    idMap[n.id] = apollonId;

    const base = {
      id: apollonId,
      name: typeof n.name === 'string' ? n.name : '',
      type: apollonType,
      owner,
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
  }

  /**
   * Emits a sequence-flow relationship. Geometry is placeholder; the editor's
   * layouter recomputes the path on load (isManuallyLayouted false), exactly
   * like StateMachineConverter's transitions. When `poolIndexOf` is supplied
   * and the flow's endpoints sit in different pools, it becomes a message
   * flow with a vertical direction override (matches car_wash/pizza_store's
   * cross-pool flows, which are always Down/Up rather than Left/Right).
   */
  private emitFlow(
    f: SpecFlow,
    idMap: Record<string, string>,
    layerOf: Record<string, number>,
    byLayer: Record<number, string[]>,
    relationships: Record<string, any>,
    poolIndexOf?: Record<string, number>,
  ): void {
    const sourceId = idMap[String(f.source)];
    const targetId = idMap[String(f.target)];
    if (!sourceId || !targetId) return; // skip dangling refs

    const relId = generateUniqueId('flow');
    let { sourceDir, targetDir } = this.edgeDirections(String(f.source), String(f.target), layerOf, byLayer);

    let flowType: 'sequence' | 'message' = 'sequence';
    if (poolIndexOf) {
      const sPool = poolIndexOf[String(f.source)];
      const tPool = poolIndexOf[String(f.target)];
      if (sPool !== undefined && tPool !== undefined && sPool !== tPool) {
        flowType = 'message';
        sourceDir = sPool < tPool ? 'Down' : 'Up';
        targetDir = sPool < tPool ? 'Up' : 'Down';
      }
    }

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
      flowType,
      isDefault: false,
    };
  }

  /** Centers content on the origin and wraps it into a full BPMNDiagram model. */
  private finalizeModel(elements: Record<string, any>, relationships: Record<string, any>) {
    const placed = Object.values(elements);
    let width = 600;
    let height = 320;
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
      width = Math.max(600, maxX - minX);
      height = Math.max(320, maxY - minY);
    }

    return {
      version: '3.0.0',
      type: 'BPMNDiagram',
      size: { width, height },
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
    return 'BPMNTask';
  }

  /** Longest-path layer assignment over the sequence-flow graph (cycle-safe). */
  private computeLayers(nodes: { id: string }[], flows: SpecFlow[]): Record<string, number> {
    const ids = new Set(nodes.map((node) => node.id));
    const succ: Record<string, string[]> = {};
    const indeg: Record<string, number> = {};
    nodes.forEach((node) => {
      succ[node.id] = [];
      indeg[node.id] = 0;
    });
    flows.forEach((flow) => {
      const source = String(flow.source);
      const target = String(flow.target);
      if (ids.has(source) && ids.has(target) && source !== target) {
        succ[source].push(target);
        indeg[target] += 1;
      }
    });

    const layer: Record<string, number> = {};
    const remaining = { ...indeg };
    const queue: string[] = [];
    nodes.forEach((node) => {
      if (indeg[node.id] === 0) {
        layer[node.id] = 0;
        queue.push(node.id);
      }
    });
    if (queue.length === 0 && nodes.length) {
      layer[nodes[0].id] = 0;
      queue.push(nodes[0].id);
    }

    const visited = new Set<string>();
    while (queue.length) {
      const nodeId = queue.shift() as string;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);
      const currentLayer = layer[nodeId] ?? 0;
      succ[nodeId].forEach((target) => {
        layer[target] = Math.max(layer[target] ?? 0, currentLayer + 1);
        remaining[target] -= 1;
        if (remaining[target] <= 0 && !visited.has(target)) queue.push(target);
      });
    }

    nodes.forEach((node) => {
      if (!(node.id in layer)) layer[node.id] = 0;
    });
    return layer;
  }

  private edgeDirections(
    sourceId: string,
    targetId: string,
    layerOf: Record<string, number>,
    byLayer: Record<number, string[]>,
  ): { sourceDir: string; targetDir: string } {
    const sourceLayer = layerOf[sourceId] ?? 0;
    const targetLayer = layerOf[targetId] ?? 0;
    const sourceRow = (byLayer[sourceLayer] || []).indexOf(sourceId);
    const targetRow = (byLayer[targetLayer] || []).indexOf(targetId);
    const dx = targetLayer - sourceLayer;
    const dy = targetRow - sourceRow;
    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx >= 0 ? { sourceDir: 'Right', targetDir: 'Left' } : { sourceDir: 'Left', targetDir: 'Right' };
    }
    return dy >= 0 ? { sourceDir: 'Down', targetDir: 'Up' } : { sourceDir: 'Up', targetDir: 'Down' };
  }
}


