/**
 * BPMN Diagram Converter (v4-native)
 *
 * Converts a simplified BPMN process spec (nodes + flows, optionally grouped
 * into pools/lanes) emitted by the modeling agent straight into the canonical
 * v4 shape ({ version: '4.0.0', type: 'BPMNDiagram', nodes[], edges[] }).
 *
 * Re-targets develop's v3 (elements/relationships) BPMNDiagramConverter to the
 * React-Flow migration's v4 nodes/edges:
 *   - node `type` is lowerCamelCase (`bpmnTask`, `bpmnStartEvent`, `bpmnPool`,
 *     `bpmnSwimlane`, …); containment is via top-level `parentId` with the
 *     child position RELATIVE to its parent (pools are top-level, lanes carry
 *     `parentId = pool.id`, flow nodes carry `parentId = lane.id` or the pool),
 *   - flows are one of the four v4 edge-type strings; the label is written to
 *     BOTH `edge.data.name` AND `edge.data.label`; cross-pool flows become
 *     message flows; `edge.data.isDefault` carries the default-flow marker.
 *
 * NOTE on naming: the converter is registered under the STORAGE-BUCKET token
 * "BPMN" (what `SupportedDiagramType` / the store use), but it emits the model
 * `type` value `UMLDiagramType.BPMN` (=== "BPMNDiagram").
 */

import type { BesserEdge, BesserNode } from '@besser/wme';
import { UMLDiagramType, resolveBpmnEdgeType } from '@besser/wme';
import { DiagramConverter, generateUniqueId } from './base';
import { createEmptyV4Model, directionToHandle } from '../shared/v4Builders';

interface SpecNode {
  id?: string;
  name?: string;
  type?: string; // startEvent | endEvent | intermediateEvent | task | gateway | subprocess | …
  taskType?: string;
  gatewayType?: string;
  eventType?: string;
  poolId?: string; // optional: id of the pool (participant) this node belongs to
  laneId?: string; // optional: id of the lane (role) within poolId
}

interface SpecFlow {
  source?: string; // node id
  target?: string; // node id
  name?: string; // optional edge label (branch condition)
  isDefault?: boolean; // default sequence flow marker
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

// Pool/lane geometry constants (mirrors develop's converter + the reference
// templates) so the first paint looks like a hand-laid-out diagram.
const POOL_HEADER_WIDTH = 40;
const POOL_GAP = 40; // vertical gap between sibling pools
const BAND_V_PADDING = 20; // top/bottom padding inside a lane/pool band
const BAND_MIN_HEIGHT = 130; // single-row lane height

const TASK_TYPES = new Set([
  'default', 'user', 'service', 'send', 'receive', 'manual', 'business-rule', 'businessRule', 'script',
]);
const GATEWAY_TYPES = new Set(['exclusive', 'parallel', 'inclusive', 'event-based', 'complex']);

/** Per-node-type default geometry. */
function sizeForType(type: string): { width: number; height: number } {
  switch (type) {
    case 'bpmnStartEvent':
    case 'bpmnIntermediateEvent':
    case 'bpmnEndEvent':
    case 'bpmnGateway':
      return { width: EVENT_SIZE, height: EVENT_SIZE };
    case 'bpmnDataObject':
      return { width: 40, height: 50 };
    case 'bpmnDataStore':
      return { width: 50, height: 50 };
    case 'bpmnAnnotation':
      return { width: 120, height: 40 };
    case 'bpmnGroup':
      return { width: 200, height: 200 };
    default:
      // bpmnTask / bpmnSubprocess / bpmnTransaction / bpmnCallActivity
      return { width: TASK_W, height: TASK_H };
  }
}

export class BPMNDiagramConverter implements DiagramConverter {
  getDiagramType() {
    return 'BPMN' as const;
  }

  convertSingleElement(spec: any, position?: { x: number; y: number }): { nodes: BesserNode[]; edges: BesserEdge[] } {
    const pos = position || { x: 0, y: 0 };
    const type = this.normalizeType(spec?.type);
    const node = this.buildNode(
      generateUniqueId('bpmn'),
      type,
      typeof spec?.name === 'string' ? spec.name : '',
      pos.x,
      pos.y,
      spec,
    );
    return { nodes: [node], edges: [] };
  }

  convertCompleteSystem(systemSpec: any) {
    const model = createEmptyV4Model(
      UMLDiagramType.BPMN,
      systemSpec?.systemName || systemSpec?.name || '',
    );

    // Accept a handful of alternate array names the agent may emit.
    const rawNodes: SpecNode[] = [
      ...(Array.isArray(systemSpec?.nodes) ? systemSpec.nodes : []),
      ...(Array.isArray(systemSpec?.tasks) ? systemSpec.tasks.map((t: any) => ({ ...t, type: t.type ?? 'task' })) : []),
      ...(Array.isArray(systemSpec?.activities) ? systemSpec.activities.map((t: any) => ({ ...t, type: t.type ?? 'task' })) : []),
      ...(Array.isArray(systemSpec?.events) ? systemSpec.events.map((e: any) => ({ ...e, type: e.type ?? 'event' })) : []),
      ...(Array.isArray(systemSpec?.gateways) ? systemSpec.gateways.map((g: any) => ({ ...g, type: g.type ?? 'gateway' })) : []),
    ];
    const flows: SpecFlow[] = [
      ...(Array.isArray(systemSpec?.flows) ? systemSpec.flows : []),
      ...(Array.isArray(systemSpec?.sequenceFlows) ? systemSpec.sequenceFlows : []),
    ];
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

    const layerOf = this.computeLayers(nodes, flows);

    if (pools.length === 0) {
      this.layoutFlat(nodes, flows, layerOf, model);
    } else {
      this.layoutWithPools(nodes, flows, pools, layerOf, model);
    }

    return model;
  }

  // ------------------------------------------------------------------
  // Flat process (no pools).
  // ------------------------------------------------------------------

  private layoutFlat(
    nodes: StableNode[],
    flows: SpecFlow[],
    layerOf: Record<string, number>,
    model: Record<string, any>,
  ): void {
    const idMap: Record<string, string> = {}; // spec id -> node id
    const typeMap: Record<string, string> = {}; // spec id -> v4 node type

    const byLayer: Record<number, string[]> = {};
    nodes.forEach((n) => {
      const L = layerOf[n.id] ?? 0;
      (byLayer[L] ||= []).push(n.id);
    });

    nodes.forEach((n) => {
      const layer = layerOf[n.id] ?? 0;
      const row = byLayer[layer].indexOf(n.id);
      const x = layer * COL_GAP;
      const y = row * ROW_GAP;
      const type = this.normalizeType(n.type);
      const nodeId = generateUniqueId('bpmn');
      idMap[n.id] = nodeId;
      typeMap[n.id] = type;
      model.nodes.push(this.buildNode(nodeId, type, n.name ?? '', x, y, n));
    });

    flows.forEach((f) => this.emitFlow(f, idMap, typeMap, layerOf, byLayer, model));
  }

  // ------------------------------------------------------------------
  // Collaboration diagram (pools/lanes present).
  // ------------------------------------------------------------------

  private layoutWithPools(
    nodes: StableNode[],
    flows: SpecFlow[],
    pools: Pool[],
    layerOf: Record<string, number>,
    model: Record<string, any>,
  ): void {
    const idMap: Record<string, string> = {}; // spec id -> node id
    const typeMap: Record<string, string> = {}; // spec id -> v4 node type

    type Band = { key: string; nodeIds: string[] };
    const poolIndexOf: Record<string, number> = {}; // spec node id -> pool stacking order
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

    // Row assignment within each band.
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

    const layerValues = Object.values(layerOf);
    const maxLayer = layerValues.length ? Math.max(...layerValues) : 0;
    const contentWidth = (maxLayer + 1) * COL_GAP;
    const poolWidth = Math.max(400, POOL_HEADER_WIDTH + contentWidth + COL_GAP / 2);

    // Parent node + absolute origin for every band, so contained nodes can be
    // positioned RELATIVE to their React-Flow parent.
    const bandParent: Record<string, { id: string; absX: number; absY: number }> = {};

    let cursorY = 0;
    pools.forEach((pool) => {
      const bands = bandsByPool[pool.id];
      const poolY = cursorY;
      let laneCursorY = poolY;
      const bandOriginY: Record<string, number> = {};
      bands.forEach((band) => {
        const rows = maxRowsOf[band.key] || 1;
        const bandHeight = Math.max(BAND_MIN_HEIGHT, rows * ROW_GAP + BAND_V_PADDING * 2);
        bandOriginY[band.key] = laneCursorY;
        laneCursorY += bandHeight;
      });
      const poolHeight = laneCursorY - poolY;

      const poolNodeId = generateUniqueId('bpmn');
      model.nodes.push(this.buildContainerNode(poolNodeId, 'bpmnPool', pool.name, 0, poolY, poolWidth, poolHeight));

      if (pool.lanes.length) {
        pool.lanes.forEach((lane, i) => {
          const band = bands[i];
          const laneHeight = Math.max(
            BAND_MIN_HEIGHT,
            (maxRowsOf[band.key] || 1) * ROW_GAP + BAND_V_PADDING * 2,
          );
          const laneAbsY = bandOriginY[band.key];
          const laneNodeId = generateUniqueId('bpmn');
          // Lane position is RELATIVE to its pool parent.
          model.nodes.push(
            this.buildContainerNode(
              laneNodeId,
              'bpmnSwimlane',
              lane.name,
              POOL_HEADER_WIDTH,
              laneAbsY - poolY,
              poolWidth - POOL_HEADER_WIDTH,
              laneHeight,
              poolNodeId,
            ),
          );
          bandParent[band.key] = { id: laneNodeId, absX: POOL_HEADER_WIDTH, absY: laneAbsY };
        });
      } else {
        // Pool with no lanes: its single band is parented directly to the pool.
        bandParent[bands[0].key] = { id: poolNodeId, absX: 0, absY: poolY };
      }

      cursorY = poolY + poolHeight + POOL_GAP;
    });

    // Trailing flat band for nodes with no recognized pool.
    if (orphanBand.nodeIds.length) {
      bandParent[orphanBand.key] = { id: '', absX: 0, absY: cursorY };
    }

    // Emit node elements.
    nodes.forEach((n) => {
      const layer = layerOf[n.id] ?? 0;
      const row = rowOf[n.id] ?? 0;
      const parent = bandParent[bandKeyOf[n.id]];
      const absX = POOL_HEADER_WIDTH + layer * COL_GAP;
      const absY = (parent?.absY ?? 0) + BAND_V_PADDING + row * ROW_GAP;
      const type = this.normalizeType(n.type);
      const nodeId = generateUniqueId('bpmn');
      idMap[n.id] = nodeId;
      typeMap[n.id] = type;

      if (parent && parent.id) {
        // Position RELATIVE to the parent lane/pool.
        const node = this.buildNode(nodeId, type, n.name ?? '', absX - parent.absX, absY - parent.absY, n);
        node.parentId = parent.id;
        model.nodes.push(node);
      } else {
        model.nodes.push(this.buildNode(nodeId, type, n.name ?? '', absX, absY, n));
      }
    });

    const byLayer: Record<number, string[]> = {};
    nodes.forEach((n) => {
      const L = layerOf[n.id] ?? 0;
      (byLayer[L] ||= []).push(n.id);
    });
    flows.forEach((f) => this.emitFlow(f, idMap, typeMap, layerOf, byLayer, model, poolIndexOf));
  }

  // ------------------------------------------------------------------
  // Shared node/edge builders
  // ------------------------------------------------------------------

  /** Build a v4 flow-node (task/event/gateway/…) with the correct data fields. */
  private buildNode(
    id: string,
    type: string,
    name: string,
    x: number,
    y: number,
    spec: SpecNode,
  ): BesserNode {
    const { width, height } = sizeForType(type);
    const data: Record<string, unknown> = { name: typeof name === 'string' ? name : '' };

    if (type === 'bpmnTask') {
      data.taskType = TASK_TYPES.has(String(spec.taskType)) ? spec.taskType : 'default';
      data.marker = 'none';
    } else if (type === 'bpmnGateway') {
      data.gatewayType = GATEWAY_TYPES.has(String(spec.gatewayType)) ? spec.gatewayType : 'exclusive';
    } else if (type === 'bpmnStartEvent' || type === 'bpmnIntermediateEvent' || type === 'bpmnEndEvent') {
      data.eventType = typeof spec.eventType === 'string' && spec.eventType ? spec.eventType : 'default';
    } else if (type === 'bpmnSubprocess' || type === 'bpmnTransaction') {
      data.isExpanded = false;
    } else if (type === 'bpmnCallActivity') {
      data.calledElement = '';
    }

    return {
      id,
      type: type as any,
      position: { x, y },
      width,
      height,
      measured: { width, height },
      data,
    };
  }

  /** Build a v4 container node (pool / swimlane), optionally parented. */
  private buildContainerNode(
    id: string,
    type: 'bpmnPool' | 'bpmnSwimlane',
    name: string,
    x: number,
    y: number,
    width: number,
    height: number,
    parentId?: string,
  ): BesserNode {
    const node: BesserNode = {
      id,
      type: type as any,
      position: { x, y },
      width,
      height,
      measured: { width, height },
      data: { name: typeof name === 'string' ? name : '' },
    };
    if (parentId) node.parentId = parentId;
    return node;
  }

  /**
   * Emit a v4 flow edge. Geometry is placeholder (the editor's layouter
   * recomputes the path on load). Cross-pool flows become message flows; every
   * other pair resolves its subtype via `resolveBpmnEdgeType`.
   */
  private emitFlow(
    f: SpecFlow,
    idMap: Record<string, string>,
    typeMap: Record<string, string>,
    layerOf: Record<string, number>,
    byLayer: Record<number, string[]>,
    model: Record<string, any>,
    poolIndexOf?: Record<string, number>,
  ): void {
    const sourceId = idMap[String(f.source)];
    const targetId = idMap[String(f.target)];
    if (!sourceId || !targetId) return; // skip dangling refs

    let { sourceDir, targetDir } = this.edgeDirections(String(f.source), String(f.target), layerOf, byLayer);

    let edgeType = resolveBpmnEdgeType(typeMap[String(f.source)], typeMap[String(f.target)], 'BPMNSequenceFlow');
    if (poolIndexOf) {
      const sPool = poolIndexOf[String(f.source)];
      const tPool = poolIndexOf[String(f.target)];
      if (sPool !== undefined && tPool !== undefined && sPool !== tPool) {
        edgeType = 'BPMNMessageFlow';
        sourceDir = sPool < tPool ? 'Down' : 'Up';
        targetDir = sPool < tPool ? 'Up' : 'Down';
      }
    }

    const name = typeof f.name === 'string' ? f.name : '';
    const edge: BesserEdge = {
      id: generateUniqueId('flow'),
      source: sourceId,
      target: targetId,
      type: edgeType as any,
      sourceHandle: directionToHandle(sourceDir, 'Right'),
      targetHandle: directionToHandle(targetDir, 'Left'),
      data: {
        label: name,
        name,
        isDefault: !!f.isDefault,
        isManuallyLayouted: false,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
      },
    };
    model.edges.push(edge);
  }

  // ------------------------------------------------------------------

  private normalizeType(rawType?: string): string {
    const t = (rawType || '').toLowerCase().replace(/[\s_-]/g, '');
    if (t === 'startevent' || t === 'start' || t === 'startnode') return 'bpmnStartEvent';
    if (t === 'endevent' || t === 'end' || t === 'endnode') return 'bpmnEndEvent';
    if (t === 'intermediateevent' || t === 'intermediate') return 'bpmnIntermediateEvent';
    if (t === 'gateway' || t === 'gate') return 'bpmnGateway';
    if (t === 'subprocess') return 'bpmnSubprocess';
    if (t === 'transaction') return 'bpmnTransaction';
    if (t === 'callactivity') return 'bpmnCallActivity';
    if (t === 'dataobject' || t === 'data') return 'bpmnDataObject';
    if (t === 'datastore') return 'bpmnDataStore';
    if (t === 'annotation' || t === 'textannotation' || t === 'text') return 'bpmnAnnotation';
    if (t === 'group') return 'bpmnGroup';
    return 'bpmnTask'; // default: any unrecognized node is a task
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
    nodes.forEach((n) => {
      if (!(n.id in layer)) layer[n.id] = 0;
    });
    return layer;
  }

  /** Cheap geometry-based edge direction for a nicer first paint. */
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
